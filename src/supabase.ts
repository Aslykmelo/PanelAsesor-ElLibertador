import { createClient } from '@supabase/supabase-js';

export interface SupabaseHealthStatus {
  status: 'ok' | 'error' | 'not_configured';
  message: string;
  url: string;
  keyExists: boolean;
  checkedAt: string;
  isIframeSandbox: boolean;
  isCorsLikely: boolean;
  isTimeout: boolean;
  isAbort: boolean;
  isCustomFetchInterceptor: boolean;
  errorDetails?: {
    status?: number;
    statusText?: string;
    message?: string;
    stack?: string;
    urlAttempted?: string;
    elapsedMs?: number;
    cause?: string;
  };
}

// Global state to cache the connection health status
let cachedHealthStatus: SupabaseHealthStatus | null = null;
let isSupabaseOffline = false;

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

// Create a single client instance (Singleton Pattern)
let clientInstance: any = null;

if (isSupabaseConfigured) {
  try {
    clientInstance = createClient(url, key, {
      auth: {
        persistSession: false
      }
    });
    console.log("🔌 SUPABASE SYSTEM: Supabase client singleton instantiated successfully.");
  } catch (initErr) {
    console.error("❌ SUPABASE SYSTEM: Error instantiating Supabase client:", initErr);
  }
} else {
  console.warn(
    "⚠️ SUPABASE SYSTEM: Supabase credentials are not configured.\n" +
    "The application will run in standard fallbacks / LocalStorage cache mode.\n" +
    "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables."
  );
}

export const supabase = clientInstance;

/**
 * Executes a health check to detect connectivity issues, CORS, sandboxing, and timeouts.
 */
