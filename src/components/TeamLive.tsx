import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/firebase';
import { cn } from '@/lib/utils';
import { getDailyGoal } from '@/lib/goals';
import { getExtensionCallTotalsForDate, todayKey } from '@/lib/itbxCache';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, MessageSquare, PhoneCall, RefreshCcw, Users, CheckCircle2, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { User, Advisor } from '../types';
import type { BitacoraDoc } from '@/components/MyBitacoras';

// "Mi Equipo en Vivo": el supervisor (o un admin, eligiendo el equipo) ve el
// avance de HOY de cada asesor — conversaciones cerradas en Infobip y
// llamadas contestadas en ITBX contra la meta del día — sin depender de que
// cada asesor entre a la app ni de que alguien arme el informe "Cómo van".

type Availability = 'ACTIVE' | 'BUSY' | 'AWAY' | 'INVISIBLE' | string;

type MemberStats = { active: number; closedToday: number; availability: Availability | null; statusSince?: string | null; hasAgent: boolean };

type Member = { email: string; name: string; cartera: string; extension: string | null };

type UserDoc = { email?: string; name?: string; extension?: string; supervisorEmail?: string; role?: string; cartera?: string };

// Se refresca solo mientras la vista está abierta; el botón manual tiene su
// propio enfriamiento corto. Las llamadas de ITBX igual salen de la caché
// compartida (máximo una consulta real cada 5 minutos, ver itbxCache.ts).
const AUTO_REFRESH_MS = 3 * 60 * 1000;
const MANUAL_COOLDOWN_MS = 60 * 1000;

// Jornada usada para el "esperado a esta hora" (solo lunes a viernes, igual
// que el análisis de asesores preocupantes del tablero de Conectividad).
const JORNADA_INICIO_MIN = 8 * 60;
const JORNADA_FIN_MIN = 17 * 60;

function bogotaMinutesNow(): number {
  const bogota = new Date(Date.now() - 5 * 60 * 60 * 1000);
  return bogota.getUTCHours() * 60 + bogota.getUTCMinutes();
}

function expectedFraction(isSaturday: boolean): number | null {
  if (isSaturday) return null;
  const now = bogotaMinutesNow();
  const f = (now - JORNADA_INICIO_MIN) / (JORNADA_FIN_MIN - JORNADA_INICIO_MIN);
  return Math.max(0, Math.min(1, f));
}

// Un equipo por correo de supervisor, armado con la lista viva de Gestión
// Asesores (colección `asesores` de Firestore): si ahí se agrega, edita,
// desactiva o elimina un asesor, el equipo cambia solo. Un supervisor puede
// aparecer con nombres distintos (p. ej. por su cartera de Copropiedades), así
// que se usa el nombre más corto.
function buildTeams(advisors: Advisor[]): { email: string; name: string }[] {
  const byEmail = new Map<string, string>();
  for (const a of advisors) {
    const email = (a.supervisorEmail || '').toLowerCase();
    if (!email || a.active === false || a.role === 'supervisor' || a.role === 'admin') continue;
    const prev = byEmail.get(email);
    if (!prev || (a.supervisor || '').length < prev.length) byEmail.set(email, a.supervisor || email);
  }
  return Array.from(byEmail, ([email, name]) => ({ email, name })).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

const AVAILABILITY: Record<string, { label: string; dot: string }> = {
  ACTIVE: { label: 'Disponible', dot: 'bg-emerald-500' },
  BUSY: { label: 'Ocupado', dot: 'bg-amber-500' },
  AWAY: { label: 'Ausente', dot: 'bg-slate-400' },
  INVISIBLE: { label: 'Desconectado', dot: 'bg-slate-300 dark:bg-slate-600' },
};

// "12 min", "1 h 05 min" — tiempo transcurrido desde un instante ISO.
function elapsedLabel(sinceIso: string | null | undefined, nowMs: number): string | null {
  if (!sinceIso) return null;
  const since = Date.parse(sinceIso);
  if (isNaN(since)) return null;
  const mins = Math.max(0, Math.floor((nowMs - since) / 60000));
  if (mins < 1) return 'menos de 1 min';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h >= 24) return 'más de 1 día';
  return `${h} h ${String(mins % 60).padStart(2, '0')} min`;
}

