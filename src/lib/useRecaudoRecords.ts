import { useCallback, useEffect, useState } from 'react';
import { supabase, runWithRetry } from '@/supabase';
import { logError } from '@/logger';
import { loadRecaudoShared } from '@/lib/recaudoStore';

// Pagos del recaudo bancario ya cargados en "Seguimiento Recaudo" (tabla
// recaudo_historico de Supabase). Aquí solo se LEEN; la carga y el reinicio
// siguen en RecaudoTracking.
export type RecaudoRecord = {
  id_registro_crm: string;
  estado_recibo: string;
  valor_liquidacion: number;
  fecha_pago: string;
  tipo_recaudo?: string;
};

export type RecaudoMeta = { fileName: string; uploadedAt: string; recordCount: number };

const CACHE_KEY = 'recaudo_historico_local_cache';

export function useRecaudoRecords() {
  const [records, setRecords] = useState<RecaudoRecord[]>([]);
  const [meta, setMeta] = useState<RecaudoMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let loaded = false;
    if (supabase) {
      try {
        const { data, error: dbError } = await runWithRetry<any[]>(async () => {
          const res = await supabase.from('recaudo_historico').select('*');
          return { data: res.data, error: res.error };
        });
        if (!dbError && data) {
          const metaRow = data.find((r) => r.id_registro_crm === 'METADATA_RECORD');
          setMeta(
            metaRow
              ? {
                  fileName: metaRow.archivo_origen || '-',
                  uploadedAt: `${metaRow.fecha_generacion_link || ''} ${metaRow.fecha_vencimiento_link || ''}`.trim(),
                  recordCount: Number(metaRow.valor_liquidacion) || 0,
                }
              : null
          );
          setRecords(data.filter((r) => r.id_registro_crm !== 'METADATA_RECORD'));
          loaded = true;
        } else if (dbError) {
          logError(dbError, 'useRecaudoRecords/load');
        }
      } catch (e) {
        logError(e as Error, 'useRecaudoRecords/loadException');
      }
    }
    if (!supabase) {
      // Sin Supabase en este despliegue, el recaudo vive en Firestore (lo
      // comparte "Seguimiento Recaudo"; ver recaudoStore.ts).
      try {
        const shared = await loadRecaudoShared<RecaudoRecord>();
        setRecords(shared.records);
        setMeta(
          shared.meta
            ? { fileName: shared.meta.fileName || '-', uploadedAt: `${shared.meta.uploadedAtDate || ''} ${shared.meta.uploadedAtTime || ''}`.trim(), recordCount: shared.meta.recordCount }
            : null
        );
        loaded = true;
      } catch (e) {
        logError(e as Error, 'useRecaudoRecords/sharedLoad');
      }
    }
    if (!loaded) {
      // Sin conexión con Supabase: se usa la última copia que guardó
      // Seguimiento Recaudo en este navegador, si existe.
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          setRecords(JSON.parse(cached));
          setError('No se pudo consultar el recaudo en línea; se muestra la última copia guardada en este navegador.');
        } else {
          setError('No se pudo consultar el recaudo bancario. Intenta de nuevo en unos minutos.');
        }
      } catch {
        setError('No se pudo consultar el recaudo bancario.');
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { records, meta, loading, error, reload: load };
}
