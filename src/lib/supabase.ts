import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl: string | undefined = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const SUPABASE_CONFIG_OK = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = SUPABASE_CONFIG_OK
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

if (!SUPABASE_CONFIG_OK) {
  console.error(
    "Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (restart dev server after adding .env.local).",
  );
}
