import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

/**
 * Browser-only Supabase client factory with persistent sessions.
 *
 * Returns null during SSR/build to avoid env access on the server.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  if (typeof window === 'undefined') return null;

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[supabase] Browser client not configured: missing URL or anon key');
    return null;
  }

  cachedClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
    },
  });

  return cachedClient;
}

