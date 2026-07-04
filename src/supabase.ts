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

/**
 * Executes a Supabase query with automatic retries and delay.
 * Useful for handling temporary connection drops, CORS issues in sandboxed frames,
 * or rate limits.
 */
export async function runWithRetry<T>(
  fn: () => Promise<{ data: T | null; error: any }>,
  retries = 3,
  delayMs = 1500
): Promise<{ data: T | null; error: any }> {
  let lastError: any = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await fn();
      if (!result.error) {
        return result;
      }
      lastError = result.error;
      console.warn(`Supabase operation failed (Attempt ${attempt}/${retries}):`, result.error);
    } catch (err: any) {
      lastError = err;
      console.warn(`Supabase operation threw exception (Attempt ${attempt}/${retries}):`, err);
    }
    
    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return { data: null, error: lastError || new Error("Failed after maximum retry attempts") };
}
