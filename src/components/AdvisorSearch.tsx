import { useMemo, useState } from 'react';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import { Search, MessageSquare, BookOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Advisor } from '../types';
import { DayStats } from '@/lib/bitacoraParse';
import { todayKey } from '@/lib/itbxCache';

type ConversationLookup = { active: number | null; closedToday: number | null; updatedAt?: Timestamp } | null;
type BitacoraLookup = { total: number; solicitudes: number } | null;

// Búsqueda para Controller: cualquier asesor por nombre/apellido, con sus
// conversaciones y bitácoras de hoy. Las reglas de Firestore permiten este
// alcance amplio solo a Controller/supervisor/admin (ver conversation_stats
// y bitacoras en firestore.rules) — este componente en sí ya está oculto
// para todos los demás roles (ver Profile.tsx).
export function AdvisorSearch({ advisors }: { advisors: Advisor[] }) {
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState<Advisor | null>(null);
  const [conversations, setConversations] = useState<ConversationLookup>(null);
  const [bitacoras, setBitacoras] = useState<BitacoraLookup>(null);
  const [loading, setLoading] = useState(false);

  const matches = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (selected || q.length < 2) return [];
    return advisors.filter((a) => (a.name || '').toLowerCase().includes(q)).slice(0, 8);
  }, [term, advisors, selected]);

  const select = async (advisor: Advisor) => {
    setSelected(advisor);
    setTerm(advisor.name);
    setLoading(true);
    setConversations(null);
    setBitacoras(null);
    try {
      const email = (advisor.email || '').toLowerCase();
      const [convSnap, bitSnap] = await Promise.all([
        getDoc(doc(db, 'conversation_stats', email)),
        getDoc(doc(db, 'bitacoras', email)),
      ]);
      if (convSnap.exists()) {
        const c = convSnap.data();
        setConversations({ active: c.active ?? null, closedToday: c.closedToday ?? null, updatedAt: c.updatedAt });
      }
      if (bitSnap.exists()) {
        const days = (bitSnap.data().days ?? {}) as Record<string, DayStats>;
        const today = days[todayKey()];
        if (today) setBitacoras({ total: today.total, solicitudes: today.solicitudes });
      }
    } catch (e) {
      console.error('Error al buscar asesor:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-card rounded-2xl p-5 card-shadow space-y-4">
      <div className="flex items-center gap-2">
        <Search className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-black text-secondary">Buscar Asesor</h3>
      </div>

      <div className="relative">
        <Input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setSelected(null);
            setConversations(null);
            setBitacoras(null);
          }}
          placeholder="Nombre o apellido..."
          className="h-11 rounded-xl"
        />
        {matches.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-card border border-border/50 rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
            {matches.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => select(a)}
                className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-muted/40 transition-colors"
              >
                {a.name}
                <span className="block text-[10px] text-muted-foreground font-normal">{a.cartera}</span>
              </button>
            ))}
          </div>
        )}
        {term.trim().length >= 2 && !selected && matches.length === 0 && (
          <p className="text-xs text-muted-foreground mt-1 px-1">Sin coincidencias.</p>
        )}
      </div>

      {selected && (
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-2xl bg-muted/20 border border-border/50">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <p className="text-2xl font-black text-secondary">{loading ? '...' : conversations?.closedToday ?? '—'}</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Conversaciones Cerradas Hoy</p>
            {!loading && !conversations && (
              <p className="text-[10px] text-muted-foreground mt-1">No ha refrescado su perfil hoy</p>
            )}
          </div>
          <div className="p-4 rounded-2xl bg-muted/20 border border-border/50">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-2">
              <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-2xl font-black text-secondary">{loading ? '...' : bitacoras?.total ?? '—'}</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Bitácoras de Hoy</p>
            {!loading && !bitacoras && (
              <p className="text-[10px] text-muted-foreground mt-1">Sin bitácoras cargadas hoy</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