const AVAILABILITY_PILL: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  BUSY: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  AWAY: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
  INVISIBLE: 'bg-muted text-muted-foreground',
};

// Bitácoras de los asesores del equipo (documentos bitacoras/{correo}); se
// mantienen al día solos con onSnapshot, así que no consumen lecturas extra en
// cada refresco de la pantalla. Las reglas de Firestore dejan leerlas a
// supervisores y administradores.
function useTeamBitacoras(emails: string[]) {
  const [docs, setDocs] = useState<Record<string, BitacoraDoc>>({});
  const key = [...emails].sort().join('|');
  useEffect(() => {
    setDocs({});
    if (emails.length === 0) return;
    const unsubs: (() => void)[] = [];
    for (let i = 0; i < emails.length; i += 30) {
      const chunk = emails.slice(i, i + 30);
      unsubs.push(
        onSnapshot(
          query(collection(db, 'bitacoras'), where('email', 'in', chunk)),
          (snap) =>
            setDocs((prev) => {
              const next = { ...prev };
              chunk.forEach((e) => delete next[e]);
              snap.docs.forEach((d) => {
                next[d.id.toLowerCase()] = { days: {}, ...d.data() } as BitacoraDoc;
              });
              return next;
            }),
          (e) => console.warn('No se pudieron leer las bitácoras del equipo:', e.message)
        )
      );
    }
    return () => unsubs.forEach((u) => u());
  }, [key]);
  return docs;
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 7).padStart(2, '0')); // 07 a 18

// Bitácoras por hora del día (barras mínimas con el número en el texto de ayuda).
function HourBars({ byHour }: { byHour?: Record<string, number> }) {
  if (!byHour) return null;
  const max = Math.max(1, ...HOURS.map((h) => byHour[h] ?? 0));
  return (
    <div className="flex items-end justify-end gap-[3px] h-5 mt-1" title={HOURS.filter((h) => byHour[h]).map((h) => `${h}:00 → ${byHour[h]}`).join('  ·  ') || 'Sin bitácoras por hora'}>
      {HOURS.map((h) => (
        <div key={h} className="w-1.5 rounded-sm bg-muted/60 flex items-end" style={{ height: '100%' }}>
          <div className="w-full rounded-sm bg-primary" style={{ height: `${Math.round(((byHour[h] ?? 0) / max) * 100)}%` }} />
        </div>
      ))}
    </div>
  );
}

