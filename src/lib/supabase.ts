import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

// Create browser client for SSR support
export const createClient = () =>
  createBrowserClient(
    supabaseUrl,
    supabaseKey,
  );

// Create standard client (alternative)
export const supabase = createSupabaseClient(supabaseUrl, supabaseKey);