export async function runSupabaseHealthCheck(forceRefresh = false): Promise<SupabaseHealthStatus> {
  if (cachedHealthStatus && !forceRefresh) {
    return cachedHealthStatus;
  }

  const checkedAt = new Date().toISOString();
  const isIframeSandbox = typeof window !== 'undefined' && (
    window.self !== window.top || window.origin === 'null' || document.domain === ''
  );
  
  const isCustomFetchInterceptor = typeof window !== 'undefined' && 
    typeof window.fetch === 'function' && 
    !/\{\s*\[native code\]\s*\}/.test(window.fetch.toString());

  const resultTemplate: SupabaseHealthStatus = {
    status: 'error',
    message: 'Pending validation',
    url: url || 'None',
    keyExists: !!key,
    checkedAt,
    isIframeSandbox,
    isCorsLikely: false,
    isTimeout: false,
    isAbort: false,
    isCustomFetchInterceptor
  };

  if (!isSupabaseConfigured) {
    const res: SupabaseHealthStatus = {
      ...resultTemplate,
      status: 'not_configured',
      message: 'Supabase no está configurado en las variables de entorno.'
    };
    cachedHealthStatus = res;
    isSupabaseOffline = true;
    return res;
  }

  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000); // 6-second timeout for health check

  try {
    // Phase 1: Test basic HTTP ping to Supabase Rest API base url
    const pingUrl = `${url}/rest/v1/`;
    let response: Response | null = null;
    let pingError: any = null;

    try {
      response = await fetch(pingUrl, {
        method: 'GET',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (err: any) {
      clearTimeout(timeoutId);
      pingError = err;
    }

    const elapsedMs = Math.round(performance.now() - startTime);

    if (pingError) {
      const isAbort = pingError.name === 'AbortError';
      const isTimeout = isAbort && (performance.now() - startTime >= 5500);
      const isCorsLikely = !isTimeout && !isAbort && (
        pingError.message?.includes('Failed to fetch') || 
        pingError.message?.includes('NetworkError') ||
        pingError instanceof TypeError
      );

      let cause = "Desconocida";
      if (isTimeout) cause = "Tiempo de espera agotado (Timeout > 6s)";
      else if (isAbort) cause = "Petición cancelada (AbortController)";
      else if (isCorsLikely) {
        cause = isIframeSandbox 
          ? "Bloqueo de red por iframe sandboxed en Google AI Studio (CORS / CSP)"
          : "Fallo de red o políticas de CORS en el servidor de Supabase";
      } else if (pingError.message) {
        cause = pingError.message;
      }

      const res: SupabaseHealthStatus = {
        ...resultTemplate,
        status: 'error',
        message: 'Error de conexión básico',
        isTimeout,
        isAbort,
        isCorsLikely,
        errorDetails: {
          message: pingError.message || String(pingError),
          stack: pingError.stack,
          urlAttempted: pingUrl,
          elapsedMs,
          cause
        }
      };
      cachedHealthStatus = res;
      isSupabaseOffline = true;
      return res;
    }

    // Phase 2: Query the actual table 'recaudo_historico' to make sure table is readable
    const tableStartTime = performance.now();
    const { data: tableData, error: tableError, status: httpStatus } = await supabase
      .from('recaudo_historico')
      .select('id_registro_crm')
      .limit(1);

    const tableElapsedMs = Math.round(performance.now() - tableStartTime);
    const totalElapsedMs = Math.round(performance.now() - startTime);

    if (tableError) {
      let cause = "Fallo al consultar la tabla recaudo_historico";
      if (tableError.code === 'PGRST116') cause = "Tabla no encontrada o sin permisos";
      else if (tableError.message) cause = tableError.message;

      const res: SupabaseHealthStatus = {
        ...resultTemplate,
        status: 'error',
        message: 'Conexión establecida pero fallo en consulta de datos',
        errorDetails: {
          status: httpStatus || 400,
          statusText: tableError.code,
          message: tableError.message,
          urlAttempted: `${url}/rest/v1/recaudo_historico`,
          elapsedMs: totalElapsedMs,
          cause
        }
      };
      cachedHealthStatus = res;
      isSupabaseOffline = true;
      return res;
    }

    // Success!
    const res: SupabaseHealthStatus = {
      ...resultTemplate,
      status: 'ok',
      message: 'Supabase conectado',
      errorDetails: {
        status: 200,
        statusText: 'OK',
        message: 'Conexión exitosa y lectura de tabla correcta.',
        urlAttempted: `${url}/rest/v1/recaudo_historico`,
        elapsedMs: totalElapsedMs,
        cause: 'Ninguna (Operación exitosa)'
      }
    };
    cachedHealthStatus = res;
    isSupabaseOffline = false;
    return res;

  } catch (globalErr: any) {
    clearTimeout(timeoutId);
    const elapsedMs = Math.round(performance.now() - startTime);
    const res: SupabaseHealthStatus = {
      ...resultTemplate,
      status: 'error',
      message: 'Excepción crítica inesperada en Health Check',
      errorDetails: {
        message: globalErr.message || String(globalErr),
        stack: globalErr.stack,
        elapsedMs,
        cause: 'Excepción de ejecución del navegador'
      }
    };
    cachedHealthStatus = res;
    isSupabaseOffline = true;
    return res;
  }
}

/**
 * Executes a Supabase query with automatic retries and delay.
 * Skips retries if Supabase is determined offline/unreachable to prevent long hangs.
 */
export async function runWithRetry<T>(
  fn: () => Promise<{ data: T | null; error: any }>,
  retries = 3,
  delayMs = 1500
): Promise<{ data: T | null; error: any }> {
  // If we already know Supabase is offline from previous health check, don't spam requests
  if (isSupabaseOffline && retries > 1) {
    console.warn("⚠️ SUPABASE RETRY: Supabase has been flagged as offline. Skipping redundant retries.");
    retries = 1; // Only try once
  }

  let lastError: any = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const startTime = performance.now();
    try {
      const result = await fn();
      if (!result.error) {
        return result;
      }
      lastError = result.error;
      console.warn(
        `⚠️ Supabase attempt failed (${attempt}/${retries}). ` +
        `Error: ${result.error.message || JSON.stringify(result.error)}`
      );
    } catch (err: any) {
      lastError = err;
      console.warn(`❌ Supabase exception thrown (${attempt}/${retries}):`, err);
    }
    
    // Check if it's a structural error (like table missing) where retry won't help
    if (lastError?.code && ['PGRST116', '42P01', '42501'].includes(lastError.code)) {
      console.warn(`🛑 Structural error detected (${lastError.code}). Aborting retries.`);
      break;
    }

    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return { data: null, error: lastError || new Error("Failed after maximum retry attempts") };
}
