import { createClient } from "@supabase/supabase-js";

// GitHub Pages is a static site, so the Supabase publishable key is safe to ship
// to the browser. Keep environment variables as the preferred configuration,
// but use the project's public publishable key as a production fallback so a
// stale/missing GitHub Actions secret cannot break every REST request with 401.
const DEFAULT_SUPABASE_URL = "https://kxelijflylhzjfzpynhg.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1xU_qjh4dXKISjidJOnmXQ_1bmxeiZb";

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
const supabaseAnonKey = String(
  import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY
).trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase configuration is missing.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
