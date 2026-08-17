import { createClient } from "@supabase/supabase-js";

// This is the public publishable key for the production Supabase project.
// It is intentionally browser-safe. Using the known project key here prevents
// an incorrect/stale GitHub Actions secret from causing REST 401 responses.
const SUPABASE_URL = "https://kxelijflylhzjfzpynhg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1xU_qjh4dXKISjidJOnmXQ_1bmxeiZb";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
