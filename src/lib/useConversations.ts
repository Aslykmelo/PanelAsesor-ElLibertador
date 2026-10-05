import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import { todayKey } from '@/lib/itbxCache';
import { readSaved, writeSaved } from '@/lib/savedStats';

interface ConversationUser {
  email: string;
  name?: string;
  supervisorEmail?: string;
  cartera?: string;
}

// Conversaciones activas/cerradas hoy en Infobip, para el propio asesor.
// Cada vez que se consulta, el resultado se guarda en Firestore bajo su
// propio correo (las reglas solo dejan escribir el documento propio) —
// así el equipo puede ver el avance de sus compañeros en "Mi Equipo" sin
// que eso dispare ninguna consulta adicional a Infobip.
//
// Si la consulta falla (Infobip limita las peticiones cuando muchos asesores
// entran a la vez) NO se borra el último dato: se sigue mostrando el que ya
// se tenía (guardado en el navegador o en el documento de Firestore del
// propio asesor) y se avisa con `error`.
export function useConversations(user: ConversationUser) {
  const email = (user.email || '').toLowerCase();
  const savedKey = `panel:conv:${email}`;
  const [active, setActive] = useState<number | null>(() => readSaved<{ active: number }>(savedKey)?.active ?? null);
  const [closedToday, setClosedToday] = useState<number | null>(() => readSaved<{ closedToday: number }>(savedKey)?.closedToday ?? null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(() => readSaved<object>(savedKey)?.at ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Sin dato en el navegador (otro equipo, caché borrada): se toma el último
  // guardado en Firestore, siempre que sea de hoy.
  useEffect(() => {
    if (!email || closedToday !== null) return;
    let cancelled = false;
    getDoc(doc(db, 'conversation_stats', email))
      .then((snap) => {
        if (cancelled || !snap.exists()) return;
        const d = snap.data();
        const ts = (d.updatedAt as Timestamp | undefined)?.toMillis();
        if (ts === undefined || new Date(ts - 5 * 60 * 60 * 1000).toISOString().slice(0, 10) !== todayKey()) return;
        setActive((prev) => prev ?? (typeof d.active === 'number' ? d.active : null));
        setClosedToday((prev) => prev ?? (typeof d.closedToday === 'number' ? d.closedToday : null));
        setUpdatedAt((prev) => prev ?? ts);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [email]);

  // Devuelve true si la consulta salió bien.
  const check = async (): Promise<boolean> => {
    if (!email) return true;
    setLoading(true);
    try {
      const res = await fetch(`/api/ngso/my-conversation-count?email=${encodeURIComponent(user.email)}&name=${encodeURIComponent(user.name || '')}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No fue posible consultar Infobip');
      setActive(data.active);
      setClosedToday(data.closedToday);
      setUpdatedAt(Date.now());
      setError(false);
      writeSaved(savedKey, { active: data.active, closedToday: data.closedToday });
      await setDoc(
        doc(db, 'conversation_stats', email),
        {
          email,
          name: user.name || '',
          supervisorEmail: (user.supervisorEmail || '').toLowerCase(),
          cartera: user.cartera || '',
          active: data.active,
          closedToday: data.closedToday,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch((e) => console.error('Error al compartir conversaciones con el equipo:', e));
      return true;
    } catch (e) {
      console.error('Error al consultar conversaciones activas:', e);
      setError(true);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { active, closedToday, updatedAt, loading, error, check };
}
