import { createClient } from "@supabase/supabase-js";

// GitHub Pages production build: use the verified public legacy anon key.
// This key is safe for browser use. Never put a Supabase service-role/secret key here.
const SUPABASE_URL = "https://kxelijflylhzjfzpynhg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4ZWxpamZseWxoempmenB5bmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTA4OTcsImV4cCI6MjEwMTQyNjg5N30.Ec_CBc_7LIJhwVDICWbTissXe9WmxtXDqH_nhiLUSp0";

// Do not allow a stale GitHub Actions VITE_SUPABASE_ANON_KEY secret to override
// the verified production key. This app is deployed as a static GitHub Pages site.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
