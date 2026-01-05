import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const getSupabaseServerClient = (): SupabaseClient | null => {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[supabase] Server client not configured: missing URL or anon key');
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
};

export { getSupabaseServerClient };

