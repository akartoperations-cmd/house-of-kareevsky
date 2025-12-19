import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

/**
 * Browser-only Supabase client factory.
 *
 * Important: Next.js may prerender client components on the server during build.
 * To keep builds working even when env vars aren't present locally, this returns
 * null instead of throwing. (Netlify provides these env vars at build/runtime.)
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;

  // Only create the client in the browser.
  if (typeof window === 'undefined') return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  cachedClient = createClient(supabaseUrl, supabaseAnonKey);
  return cachedClient;
}







