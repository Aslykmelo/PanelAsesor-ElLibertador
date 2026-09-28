import { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase';

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
export function useConversations(user: ConversationUser) {
  const [active, setActive] = useState<number | null>(null);
  const [closedToday, setClosedToday] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const check = async () => {
    if (!user.email) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ngso/my-conversation-count?email=${encodeURIComponent(user.email)}&name=${encodeURIComponent(user.name || '')}`);
      const data = await res.json();
      if (!res.ok) {
        setActive(null);
        setClosedToday(null);
        return;
      }
      setActive(data.active);
      setClosedToday(data.closedToday);
      await setDoc(
        doc(db, 'conversation_stats', user.email.toLowerCase()),
        {
          email: user.email.toLowerCase(),
          name: user.name || '',
          supervisorEmail: (user.supervisorEmail || '').toLowerCase(),
          cartera: user.cartera || '',
          active: data.active,
          closedToday: data.closedToday,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch((e) => console.error('Error al compartir conversaciones con el equipo:', e));
    } catch (e) {
      console.error('Error al consultar conversaciones activas:', e);
    } finally {
      setLoading(false);
    }
  };

  return { active, closedToday, loading, check };
}
