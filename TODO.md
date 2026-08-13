# Delivery Route Map — Implementation Plan

## Steps
- [x] Install Leaflet + @types/leaflet
- [ ] Create migration `0006_delivery_route_map.sql` (orders lat/lng/map_link, settings shop lat/lng, update RPCs)
- [ ] Update types (`database.ts`, `order.ts`)
- [ ] Add map utils (parse Google Maps link, haversine distance, ETA)
- [ ] Create `DeliveryRouteMap` component (Leaflet + OSM)
- [ ] Admin Settings: shop latitude/longitude config
- [ ] AddOrder: optional Google Maps link capture + coords extraction + map preview
- [ ] OrderDetail: edit customer map link + map preview
- [ ] Public TrackDetail: route map, distance, ETA, buttons, graceful fallback
- [ ] Typecheck + build
