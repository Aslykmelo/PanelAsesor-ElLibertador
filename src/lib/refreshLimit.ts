import { db } from '@/firebase';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

// Tope diario de refrescos manuales del contador de conversaciones activas,
// por asesor. El enfriamiento de 60s en el botón ya evita el peor caso
// (alguien dándole clic sin parar), pero esto pone un límite real y
// verificable — vive en Firestore, no en el navegador, así que no se salta
// recargando la página, en incógnito, ni cambiando de dispositivo.
export const DAILY_REFRESH_LIMIT = 20;

function todayKey(): string {
  // Fecha del navegador del asesor — suficiente para este propósito (no es
  // un límite de seguridad, es para no gastar la cuota de invocaciones).
  return new Date().toISOString().slice(0, 10);
}

export type RefreshLimitResult = { allowed: boolean; count: number; limit: number };

// Intenta consumir un refresco del cupo diario. Si ya se llegó al tope,
// NO incrementa y devuelve allowed:false — el llamador no debe disparar la
// consulta real (así es como de verdad se ahorra la invocación).
export async function tryConsumeDailyRefresh(email: string): Promise<RefreshLimitResult> {
  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail) return { allowed: false, count: 0, limit: DAILY_REFRESH_LIMIT };

  const ref = doc(db, 'refresh_usage', normalizedEmail, 'days', todayKey());

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    const current = snap.exists() ? (snap.data().count as number) ?? 0 : 0;

    if (current >= DAILY_REFRESH_LIMIT) {
      return { allowed: false, count: current, limit: DAILY_REFRESH_LIMIT };
    }

    transaction.set(ref, { count: current + 1, updatedAt: serverTimestamp() }, { merge: true });
    return { allowed: true, count: current + 1, limit: DAILY_REFRESH_LIMIT };
  });
}
