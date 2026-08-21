import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import webpush from "npm:web-push@3.6.7";
import { createClient, corsHeaders } from "npm:@supabase/supabase-js@2.112.3";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const ARRIVAL_RADIUS_METERS = 200;

function distanceMeters(aLat:number,aLng:number,bLat:number,bLng:number){const R=6371000;const dLat=(bLat-aLat)*Math.PI/180;const dLng=(bLng-aLng)*Math.PI/180;const lat1=aLat*Math.PI/180;const lat2=bLat*Math.PI/180;const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;return R*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  try{
    const {token,latitude,longitude}=await req.json();
    if(typeof token!=="string"||typeof latitude!=="number"||typeof longitude!=="number")return json({error:"Invalid request"},400);
    const {data:order,error:orderError}=await supabase.from("orders").select("id, tracking_id, customer_latitude, customer_longitude, status, delivery_tracking_active").eq("delivery_tracking_token",token).maybeSingle();
    if(orderError)throw orderError;
    if(!order||order.status!=="out_for_delivery"||!order.delivery_tracking_active)return json({notified:false,reason:"tracking_inactive"});
    if(order.customer_latitude==null||order.customer_longitude==null)return json({notified:false,reason:"customer_location_missing"});
    const distance=distanceMeters(latitude,longitude,order.customer_latitude,order.customer_longitude);
    if(distance>ARRIVAL_RADIUS_METERS)return json({notified:false,distance_m:Math.round(distance)});
    if(!VAPID_PUBLIC_KEY||!VAPID_PRIVATE_KEY)return json({notified:false,reason:"push_keys_not_configured",distance_m:Math.round(distance)},503);
    webpush.setVapidDetails(VAPID_SUBJECT,VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY);
    const {data:subscriptions,error:subscriptionError}=await supabase.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("order_id",order.id);
    if(subscriptionError)throw subscriptionError;
    if(!subscriptions?.length)return json({notified:false,reason:"no_customer_subscription",distance_m:Math.round(distance)});
    const {data:claimed,error:claimError}=await supabase.rpc("claim_arrival_notification",{p_order_id:order.id});
    if(claimError)throw claimError;
    if(!claimed)return json({notified:false,reason:"already_notified",distance_m:Math.round(distance)});
    const payload=JSON.stringify({title:"🚚 Order has arrived near your location",body:"Your delivery is nearby. Please be available to receive your order.",tag:`srimalli-arrival-${order.id}`,trackingId:order.tracking_id,icon:"/icons/icon-192.png",badge:"/icons/icon-192.png"});
    let sent=0;
    for(const subscription of subscriptions){
      try{await webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},payload);sent+=1;}
      catch(error){const statusCode=(error as {statusCode?:number}).statusCode;if(statusCode===404||statusCode===410)await supabase.from("push_subscriptions").delete().eq("id",subscription.id);}
    }
    if(sent===0){await supabase.rpc("reset_arrival_notification",{p_order_id:order.id});return json({notified:false,reason:"push_delivery_failed",distance_m:Math.round(distance)},502);}
    return json({notified:true,sent,distance_m:Math.round(distance)});
  }catch(error){console.error(error);return json({error:"Unable to process arrival notification"},500);}
});
