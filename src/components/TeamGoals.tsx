import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import { cn } from '@/lib/utils';
import { getDailyGoal } from '@/lib/goals';
import { todayKey } from '@/lib/itbxCache';
import { Users, MessageSquare } from 'lucide-react';
import { User } from '../types';

type TeammateStat = {
  email: string;
  name: string;
  closedToday: number | null;
  active: number | null;
  updatedAt?: Timestamp;
};

// Solo trae a los compañeros del MISMO supervisor — así lo restringen
// también las reglas de Firestore (ver conversation_stats en
// firestore.rules), no solo este query.
function useTeamConversations(supervisorEmail: string) {
  const [mates, setMates] = useState<TeammateStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supervisorEmail) {
      setMates([]);
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'conversation_stats'), where('supervisorEmail', '==', supervisorEmail));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMates(snap.docs.map((d) => d.data() as TeammateStat));
        setLoading(false);
      },
      (e) => {
        console.error('Error al cargar conversaciones del equipo:', e);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [supervisorEmail]);

  return { mates, loading };
}

export function TeamGoals({ user }: { user: User }) {
  const supervisorEmail = (user.supervisorEmail || '').toLowerCase();
  const { mates, loading } = useTeamConversations(supervisorEmail);
  const goal = getDailyGoal(user, todayKey());

  if (!supervisorEmail) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <p className="text-muted-foreground font-medium">
          Tu perfil no tiene un supervisor asignado, así que no se puede armar tu equipo.
        </p>
      </div>
    );
  }

  const sorted = [...mates].sort((a, b) => (b.closedToday ?? -1) - (a.closedToday ?? -1));
  const teamGoal = goal?.conversations ?? null;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <div>
        <h1 className="text-2xl font-black text-secondary flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          Mi Equipo
        </h1>
        <p className="text-sm text-muted-foreground font-medium mt-1">
          Conversaciones cerradas hoy de {user.supervisorName || 'tu equipo'}
          {teamGoal !== null ? ` — meta de hoy: ${teamGoal} por asesor` : ''}
        </p>
      </div>

      <div className="bg-card rounded-2xl card-shadow divide-y divide-border/50 overflow-hidden">
        {loading ? (
          <p className="p-5 text-sm text-muted-foreground">Cargando…</p>
        ) : sorted.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground font-medium">
              Aún no hay datos de tu equipo hoy. Se actualizan cuando cada asesor entra a la app o pulsa "Actualizar" en su perfil.
            </p>
          </div>
        ) : (
          sorted.map((m) => {
            const current = m.closedToday;
            const pct = teamGoal && current !== null ? Math.min(100, Math.round((current / teamGoal) * 100)) : 0;
            const done = teamGoal !== null && current !== null && current >= teamGoal;
            const isMe = m.email === (user.email || '').toLowerCase();
            return (
              <div key={m.email} className={cn('p-4 flex items-center gap-4', isMe && 'bg-primary/5')}>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-secondary truncate">
                    {m.name || m.email}
                    {isMe && <span className="text-primary"> (tú)</span>}
                  </p>
                  <div className="h-2 rounded-full bg-muted/50 overflow-hidden mt-1.5">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        done ? 'bg-emerald-500' : pct >= 50 ? 'bg-primary' : 'bg-amber-500'
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <p className="text-sm font-black text-secondary shrink-0">
                  {current ?? '—'}
                  {teamGoal !== null && <span className="text-muted-foreground font-bold"> / {teamGoal}</span>}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
