import { useCallback, useEffect, useRef, useState } from 'react';
import { getExtensionCallTotalsForDate, recentDateOptions, todayKey } from '@/lib/itbxCache';
import { readSaved, writeSaved } from '@/lib/savedStats';

type SavedCalls = { total?: number; answered?: number; todayAnswered?: number };

// Llamadas del asesor según su extensión de ITBX: total y contestadas del día
// elegido, más las contestadas de HOY (para la barra de metas, que siempre
// mide el día en curso). No carga nada solo al montar — quien lo usa
// (useMyDayStats) decide cuándo consultar, para que abrir la app no cuente
// como una actualización.
//
// Si ITBX falla no se borra el último dato: se sigue mostrando el que ya se
// tenía (guardado en el navegador o en la caché compartida) y `error` solo
// se enciende si no hay nada que mostrar.
export function useItbxCalls(extension?: string) {
  const dateOptions = recentDateOptions(7);
  const [date, setDateState] = useState(dateOptions[0]?.key ?? todayKey());
  const [total, setTotal] = useState<number | null>(null);
  const [answered, setAnswered] = useState<number | null>(null);
  const [todayAnswered, setTodayAnswered] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const savedKey = `panel:itbx:${extension || ''}`;
  const dateRef = useRef(date);
  dateRef.current = date;

  // Al abrir (o al llegar la extensión del perfil) se parte del último dato
  // de hoy guardado en este navegador, si lo hay.
  useEffect(() => {
    if (!extension) return;
    const saved = readSaved<SavedCalls>(savedKey);
    if (!saved) return;
    if (saved.todayAnswered !== undefined) setTodayAnswered((prev) => prev ?? saved.todayAnswered!);
    if (dateRef.current === todayKey()) {
      if (saved.total !== undefined) setTotal((prev) => prev ?? saved.total!);
      if (saved.answered !== undefined) setAnswered((prev) => prev ?? saved.answered!);
    }
    setUpdatedAt((prev) => prev ?? saved.at);
  }, [extension]);

  // Devuelve true si el dato es fresco (no falló ni vino de una caché vieja).
  const load = useCallback(
    async (forDate: string): Promise<boolean> => {
      if (!extension) return true;
      setLoading(true);
      setFailed(false);
      try {
        const today = todayKey();
        const selected = await getExtensionCallTotalsForDate(forDate);
        const t = selected.totals[extension] ?? 0;
        const a = selected.answered[extension] ?? 0;
        let stale = !!selected.stale;
        let todayA = a;
        if (forDate !== today) {
          const td = await getExtensionCallTotalsForDate(today);
          todayA = td.answered[extension] ?? 0;
          stale = stale || !!td.stale;
        }
        setTotal(t);
        setAnswered(a);
        setTodayAnswered(todayA);
        if (forDate === today) {
          writeSaved(savedKey, { total: t, answered: a, todayAnswered: todayA });
        } else {
          writeSaved(savedKey, { ...(readSaved<SavedCalls>(savedKey) ?? {}), todayAnswered: todayA });
        }
        if (!stale) setUpdatedAt(Date.now());
        return !stale;
      } catch (e) {
        console.error('Error al consultar llamadas ITBX:', e);
        setFailed(true);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [extension]
  );

  // Cambiar de día es una acción explícita del asesor (viendo un día ya
  // consolidado, casi siempre ya en caché) — no pasa por el enfriamiento del
  // botón "Actualizar". El número del día anterior se borra para no
  // mostrarlo como si fuera del día nuevo.
  const changeDate = (newDate: string) => {
    setDateState(newDate);
    dateRef.current = newDate;
    setTotal(null);
    setAnswered(null);
    load(newDate);
  };

  // Llamado por useMyDayStats, que ya controla el enfriamiento de 5 minutos.
  const refresh = () => load(dateRef.current);

  // "Error" solo si falló y no hay ningún dato que mostrar.
  const error = failed && total === null;

  return { dateOptions, date, setDate: changeDate, total, answered, todayAnswered, updatedAt, loading, error, failed, refresh };
}
