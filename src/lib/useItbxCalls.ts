import { useCallback, useState } from 'react';
import { getExtensionCallTotalsForDate, recentDateOptions, todayKey } from '@/lib/itbxCache';

// Llamadas del asesor según su extensión de ITBX: total y contestadas del día
// elegido, más las contestadas de HOY (para la barra de metas, que siempre
// mide el día en curso). No carga nada solo al montar — el botón único de
// "Actualizar" (en Profile.tsx / DashboardAdvisor.tsx) es quien decide
// cuándo consultar, para que abrir la app no cuente como una actualización.
export function useItbxCalls(extension?: string) {
  const dateOptions = recentDateOptions(7);
  const [date, setDateState] = useState(dateOptions[0]?.key ?? todayKey());
  const [total, setTotal] = useState<number | null>(null);
  const [answered, setAnswered] = useState<number | null>(null);
  const [todayAnswered, setTodayAnswered] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(
    async (forDate: string) => {
      if (!extension) return;
      setLoading(true);
      setError(false);
      try {
        const selected = await getExtensionCallTotalsForDate(forDate);
        setTotal(selected.totals[extension] ?? 0);
        setAnswered(selected.answered[extension] ?? 0);
        const today = todayKey();
        if (forDate === today) {
          setTodayAnswered(selected.answered[extension] ?? 0);
        } else {
          const t = await getExtensionCallTotalsForDate(today);
          setTodayAnswered(t.answered[extension] ?? 0);
        }
      } catch (e) {
        console.error('Error al consultar llamadas ITBX:', e);
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [extension]
  );

  // Cambiar de día es una acción explícita del asesor (viendo un día ya
  // consolidado, casi siempre ya en caché) — no pasa por el enfriamiento del
  // botón "Actualizar".
  const changeDate = (newDate: string) => {
    setDateState(newDate);
    load(newDate);
  };

  // Llamado por el botón único de "Actualizar" del componente padre, que ya
  // controla su propio enfriamiento de 5 minutos.
  const refresh = () => load(date);

  return { dateOptions, date, setDate: changeDate, total, answered, todayAnswered, loading, error, refresh };
}
