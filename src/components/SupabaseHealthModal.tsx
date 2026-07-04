import { useState } from 'react';
import { 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Info, 
  Clock, 
  ExternalLink,
  ShieldAlert,
  Terminal,
  HelpCircle
} from 'lucide-react';
import { SupabaseHealthStatus, runSupabaseHealthCheck } from '@/supabase';
import { Button } from '@/components/ui/button';

interface SupabaseHealthModalProps {
  health: SupabaseHealthStatus | null;
  onRefresh: (newHealth: SupabaseHealthStatus) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function SupabaseHealthModal({ health, onRefresh, isOpen, onClose }: SupabaseHealthModalProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!isOpen) return null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await runSupabaseHealthCheck(true);
      onRefresh(res);
    } catch (e) {
      console.error("Error refreshing health check:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const statusColors = {
    ok: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/20',
      border: 'border-emerald-500/20',
      text: 'text-emerald-800 dark:text-emerald-200',
      icon: <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
    },
    error: {
      bg: 'bg-rose-50 dark:bg-rose-950/20',
      border: 'border-rose-500/20',
      text: 'text-rose-800 dark:text-rose-200',
      icon: <XCircle className="w-8 h-8 text-rose-500 shrink-0" />
    },
    not_configured: {
      bg: 'bg-slate-50 dark:bg-slate-900',
      border: 'border-slate-200 dark:border-slate-800',
      text: 'text-slate-800 dark:text-slate-200',
      icon: <AlertTriangle className="w-8 h-8 text-amber-500 shrink-0" />
    }
  };

  const currentStyle = health ? statusColors[health.status] : statusColors.not_configured;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-card border border-border rounded-[1.8rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 bg-muted/20 border-b border-border/15">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-primary" />
            <span className="font-extrabold text-sm tracking-wider uppercase">Diagnóstico Supabase</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-colors"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar text-xs">
          
          {/* STATE BANNER */}
          {health && (
            <div className={`p-5 rounded-2xl border ${currentStyle.bg} ${currentStyle.border} ${currentStyle.text} flex items-start gap-4 shadow-sm`}>
              {currentStyle.icon}
              <div className="space-y-1">
                <p className="font-extrabold uppercase tracking-widest text-[10px]">Estado de Conexión</p>
                <h3 className="text-sm font-black leading-snug">
                  {health.status === 'ok' && "✅ Supabase Conectado Exitosamente"}
                  {health.status === 'error' && "❌ Error de Conexión Detectado"}
                  {health.status === 'not_configured' && "⚠️ Supabase No Configurado"}
                </h3>
                <p className="text-[11px] opacity-90 font-medium">
                  {health.message}
                </p>
              </div>
            </div>
          )}

          {/* ENVIRONMENT CONFIG */}
          <div className="bg-muted/10 border border-border/30 rounded-2xl p-5 space-y-4">
            <h4 className="font-bold text-xs flex items-center gap-2 border-b border-border/20 pb-2">
              <Info className="w-4 h-4 text-primary" /> Parámetros del Entorno
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-muted-foreground font-semibold">URL de Supabase:</p>
                <code className="block p-2 rounded-lg bg-muted text-[10px] break-all border border-border/10 font-mono font-bold select-all text-card-foreground">
                  {health?.url || 'No especificada'}
                </code>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground font-semibold">API Key Anon:</p>
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${health?.keyExists ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                    {health?.keyExists ? 'Existente (Presente)' : 'Faltante (Ausente)'}
                  </span>
                  <span className="text-muted-foreground text-[10px] italic">
                    ({health?.keyExists ? 'VITE_SUPABASE_ANON_KEY cargada' : 'Variables vacías'})
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* DIAGNOSTIC CAPABILITIES / ENVIRONMENT ANALYSIS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* AMBIENTE PREVIEW */}
            <div className="bg-muted/10 border border-border/30 rounded-2xl p-4 space-y-3">
              <h5 className="font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-primary" /> Análisis de Contexto
              </h5>
              <ul className="space-y-2 font-medium text-muted-foreground">
                <li className="flex items-center justify-between">
                  <span>En Google AI Studio Preview:</span>
                  <span className={`font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-md ${health?.isIframeSandbox ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/15 text-emerald-500'}`}>
                    {health?.isIframeSandbox ? 'Sí (Iframe Sandboxed)' : 'No (Pestaña nueva / Prod)'}
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span>¿Bloqueo CORS/CSP probable?:</span>
                  <span className={`font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-md ${health?.isCorsLikely ? 'bg-rose-500/15 text-rose-500' : 'bg-emerald-500/15 text-emerald-500'}`}>
                    {health?.isCorsLikely ? 'Sí (CORS / Network Block)' : 'No detectado'}
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Timeout en red (&gt;6s):</span>
                  <span className={`font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-md ${health?.isTimeout ? 'bg-rose-500/15 text-rose-500' : 'bg-emerald-500/15 text-emerald-500'}`}>
                    {health?.isTimeout ? 'Sí' : 'No'}
                  </span>
                </li>
              </ul>
            </div>

            {/* FETCH INTERCEPTORS */}
            <div className="bg-muted/10 border border-border/30 rounded-2xl p-4 space-y-3">
              <h5 className="font-bold flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-primary" /> Verificación del Motor
              </h5>
              <ul className="space-y-2 font-medium text-muted-foreground">
                <li className="flex items-center justify-between">
                  <span>Petición Cancelada (Abort):</span>
                  <span className={`font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-md ${health?.isAbort ? 'bg-amber-500/15 text-amber-500' : 'bg-emerald-500/15 text-emerald-500'}`}>
                    {health?.isAbort ? 'Sí' : 'No'}
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Fetch customizado / interceptado:</span>
                  <span className={`font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-md ${health?.isCustomFetchInterceptor ? 'bg-amber-500/15 text-amber-500' : 'bg-emerald-500/15 text-emerald-500'}`}>
                    {health?.isCustomFetchInterceptor ? 'Sí (Modificado)' : 'No (Nativo)'}
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Singleton Instanciado:</span>
                  <span className="font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-500">
                    SÍ (Garantizado)
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* DETAILED ROOT CAUSE / ERROR STACK */}
          {health?.status === 'error' && health.errorDetails && (
            <div className="bg-rose-500/5 border border-rose-500/15 rounded-2xl p-5 space-y-4">
              <h4 className="font-bold text-rose-800 dark:text-rose-400 flex items-center gap-2 border-b border-rose-500/10 pb-2">
                <ShieldAlert className="w-4 h-4 shrink-0" /> Diagnóstico de Causa Real
              </h4>
              
              <div className="space-y-3 font-medium">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-muted-foreground text-[10px]">HTTP STATUS CODE</span>
                    <p className="font-bold text-card-foreground text-sm">{health.errorDetails.status || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px]">TIEMPO ELAPSADO</span>
                    <p className="font-bold text-card-foreground text-sm flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" /> {health.errorDetails.elapsedMs} ms
                    </p>
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground text-[10px]">CAUSA IDENTIFICADA</span>
                  <div className="p-3 bg-rose-500/10 border border-rose-500/10 rounded-xl text-rose-900 dark:text-rose-200 font-bold leading-normal mt-0.5 text-[11px]">
                    {health.errorDetails.cause}
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground text-[10px]">URL ENDPOINT INTENTADA</span>
                  <code className="block p-1.5 rounded-lg bg-muted text-[10px] break-all border border-border/10 font-mono text-card-foreground mt-0.5">
                    {health.errorDetails.urlAttempted}
                  </code>
                </div>

                {health.errorDetails.message && (
                  <div>
                    <span className="text-muted-foreground text-[10px]">MENSAJE ORIGINAL DE EXCEPCIÓN</span>
                    <pre className="p-3 bg-muted text-rose-600 dark:text-rose-400 font-mono text-[10px] rounded-xl overflow-x-auto border border-border/10 leading-normal mt-0.5">
                      {health.errorDetails.message}
                    </pre>
                  </div>
                )}

                {health.errorDetails.stack && (
                  <div>
                    <span className="text-muted-foreground text-[10px]">PILA DE EJECUCIÓN (STACK TRACE)</span>
                    <pre className="p-3 bg-muted text-card-foreground/70 font-mono text-[9px] rounded-xl overflow-x-auto max-h-40 border border-border/10 leading-relaxed mt-0.5 scrollbar-thin">
                      {health.errorDetails.stack}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SANDBOX SUGGESTIONS */}
          {health?.isIframeSandbox && (
            <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl p-5 space-y-2">
              <h4 className="font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 shrink-0" /> ¿Cómo solucionar el error de Sandbox/CORS en Google AI Studio?
              </h4>
              <p className="text-muted-foreground leading-relaxed">
                El entorno de edición y previsualización de <strong>Google AI Studio</strong> ejecuta la aplicación dentro de un <code>iframe</code> altamente protegido y sandboxeado. 
                Por motivos de seguridad del navegador, este sandbox suele bloquear las peticiones externas dirigidas a dominios de terceros como Supabase (<code>supabase.co</code>).
              </p>
              <div className="p-3.5 bg-amber-500/10 rounded-xl font-bold text-amber-900 dark:text-amber-200 leading-normal text-[11px] flex flex-col gap-2">
                <p>💡 Solución de visualización:</p>
                <p className="font-medium">
                  Haga clic en el botón de la esquina superior derecha del Preview para <strong>abrir la aplicación en una pestaña nueva</strong> fuera del iframe. Al ejecutarse directamente en el dominio principal del navegador, el sandbox se desactivará y la conexión con Supabase se establecerá con total normalidad.
                </p>
              </div>
            </div>
          )}

          {/* DIAGNOSTIC COMPLETED TIME */}
          {health?.checkedAt && (
            <p className="text-[10px] text-muted-foreground text-center italic">
              Último diagnóstico ejecutado: {new Date(health.checkedAt).toLocaleDateString()} a las {new Date(health.checkedAt).toLocaleTimeString()}
            </p>
          )}

        </div>

        {/* FOOTER ACTIONS */}
        <div className="px-6 py-4 bg-muted/20 border-t border-border/15 flex flex-col sm:flex-row gap-3 justify-between items-center">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            Persistencia de Respaldo Local (LocalStorage Cache) Activa
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="gap-1.5 rounded-xl font-bold w-full sm:w-auto border border-border/50 text-card-foreground"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Verificando...' : 'Re-ejecutar Diagnóstico'}
            </Button>
            
            <Button
              size="sm"
              onClick={onClose}
              className="rounded-xl font-bold w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
