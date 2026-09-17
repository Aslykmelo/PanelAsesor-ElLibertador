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

function todayKey(): string {
  const bogota = new Date(Date.now() - 5 * 60 * 60 * 1000);
  const y = bogota.getUTCFullYear();
  const m = String(bogota.getUTCMonth() + 1).padStart(2, '0');
  const d = String(bogota.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function getExtensionCallTotalsToday(): Promise<Record<string, number>> {
  const ref = doc(db, 'itbx_cache', todayKey());
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const fetchedAt = snap.data().fetchedAt as Timestamp | undefined;
    const ageMs = fetchedAt ? Date.now() - fetchedAt.toMillis() : Infinity;
    if (ageMs < CACHE_FRESH_MS) {
      return (snap.data().data as Record<string, number>) ?? {};
    }
  }

  const res = await fetch('/api/itbx/traffic-today');
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
