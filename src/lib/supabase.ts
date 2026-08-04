import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly in dev rather than silently breaking every query.
  console.error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project credentials."
  );
}

// Note: intentionally not parameterized with a strict Database generic.
// App-level types in src/types/database.ts (Order, Customer, OrderItem, etc.)
// are applied explicitly in the services layer instead — see src/services/*.ts.
// If you generate real types later (`supabase gen types typescript`), you can
// re-introduce createClient<Database>(...) there.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
