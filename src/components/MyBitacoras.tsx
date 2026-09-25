import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { BookOpen } from 'lucide-react';
import { db } from '@/firebase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DayStats } from '@/lib/bitacoraParse';

export type BitacoraDoc = {
  name?: string;
  days: Record<string, DayStats>;
  updatedAt?: Timestamp;
};

// Lee solo el documento del propio asesor (las reglas de Firestore no dejan
// leer el de nadie más).
export function useMyBitacoras(email?: string) {
  const [data, setData] = useState<BitacoraDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!email) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'bitacoras', email.toLowerCase()),
      (snap) => {
        setData(snap.exists() ? ({ days: {}, ...snap.data() } as BitacoraDoc) : null);
        setLoading(false);
      },
      () => {
        setData(null);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [email]);

  return { data, loading };
}

export function sortedDays(data: BitacoraDoc | null): string[] {
  return Object.keys(data?.days ?? {}).sort().reverse();
}

export function dayLabel(dayKey: string, withWeekday = false): string {
  return new Date(`${dayKey}T12:00:00`).toLocaleDateString('es-CO', {
    ...(withWeekday ? { weekday: 'long' as const } : {}),
    day: 'numeric',
    month: 'long',
  });
}

function Bars({ title, entries, color }: { title: string; entries: [string, number][]; color: string }) {
  if (entries.length === 0) return null;
  const max = Math.max(...entries.map(([, v]) => v));
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{title}</p>
      {entries.map(([label, value]) => (
        <div key={label} className="space-y-0.5">
          <div className="flex justify-between gap-2 text-xs font-medium text-secondary">
            <span className="truncate">{label}</span>
            <span className="font-black">{value}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${(value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MyBitacoras({ email }: { email?: string }) {
  const { data, loading } = useMyBitacoras(email);
  const days = useMemo(() => sortedDays(data), [data]);
  const [selected, setSelected] = useState<string>('');

  useEffect(() => {
    if (days.length > 0 && !days.includes(selected)) setSelected(days[0]);
  }, [days, selected]);

  const stats = data?.days[selected];
  const accumulated = useMemo(
    () => (Object.values(data?.days ?? {}) as DayStats[]).reduce((s: number, d: DayStats) => s + d.total, 0),
    [data]
  );
  const gestion = useMemo(
    () => (Object.entries(stats?.byGestion ?? {}) as [string, number][]).sort((a, b) => b[1] - a[1]).slice(0, 8),
    [stats]
  );
  const canal = useMemo(
    () => (Object.entries(stats?.byCanal ?? {}) as [string, number][]).sort((a, b) => b[1] - a[1]),
    [stats]
  );

  return (
    <section className="bg-card rounded-2xl p-5 card-shadow space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-black text-secondary flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          Mis Bitácoras
        </h3>
        {days.length > 0 && (
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="h-8 w-auto px-3 rounded-full text-xs font-bold gap-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {days.map((d) => (
                <SelectItem key={d} value={d} className="text-xs font-medium">{dayLabel(d)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : !stats ? (
        <p className="text-sm text-muted-foreground">
          Aún no hay bitácoras cargadas para ti. Se actualizan cuando el equipo sube el reporte.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-muted/20 border border-border/50 p-3">
              <p className="text-2xl font-black text-secondary">{stats.total}</p>
              <p className="text-[10px] font-bold uppercase text-muted-foreground mt-0.5">Bitácoras del día</p>
            </div>
            <div className="rounded-2xl bg-muted/20 border border-border/50 p-3">
              <p className="text-2xl font-black text-secondary">{stats.solicitudes}</p>
              <p className="text-[10px] font-bold uppercase text-muted-foreground mt-0.5">Solicitudes gestionadas</p>
            </div>
            <div className="rounded-2xl bg-muted/20 border border-border/50 p-3">
              <p className="text-2xl font-black text-secondary">{stats.lastAt?.slice(11, 16) || '—'}</p>
              <p className="text-[10px] font-bold uppercase text-muted-foreground mt-0.5">Última bitácora</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Bars title="Por tipo de gestión" entries={gestion} color="bg-primary" />
            <Bars title="Por canal" entries={canal} color="bg-emerald-500" />
          </div>

          <p className="text-[10px] text-muted-foreground font-medium">
            {days.length > 1 ? `Acumulado de ${days.length} días: ${accumulated} bitácoras. ` : ''}
            {data?.updatedAt ? `Actualizado el ${data.updatedAt.toDate().toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}.` : ''}
          </p>
        </>
      )}
    </section>
  );
}
