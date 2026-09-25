import { useCallback, useEffect, useState } from 'react';
import {
  getExtensionCallTotalsForDate,
  MANUAL_REFRESH_MAX_AGE_MS,
  recentDateOptions,
  todayKey,
} from '@/lib/itbxCache';

const REFRESH_COOLDOWN_MS = 60_000;

// Llamadas del asesor según su extensión de ITBX: total y contestadas del día
// elegido, más las contestadas de HOY (para la barra de metas, que siempre
// mide el día en curso). Comparte la caché de Firestore con todos los
// asesores; "refresh" la salta solo si tiene más de 3 min.
export function useItbxCalls(extension?: string) {
  const dateOptions = recentDateOptions(7);
  const [date, setDate] = useState(dateOptions[0]?.key ?? todayKey());
  const [total, setTotal] = useState<number | null>(null);
  const [answered, setAnswered] = useState<number | null>(null);
  const [todayAnswered, setTodayAnswered] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const load = useCallback(
    async (maxAgeMs?: number) => {
      if (!extension) return;
      setLoading(true);
      setError(false);
      try {
        const selected = await getExtensionCallTotalsForDate(date, maxAgeMs);
        setTotal(selected.totals[extension] ?? 0);
        setAnswered(selected.answered[extension] ?? 0);
        const today = todayKey();
        if (date === today) {
          setTodayAnswered(selected.answered[extension] ?? 0);
        } else {
          const t = await getExtensionCallTotalsForDate(today, maxAgeMs);
          setTodayAnswered(t.answered[extension] ?? 0);
        }
      } catch (e) {
        console.error('Error al consultar llamadas ITBX:', e);
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [extension, date]
  );

  useEffect(() => {
    load();
  }, [load]);

  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  const refresh = () => {
    if (loading || cooldownLeft > 0) return;
    setNow(Date.now());
    setCooldownUntil(Date.now() + REFRESH_COOLDOWN_MS);
    load(MANUAL_REFRESH_MAX_AGE_MS);
  };

  return { dateOptions, date, setDate, total, answered, todayAnswered, loading, error, refresh, cooldownLeft };
}
