import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

// Singleton instance to prevent multiple GoTrueClient instances
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

// Create browser client for SSR support (singleton)
export const createClient = () => {
  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient(
      supabaseUrl,
      supabaseKey,
    );
  }
  return supabaseInstance;
};

// Export singleton instance directly
export const supabase = createClient();