function ProgressCell({ current, goal, expected }: { current: number | null; goal: number | null; expected: number | null }) {
  if (goal === null) {
    return <p className="text-sm font-black text-secondary text-right">{current ?? '—'}</p>;
  }
  const pct = current === null ? 0 : Math.min(100, Math.round((current / goal) * 100));
  const done = current !== null && current >= goal;
  const expectedNow = expected === null ? null : Math.round(goal * expected);
  const behind = !done && expectedNow !== null && current !== null && current < expectedNow;
  const bar = done ? 'bg-emerald-500' : behind ? 'bg-amber-500' : 'bg-primary';
  return (
    <div className="min-w-[120px] space-y-1">
      <p className="text-sm font-black text-secondary text-right">
        {current ?? '—'} <span className="text-muted-foreground font-bold">/ {goal}</span>
      </p>
      <div className="relative h-2 rounded-full bg-muted/50 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', bar)} style={{ width: `${pct}%` }} />
        {expected !== null && !done && (
          <div className="absolute top-0 h-full w-0.5 bg-secondary/60" style={{ left: `${Math.round(expected * 100)}%` }} />
        )}
      </div>
      <p className={cn('text-[10px] font-bold text-right', done ? 'text-emerald-600 dark:text-emerald-400' : behind ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
        {current === null ? 'Sin dato' : done ? 'Meta cumplida' : `Faltan ${goal - current}${expectedNow !== null ? ` · esperado ${expectedNow}` : ''}`}
      </p>
    </div>
  );
}

export function TeamLive({ user, role, advisors }: { user: User; role: 'admin' | 'supervisor'; advisors: Advisor[] }) {
  const myEmail = (user.email || '').toLowerCase();
  const teams = useMemo(() => buildTeams(advisors), [advisors]);
  const ownsTeam = teams.some((s) => s.email === myEmail);
  // El supervisor ve solo su equipo; el admin elige cuál (por defecto el
  // suyo si también es supervisor de alguno).
  const canChooseTeam = role === 'admin' || !ownsTeam;
  const [teamEmail, setTeamEmail] = useState(ownsTeam ? myEmail : teams[0]?.email ?? '');

  // La lista de asesores puede llegar después de abrir la pantalla, o el equipo
  // elegido puede quedarse sin asesores: se pasa a uno que exista.
  useEffect(() => {
    if (teams.length > 0 && !teams.some((t) => t.email === teamEmail)) {
      setTeamEmail(teams.some((t) => t.email === myEmail) ? myEmail : teams[0].email);
    }
  }, [teams, teamEmail, myEmail]);

  const [users, setUsers] = useState<UserDoc[]>([]);
  const [stats, setStats] = useState<Record<string, MemberStats>>({});
  const [answered, setAnswered] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    getDocs(collection(db, 'users'))
      .then((snap) => setUsers(snap.docs.map((d) => d.data() as UserDoc)))
      .catch((e) => console.error('Error al cargar usuarios para el equipo:', e));
  }, []);

  // Integrantes: los asesores activos de ese supervisor en Gestión Asesores.
  // La extensión de ITBX sale de la ficha del asesor; si no la tiene, de la que
  // él mismo registró en su perfil.
  const members: Member[] = useMemo(() => {
    const userByEmail = new Map<string, UserDoc>(users.filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u]));
    return advisors
      .filter((a) => (a.supervisorEmail || '').toLowerCase() === teamEmail && a.active !== false && a.role !== 'supervisor' && a.role !== 'admin' && a.email)
      .map((a) => {
        const email = a.email.toLowerCase();
        return { email, name: a.name, cartera: a.cartera || '', extension: a.extension || userByEmail.get(email)?.extension || null };
      })
      .filter((m, i, all) => all.findIndex((x) => x.email === m.email) === i);
  }, [advisors, users, teamEmail]);

  const bitacoraDocs = useTeamBitacoras(useMemo(() => members.map((m) => m.email), [members]));

  const load = useCallback(async () => {
    if (members.length === 0) return;
    setLoading(true);
    const [convRes, callsRes] = await Promise.allSettled([
      fetch('/api/infobip/team-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members: members.map((m) => ({ email: m.email, name: m.name })) }),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json?.error || 'No fue posible consultar Infobip');
        return json as { members: Record<string, MemberStats> };
      }),
      getExtensionCallTotalsForDate(todayKey()),
    ]);
    if (convRes.status === 'fulfilled') setStats(convRes.value.members);
    else toast.error(`Conversaciones: ${convRes.reason?.message || 'error al consultar Infobip'}`);
    if (callsRes.status === 'fulfilled') setAnswered(callsRes.value.answered);
    else toast.error(`Llamadas: ${callsRes.reason?.message || 'error al consultar ITBX'}`);
    setUpdatedAt(Date.now());
    setLoading(false);
  }, [members]);

  // Carga al entrar / al cambiar de equipo, y luego cada AUTO_REFRESH_MS
  // mientras la pestaña esté visible.
  useEffect(() => {
    setStats({});
    load();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const manualRefresh = () => {
    setCooldownUntil(Date.now() + MANUAL_COOLDOWN_MS);
    load();
  };

  const today = todayKey();
  const reportToday = members.some((m) => bitacoraDocs[m.email]?.days?.[today]);
  const reportUpdatedMs = Math.max(0, ...members.map((m) => bitacoraDocs[m.email]?.updatedAt?.toMillis?.() ?? 0));
  const rows = members
    .map((m) => {
      const goal = getDailyGoal({ email: m.email, supervisorEmail: teamEmail, cartera: m.cartera }, today);
      const s = stats[m.email];
      const conversations = s ? s.closedToday : null;
      const calls = m.extension ? answered[m.extension] ?? 0 : null;
      const convPct = goal && conversations !== null ? conversations / goal.conversations : 0;
      const callPct = goal && calls !== null ? calls / goal.calls : 0;
      const bDoc = bitacoraDocs[m.email];
      const bDay = bDoc?.days?.[today];
      // Si ningún asesor del equipo tiene bitácoras de hoy, el reporte de hoy aún no se ha cargado.
      const bitacoras = bDay ? bDay.total : reportToday ? 0 : null;
      return { ...m, goal, s, conversations, calls, bitacoras, bDay, progress: (Math.min(1, convPct) + Math.min(1, callPct)) / 2 };
    })
    // Los que van más atrás, primero.
    .sort((a, b) => a.progress - b.progress || a.name.localeCompare(b.name, 'es'));

  const sampleGoal = rows.find((r) => r.goal)?.goal ?? null;
  const expected = sampleGoal ? expectedFraction(sampleGoal.isSaturday) : null;
  const totalConv = rows.reduce((acc, r) => acc + (r.conversations ?? 0), 0);
  const totalCalls = rows.reduce((acc, r) => acc + (r.calls ?? 0), 0);
  const goalConv = rows.reduce((acc, r) => acc + (r.goal?.conversations ?? 0), 0);
  const goalCalls = rows.reduce((acc, r) => acc + (r.goal?.calls ?? 0), 0);
  const metBoth = rows.filter((r) => r.goal && (r.conversations ?? 0) >= r.goal.conversations && (r.calls ?? 0) >= r.goal.calls).length;
  const totalBitacoras = rows.reduce((acc, r) => acc + (r.bitacoras ?? 0), 0);
  const goalBitacoras = rows.reduce((acc, r) => acc + (r.goal?.bitacoras ?? 0), 0);
  const connected = rows.filter((r) => r.s?.availability === 'ACTIVE' || r.s?.availability === 'BUSY').length;
  const teamName = teams.find((s) => s.email === teamEmail)?.name ?? 'Equipo';

  const tiles = [
    { label: 'Conversaciones cerradas', value: totalConv, goal: goalConv, Icon: MessageSquare },
    { label: 'Llamadas contestadas', value: totalCalls, goal: goalCalls, Icon: PhoneCall },
    { label: 'Bitácoras de hoy', value: reportToday ? totalBitacoras : 0, goal: goalBitacoras, Icon: BookOpen },
    { label: 'Cumplen ambas metas', value: metBoth, goal: rows.length, Icon: CheckCircle2 },
    { label: 'Conectados en Infobip', value: connected, goal: rows.length, Icon: Activity },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-secondary flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Mi Equipo en Vivo
          </h1>
          <p className="text-sm text-muted-foreground font-medium mt-1">
            Avance de hoy de {teamName}
            {sampleGoal ? ` · ${sampleGoal.isSaturday ? 'meta de sábado' : 'meta de lunes a viernes'}` : ''}
            {updatedAt ? ` · actualizado ${new Date(updatedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canChooseTeam && (
            <Select value={teamEmail} onValueChange={setTeamEmail}>
              <SelectTrigger className="h-10 w-[220px] rounded-xl font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {teams.map((s) => (
                  <SelectItem key={s.email} value={s.email} className="font-medium">{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            className="h-10 rounded-xl gap-2 font-bold"
            onClick={manualRefresh}
            disabled={loading || cooldownLeft > 0}
            title="Se actualiza solo cada 3 minutos"
          >
            <RefreshCcw className={cn('w-4 h-4', loading && 'animate-spin')} />
            {cooldownLeft > 0 ? `${cooldownLeft}s` : 'Actualizar'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {tiles.map(({ label, value, goal, Icon }) => (
          <div key={label} className="bg-card rounded-2xl p-4 card-shadow flex items-center gap-3">
            <div className="w-10 h-10 shrink-0 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-black text-secondary">
                {value}
                {goal > 0 && <span className="text-sm text-muted-foreground font-bold"> / {goal}</span>}
              </p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase truncate">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-2xl card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left">
                <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Asesor</th>
                <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Estado en Infobip</th>
                <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] tracking-wider text-right">Conversaciones</th>
                <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] tracking-wider text-right">Bitácoras</th>
                <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] tracking-wider text-right">Abiertas</th>
                <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] tracking-wider text-right">Llamadas contestadas</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const av = r.s?.availability ? AVAILABILITY[r.s.availability] : null;
                return (
                  <tr key={r.email} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-bold text-secondary">{r.name}</p>
                      <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5 mt-0.5">
                        <span className={cn('inline-block w-2 h-2 rounded-full', av?.dot ?? 'bg-transparent border border-border')} />
                        {r.s && !r.s.hasAgent ? 'Sin agente en Infobip' : av?.label ?? (r.s ? r.s.availability : 'Consultando…')}
                        {r.cartera ? ` · ${r.cartera}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {r.s && !r.s.hasAgent ? (
                        <span className="text-[11px] text-muted-foreground font-medium italic">Sin agente en Infobip</span>
                      ) : av ? (
                        <div className="space-y-0.5">
                          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black', AVAILABILITY_PILL[r.s!.availability as string] ?? 'bg-muted text-muted-foreground')}>
                            <span className={cn('inline-block w-1.5 h-1.5 rounded-full', av.dot)} />
                            {av.label}
                          </span>
                          {elapsedLabel(r.s!.statusSince, now) && (
                            <p className="text-[11px] text-muted-foreground font-medium" title="Tiempo desde el último cambio de estado que reporta Infobip">
                              hace {elapsedLabel(r.s!.statusSince, now)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground font-medium">{r.s ? '—' : 'Consultando…'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ProgressCell current={r.conversations} goal={r.goal?.conversations ?? null} expected={expected} />
                    </td>
                    <td className="px-4 py-3">
                      {r.bitacoras === null ? (
                        <p className="text-[11px] text-muted-foreground font-medium text-right italic">Reporte de hoy sin cargar</p>
                      ) : (
                        <>
                          <ProgressCell current={r.bitacoras} goal={r.goal?.bitacoras ?? null} expected={expected} />
                          {r.bDay && (
                            <p className="text-[10px] text-muted-foreground font-medium text-right mt-0.5" title="Hora de la primera y de la última bitácora de hoy, según el reporte">
                              {r.bDay.firstAt ? `desde ${r.bDay.firstAt.slice(11, 16)} · ` : ''}última {r.bDay.lastAt?.slice(11, 16) || '—'}
                            </p>
                          )}
                          <HourBars byHour={r.bDay?.byHour} />
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-secondary">{r.s ? r.s.active : '—'}</td>
                    <td className="px-4 py-3">
                      {r.extension ? (
                        <ProgressCell current={r.calls} goal={r.goal?.calls ?? null} expected={expected} />
                      ) : (
                        <p className="text-[11px] text-muted-foreground font-medium text-right italic">Sin extensión registrada</p>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground font-medium">
                    Este equipo no tiene asesores registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground font-medium">
        Conversaciones cerradas hoy y abiertas ahora en Infobip; llamadas contestadas según la extensión de cada asesor en ITBX.
        Las bitácoras salen del reporte que carga Control{reportUpdatedMs > 0 ? ` (última carga: ${new Date(reportUpdatedMs).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })})` : ''}: se muestra cuántas lleva cada asesor, a qué hora hizo la primera y la última, y las barras muestran cuántas hizo en cada hora (de 7:00 a 18:00).
        El estado (Disponible, Ocupado, Ausente o Desconectado) y el tiempo en ese estado vienen de Infobip; Infobip no informa si una ausencia es almuerzo o break.
        {expected !== null && ' La raya en cada barra marca lo esperado a esta hora (jornada de 8:00 a 17:00).'}
      </p>
    </div>
  );
}
