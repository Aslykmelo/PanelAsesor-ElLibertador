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

// Se deja elegir el día a consultar (ver selector en Profile.tsx /
// DashboardAdvisor.tsx), no solo "hoy". Un día que ya pasó no vuelve a
// cambiar, así que su caché no vence nunca; solo el día de hoy usa la
// ventana de 10 min (sigue acumulando llamadas conforme avanza el día).
export async function getExtensionCallTotalsForDate(dateKey: string): Promise<Record<string, number>> {
  const ref = doc(db, 'itbx_cache', dateKey);
  const snap = await getDoc(ref);
  const isToday = dateKey === todayKey();

  if (snap.exists()) {
    if (!isToday) {
      return (snap.data().data as Record<string, number>) ?? {};
    }
    const fetchedAt = snap.data().fetchedAt as Timestamp | undefined;
    const ageMs = fetchedAt ? Date.now() - fetchedAt.toMillis() : Infinity;
    if (ageMs < CACHE_FRESH_MS) {
      return (snap.data().data as Record<string, number>) ?? {};
    }
  }

  const res = await fetch(`/api/itbx/traffic-today?date=${encodeURIComponent(dateKey)}`);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error || 'No fue posible consultar ITBX');
  }

  const data: Record<string, number> = json.data ?? {};
  await setDoc(ref, { data, fetchedAt: serverTimestamp() }).catch(() => {
    // Si falla el guardado de la caché no es grave — el dato ya se obtuvo,
    // simplemente el próximo asesor no se beneficia de la caché esta vez.
  });
  return data;
}

export async function getExtensionCallTotalsToday(): Promise<Record<string, number>> {
  return getExtensionCallTotalsForDate(todayKey());
}
