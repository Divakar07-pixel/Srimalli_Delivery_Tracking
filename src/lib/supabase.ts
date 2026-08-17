import { createClient } from "@supabase/supabase-js";

// GitHub Pages is a static site. Use the project's public legacy anon key for
// compatibility with the Supabase REST/RPC gateway used by this application.
// Never use the Supabase service-role/secret key in browser code.
const DEFAULT_SUPABASE_URL = "https://kxelijflylhzjfzpynhg.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4ZWxpamZseWxoempmenB5bmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTA4OTcsImV4cCI6MjEwMTQyNjg5N30.Ec_CBc_7LIJhwVDICWbTissXe9WmxtXDqH_nhiLUSp0";

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
