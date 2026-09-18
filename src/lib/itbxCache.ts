import { db } from '@/firebase';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

// ITBX pidió explícitamente evitar consultas frecuentes/repetitivas a su
// API. En vez de que cada uno de los asesores dispare su propia consulta
// (el reporte ya trae TODAS las extensiones en una sola llamada), el
// primero que lo necesite en el día trae el dato y lo deja en esta caché
// compartida en Firestore; el resto simplemente la lee mientras siga
// fresca — así, sin importar cuántos asesores entren, el consumo real
// contra ITBX queda acotado a unas pocas veces por franja de tiempo.
const CACHE_FRESH_MS = 10 * 60 * 1000; // 10 minutos

// daysAgo=0 -> hoy, 1 -> ayer, etc. (hora de Bogotá).
export function dateKeyDaysAgo(daysAgo: number): string {
  const bogota = new Date(Date.now() - 5 * 60 * 60 * 1000 - daysAgo * 24 * 60 * 60 * 1000);
  const y = bogota.getUTCFullYear();
  const m = String(bogota.getUTCMonth() + 1).padStart(2, '0');
  const d = String(bogota.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayKey(): string {
  return dateKeyDaysAgo(0);
}

// Últimos `count` días (incluyendo hoy), más recientes primero — para
// poblar el selector de día del panel del asesor.
export function recentDateOptions(count: number = 7): { key: string; label: string }[] {
  const labels = ['Hoy', 'Ayer'];
  return Array.from({ length: count }, (_, i) => {
    const key = dateKeyDaysAgo(i);
    const label = labels[i] ?? new Date(key + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
    return { key, label };
  });
}

export type ExtensionCallStats = {
  totals: Record<string, number>;
  answered: Record<string, number>;
};

// Instante (ms) en que terminó el día `dateKey` en hora de Bogotá (UTC-5).
function endOfDayMs(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Date.UTC(y, m - 1, d + 1, 5, 0, 0);
}

// Se deja elegir el día a consultar (ver selector en Profile.tsx /
// DashboardAdvisor.tsx), no solo "hoy". Un día que ya pasó no vuelve a
// cambiar, así que su caché no vence nunca — siempre que se haya guardado
// después de que el día terminó (si se guardó a media jornada, está
// incompleta y se vuelve a pedir). Solo el día de hoy usa la ventana de
// 10 min. Documentos viejos sin el campo `answered` se ignoran.
export async function getExtensionCallTotalsForDate(dateKey: string): Promise<ExtensionCallStats> {
  const ref = doc(db, 'itbx_cache', dateKey);
  const snap = await getDoc(ref);
  const isToday = dateKey === todayKey();

  if (snap.exists() && snap.data().answered) {
    const cached = snap.data();
    const fetchedAtMs = (cached.fetchedAt as Timestamp | undefined)?.toMillis();
    const usable = isToday
      ? fetchedAtMs !== undefined && Date.now() - fetchedAtMs < CACHE_FRESH_MS
      : fetchedAtMs !== undefined && fetchedAtMs >= endOfDayMs(dateKey);
    if (usable) {
      return {
        totals: (cached.data as Record<string, number>) ?? {},
        answered: (cached.answered as Record<string, number>) ?? {},
      };
    }
  }

  const res = await fetch(`/api/itbx/traffic-today?date=${encodeURIComponent(dateKey)}`);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error || 'No fue posible consultar ITBX');
  }

  const totals: Record<string, number> = json.data ?? {};
  const answered: Record<string, number> = json.answered ?? {};
  await setDoc(ref, { data: totals, answered, fetchedAt: serverTimestamp() }).catch(() => {
    // Si falla el guardado de la caché no es grave — el dato ya se obtuvo,
    // simplemente el próximo asesor no se beneficia de la caché esta vez.
  });
  return { totals, answered };
}
