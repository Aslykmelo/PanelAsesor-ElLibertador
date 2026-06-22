import { createClient } from '@supabase/supabase-js';

// Access Supabase variables safely for both Vite (client-side) and Node (server-side context)
const getSupabaseConfig = () => {
  // Client-side Vite environment
  // @ts-ignore
  let url = typeof window !== 'undefined' ? import.meta.env.VITE_SUPABASE_URL : undefined;
  // @ts-ignore
  let key = typeof window !== 'undefined' ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined;

  // Server-side Node environment / SSR / Fallbacks
  if (!url && typeof process !== 'undefined' && process.env) {
    url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  }
  if (!key && typeof process !== 'undefined' && process.env) {
    key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  }

  return {
    url: url?.trim() || '',
    key: key?.trim() || ''
  };
};

const { url, key } = getSupabaseConfig();

export const isSupabaseConfigured = !!url && !!key;

// Initialize the client. If not configured, we export a null client or a proxy that doesn't blow up.
export const supabase = isSupabaseConfigured 
  ? createClient(url, key, {
      auth: {
        persistSession: false
      }
    })
  : null;

if (!isSupabaseConfigured) {
  console.warn(
    "⚠️ SUPABASE SYSTEM: Supabase credentials are not configured yet.\n" +
    "The application will run in standard Firebase / LocalStorage fallback mode.\n" +
    "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment to enable Supabase integration."
  );
}
