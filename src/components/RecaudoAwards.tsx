import { useMemo, useState } from 'react';
import { Award, Trophy, Medal, RefreshCcw, Download, Link2, DollarSign, CheckCircle2, Users, AlertTriangle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Transfer, Advisor } from '../types';
import { useRecaudoRecords } from '@/lib/useRecaudoRecords';
import { todayKey } from '@/lib/itbxCache';

// Líder de NGSO: recibe/cierra gestiones pero no es un asesor a premiar
// (mismo criterio que la pantalla Clasificación).
const EXCLUDED_EMAILS = ['lidercartera2@ngsoabogados.com'];

type Period = 'month' | 'prev-month' | 'week' | 'all' | 'custom';
type Metric = 'recaudo' | 'links' | 'valor';

type Row = {
  email: string;
  name: string;
  cartera: string;
  supervisor: string;
  supervisorEmail: string;
  links: number; // links de pago generados en el periodo
  valorLinks: number; // suma del valor de esos links
  pagados: number; // links cuyo pago entró en el periodo
  recaudo: number; // dinero recaudado (pagado en el periodo)
  lastLink: string; // YYYY-MM-DD del último link generado
};

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

// YYYY-MM-DD en hora de Bogotá a partir de un instante.
function bogotaDay(ms: number): string {
  return new Date(ms - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function toDayKey(value: any): string | null {
  if (!value) return null;
  let ms: number | null = null;
  if (typeof value.toMillis === 'function') ms = value.toMillis();
  else if (typeof value.seconds === 'number') ms = value.seconds * 1000;
  else if (value instanceof Date) ms = value.getTime();
  else {
    const t = new Date(value).getTime();
    ms = isNaN(t) ? null : t;
  }
  return ms === null || isNaN(ms) ? null : bogotaDay(ms);
}

// La fecha de pago viene del Excel del banco como YYYY-MM-DD (o DD/MM/YYYY).
function payDayKey(value: unknown): string | null {
  const s = String(value ?? '').trim();
  if (!s || s === '-') return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return null;
}

function shiftDays(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function periodRange(period: Period, customFrom: string, customTo: string): { from: string | null; to: string | null } {
  const today = todayKey();
  if (period === 'all') return { from: null, to: null };
  if (period === 'week') return { from: shiftDays(today, -6), to: today };
  if (period === 'month') return { from: `${today.slice(0, 7)}-01`, to: today };
  if (period === 'prev-month') {
    const lastOfPrev = shiftDays(`${today.slice(0, 7)}-01`, -1);
    return { from: `${lastOfPrev.slice(0, 7)}-01`, to: lastOfPrev };
  }
  return { from: customFrom || null, to: customTo || null };
}

const inRange = (day: string | null, from: string | null, to: string | null) =>
  day !== null && (!from || day >= from) && (!to || day <= to);

function dayLabel(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

const PERIOD_LABEL: Record<Period, string> = {
  month: 'Este mes',
  'prev-month': 'Mes anterior',
  week: 'Últimos 7 días',
  all: 'Todo el historial',
  custom: 'Personalizado',
};
const METRIC_LABEL: Record<Metric, string> = {
  recaudo: 'Mayor recaudo',
  links: 'Más links generados',
  valor: 'Mayor valor en links generados',
};

const PODIUM = [
  { label: '1.º lugar', box: 'bg-secondary text-white', icon: Trophy },
  { label: '2.º lugar', box: 'bg-primary text-white', icon: Medal },
  { label: '3.º lugar', box: 'bg-muted text-secondary', icon: Medal },
];

interface RecaudoAwardsProps {
  transfers: Transfer[];
  advisors: Advisor[];
}

export function RecaudoAwards({ transfers, advisors }: RecaudoAwardsProps) {
  const { records, meta, loading, error, reload } = useRecaudoRecords();
  const [period, setPeriod] = useState<Period>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [metric, setMetric] = useState<Metric>('recaudo');
  const [cartera, setCartera] = useState('todas');
  const [supervisor, setSupervisor] = useState('todos');
  const [showIdle, setShowIdle] = useState(false);

  const { from, to } = periodRange(period, customFrom, customTo);

  const advisorByEmail = useMemo(() => {
    const m = new Map<string, Advisor>();
    advisors.forEach((a) => m.set((a.email || '').toLowerCase().trim(), a));
    return m;
  }, [advisors]);

  const allRows = useMemo<Row[]>(() => {
    const paid = new Map<string, { valor: number; day: string | null }>();
    records.forEach((r) => {
      if (String(r.estado_recibo || '').toUpperCase() !== 'RECIBO') return;
      // Igual que en Seguimiento Recaudo: solo cuenta como recaudo efectivo el tipo "S".
      if (String(r.tipo_recaudo || '').trim().toUpperCase() !== 'S') return;
      paid.set(r.id_registro_crm, { valor: Number(r.valor_liquidacion) || 0, day: payDayKey(r.fecha_pago) });
    });

    const rows = new Map<string, Row>();
    transfers.forEach((t) => {
      if (t.type !== 'regalo') return;
      const email = (t.createdByEmail || t.fromAdvisorEmail || '').toLowerCase().trim();
      if (!email || EXCLUDED_EMAILS.includes(email)) return;
      const known = advisorByEmail.get(email);
      let row = rows.get(email);
      if (!row) {
        row = {
          email,
          name: known?.name || t.createdByName || t.fromAdvisorName || email,
          cartera: known?.cartera || t.cartera || '—',
          supervisor: known?.supervisor || t.supervisorName || '—',
          supervisorEmail: (known?.supervisorEmail || t.supervisorEmail || '').toLowerCase().trim(),
          links: 0,
          valorLinks: 0,
          pagados: 0,
          recaudo: 0,
          lastLink: '',
        };
        rows.set(email, row);
      }
      const genDay = toDayKey(t.createdAt);
      if (inRange(genDay, from, to)) {
        row.links++;
        row.valorLinks += t.paymentLinkValue || 0;
        if (genDay! > row.lastLink) row.lastLink = genDay!;
      }
      const pay = t.id ? paid.get(t.id) : undefined;
      if (pay && inRange(pay.day, from, to)) {
        row.pagados++;
        row.recaudo += pay.valor;
      }
    });
    return [...rows.values()].filter((r) => r.links > 0 || r.recaudo > 0);
  }, [transfers, records, advisorByEmail, from, to]);

  // Para entender por qué un recaudo no aparece: cuántos pagos trae el
  // reporte y cuántos terminan asignados a un link generado en el panel.
  const diagnostic = useMemo(() => {
    const regaloIds = new Set(transfers.filter((t) => t.type === 'regalo' && t.id).map((t) => t.id as string));
    const recibo = records.filter((r) => String(r.estado_recibo || '').toUpperCase() === 'RECIBO');
    const tipoS = recibo.filter((r) => String(r.tipo_recaudo || '').trim().toUpperCase() === 'S');
    const cruzan = recibo.filter((r) => regaloIds.has(r.id_registro_crm));
    const cruzanS = tipoS.filter((r) => regaloIds.has(r.id_registro_crm));
    return { total: records.length, recibo: recibo.length, tipoS: tipoS.length, cruzan: cruzan.length, cruzanS: cruzanS.length, links: regaloIds.size };
  }, [records, transfers]);

  const carteras = useMemo(() => [...new Set(allRows.map((r) => r.cartera))].sort(), [allRows]);

  // Supervisores para el filtro: los de los asesores registrados y los que
  // aparecen en los links. Un mismo supervisor puede traer nombres distintos
  // (p. ej. por su cartera de Copropiedades), así que se agrupa por correo y
  // se usa el nombre más corto.
  const supervisors = useMemo(() => {
    const byEmail = new Map<string, string>();
    const add = (email: string, name: string) => {
      const e = (email || '').toLowerCase().trim();
      if (!e || !name || name === '—') return;
      const prev = byEmail.get(e);
      if (!prev || name.length < prev.length) byEmail.set(e, name);
    };
    advisors.forEach((a) => {
      if (a.active !== false && a.role !== 'supervisor' && a.role !== 'admin') add(a.supervisorEmail, a.supervisor);
    });
    allRows.forEach((r) => add(r.supervisorEmail, r.supervisor));
    return [...byEmail].map(([email, name]) => ({ email, name })).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [advisors, allRows]);
  const supervisorName = supervisors.find((x) => x.email === supervisor)?.name ?? supervisor;

  const ranking = useMemo(() => {
    const value = (r: Row) => (metric === 'recaudo' ? r.recaudo : metric === 'links' ? r.links : r.valorLinks);
    return allRows
      .filter((r) => cartera === 'todas' || r.cartera === cartera)
      .filter((r) => supervisor === 'todos' || r.supervisorEmail === supervisor)
      .sort((a, b) => value(b) - value(a) || b.recaudo - a.recaudo || b.links - a.links || a.name.localeCompare(b.name));
  }, [allRows, metric, cartera, supervisor]);

  const idleAdvisors = useMemo(() => {
    const active = new Set(ranking.map((r) => r.email));
    return advisors
      .filter((a) => a.active !== false && a.email && !active.has(a.email.toLowerCase().trim()) && (cartera === 'todas' || a.cartera === cartera) && (supervisor === 'todos' || (a.supervisorEmail || '').toLowerCase().trim() === supervisor))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [advisors, ranking, cartera, supervisor]);

  const totals = useMemo(
    () => ({
      recaudo: ranking.reduce((s, r) => s + r.recaudo, 0),
      links: ranking.reduce((s, r) => s + r.links, 0),
      valor: ranking.reduce((s, r) => s + r.valorLinks, 0),
      pagados: ranking.reduce((s, r) => s + r.pagados, 0),
    }),
    [ranking]
  );

  const metricValue = (r: Row) => (metric === 'recaudo' ? money.format(r.recaudo) : metric === 'links' ? String(r.links) : money.format(r.valorLinks));
  const metricRaw = (r: Row) => (metric === 'recaudo' ? r.recaudo : metric === 'links' ? r.links : r.valorLinks);
  const podium = ranking.filter((r) => metricRaw(r) > 0).slice(0, 3);
  const maxValue = ranking.length ? Math.max(1, ...ranking.map(metricRaw)) : 1;

  const periodText = from || to ? `${from ? dayLabel(from) : 'inicio'} al ${to ? dayLabel(to) : 'hoy'}` : 'todo el historial';

  const exportCsv = () => {
    const header = ['Posición', 'Asesor', 'Correo', 'Cartera', 'Supervisor', 'Links generados', 'Valor de links generados', 'Pagos recibidos', 'Recaudo', 'Último link'];
    const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = ranking.map((r, i) => [i + 1, r.name, r.email, r.cartera, r.supervisor, r.links, r.valorLinks, r.pagados, r.recaudo, r.lastLink ? dayLabel(r.lastLink) : ''].map(q).join(','));
    const blob = new Blob(['﻿' + [header.map(q).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `premiacion_recaudo_${todayKey()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-secondary flex items-center gap-2">
            <Award className="w-6 h-6 text-primary" />
            Premiación de Recaudo
          </h2>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            Quién genera links de pago en el panel y cuánto de eso se convierte en recaudo. Periodo: {periodText}.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-full gap-1.5 text-xs font-bold" onClick={reload} disabled={loading}>
            <RefreshCcw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} /> Actualizar recaudo
          </Button>
          <Button variant="outline" size="sm" className="h-9 rounded-full gap-1.5 text-xs font-bold" onClick={exportCsv} disabled={ranking.length === 0}>
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* FILTROS */}
      <div className="bg-card rounded-2xl card-shadow p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Periodo</span>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="h-9 rounded-xl text-xs font-bold"><SelectValue>{PERIOD_LABEL[period]}</SelectValue></SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="month">Este mes</SelectItem>
              <SelectItem value="prev-month">Mes anterior</SelectItem>
              <SelectItem value="week">Últimos 7 días</SelectItem>
              <SelectItem value="all">Todo el historial</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Premiar por</span>
          <Select value={metric} onValueChange={(v) => setMetric(v as Metric)}>
            <SelectTrigger className="h-9 rounded-xl text-xs font-bold"><SelectValue>{METRIC_LABEL[metric]}</SelectValue></SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="recaudo">Mayor recaudo</SelectItem>
              <SelectItem value="links">Más links generados</SelectItem>
              <SelectItem value="valor">Mayor valor en links generados</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cartera</span>
          <Select value={cartera} onValueChange={setCartera}>
            <SelectTrigger className="h-9 rounded-xl text-xs font-bold"><SelectValue>{cartera === 'todas' ? 'Todas las carteras' : cartera}</SelectValue></SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="todas">Todas las carteras</SelectItem>
              {carteras.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Supervisor</span>
          <Select value={supervisor} onValueChange={setSupervisor}>
            <SelectTrigger className="h-9 rounded-xl text-xs font-bold"><SelectValue>{supervisor === 'todos' ? 'Todos los supervisores' : supervisorName}</SelectValue></SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="todos">Todos los supervisores</SelectItem>
              {supervisors.map((x) => (
                <SelectItem key={x.email} value={x.email}>{x.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        {period === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Desde</span>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 w-full rounded-xl border border-input bg-background px-2 text-xs font-bold" />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Hasta</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9 w-full rounded-xl border border-input bg-background px-2 text-xs font-bold" />
            </label>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-bold text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}
      {!loading && !error && records.length === 0 && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-bold text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          Todavía no hay recaudo bancario cargado en "Seguimiento Recaudo": por ahora solo se ven los links generados, sin dinero recaudado.
        </div>
      )}

      {/* RESUMEN */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: DollarSign, label: 'Recaudo en el periodo', value: money.format(totals.recaudo), tone: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' },
          { icon: Link2, label: 'Links generados', value: String(totals.links), tone: 'text-primary bg-primary/10' },
          { icon: CheckCircle2, label: 'Pagos recibidos', value: String(totals.pagados), tone: 'text-secondary bg-secondary/10' },
          { icon: Users, label: 'Asesores con actividad', value: String(ranking.length), tone: 'text-secondary bg-secondary/10' },
        ].map((k) => (
          <div key={k.label} className="bg-card rounded-2xl card-shadow p-4">
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', k.tone)}>
              <k.icon className="w-4 h-4" />
            </div>
            <p className="text-xl font-black text-secondary truncate">{loading ? '…' : k.value}</p>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* PODIO */}
      <section className="space-y-3">
        <h3 className="text-lg font-black text-secondary">Podio</h3>
        {podium.length === 0 ? (
          <div className="bg-card rounded-2xl card-shadow p-8 text-center text-sm text-muted-foreground font-medium">
            {loading ? 'Cargando…' : 'Aún no hay asesores con actividad en este periodo.'}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {podium.map((r, i) => {
              const P = PODIUM[i];
              return (
                <div key={r.email} className={cn('rounded-2xl card-shadow p-5 space-y-3', P.box)}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-widest opacity-80">{P.label}</span>
                    <P.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-lg font-black leading-tight">{r.name}</p>
                    <p className="text-[11px] font-medium opacity-80">{r.cartera}</p>
                  </div>
                  <p className="text-2xl font-black">{metricValue(r)}</p>
                  <p className="text-[11px] font-bold opacity-80">
                    {r.links} link{r.links === 1 ? '' : 's'} generado{r.links === 1 ? '' : 's'} · {r.pagados} pago{r.pagados === 1 ? '' : 's'} recibido{r.pagados === 1 ? '' : 's'}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* RANKING COMPLETO */}
      <section className="bg-card rounded-2xl card-shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-border/50">
          <h3 className="text-lg font-black text-secondary">Ranking completo</h3>
          <p className="text-[11px] text-muted-foreground font-medium">
            Los links cuentan por la fecha en que se generaron; el recaudo, por la fecha en que se pagó. Solo se cuenta como recaudo efectivo el tipo "S" del reporte bancario.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-black uppercase tracking-wider text-muted-foreground bg-muted/30">
                <th className="px-4 py-2.5 w-10">#</th>
                <th className="px-4 py-2.5">Asesor</th>
                <th className="px-4 py-2.5">Cartera</th>
                <th className="px-4 py-2.5 text-right">Links</th>
                <th className="px-4 py-2.5 text-right">Valor links</th>
                <th className="px-4 py-2.5 text-right">Pagos</th>
                <th className="px-4 py-2.5 text-right">Recaudo</th>
                <th className="px-4 py-2.5">Último link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {ranking.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground font-medium">
                    {loading ? 'Cargando…' : 'Sin datos para este periodo y cartera.'}
                  </td>
                </tr>
              )}
              {ranking.map((r, i) => (
                <tr key={r.email} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5 font-black text-secondary">{i + 1}</td>
                  <td className="px-4 py-2.5 min-w-[180px]">
                    <p className="font-bold text-secondary">{r.name}</p>
                    <div className="h-1.5 mt-1.5 rounded-full bg-muted/50 overflow-hidden max-w-[220px]">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((metricRaw(r) / maxValue) * 100)}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground font-medium">{r.cartera}</td>
                  <td className="px-4 py-2.5 text-right font-bold">{r.links}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{money.format(r.valorLinks)}</td>
                  <td className="px-4 py-2.5 text-right font-bold">{r.pagados}</td>
                  <td className="px-4 py-2.5 text-right font-black text-emerald-700 dark:text-emerald-400">{money.format(r.recaudo)}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground font-medium">{r.lastLink ? dayLabel(r.lastLink) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SIN ACTIVIDAD */}
      <section className="bg-card rounded-2xl card-shadow">
        <button type="button" onClick={() => setShowIdle((v) => !v)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
          <div>
            <h3 className="text-lg font-black text-secondary">Asesores que no generaron links en el periodo</h3>
            <p className="text-[11px] text-muted-foreground font-medium">{idleAdvisors.length} asesor(es) registrados sin links generados ni recaudo.</p>
          </div>
          <ChevronDown className={cn('w-5 h-5 text-muted-foreground transition-transform', showIdle && 'rotate-180')} />
        </button>
        {showIdle && (
          <ul className="px-5 pb-4 grid gap-x-6 gap-y-1 sm:grid-cols-2 text-xs max-h-72 overflow-y-auto">
            {idleAdvisors.map((a) => (
              <li key={a.email} className="flex justify-between gap-2 py-1 border-b border-border/30">
                <span className="font-bold text-secondary truncate">{a.name}</span>
                <span className="text-muted-foreground shrink-0">{a.cartera}</span>
              </li>
            ))}
            {idleAdvisors.length === 0 && <li className="text-muted-foreground font-medium">Todos los asesores tienen actividad.</li>}
          </ul>
        )}
      </section>

      {!loading && records.length > 0 && (
        <details className="bg-card rounded-2xl card-shadow px-5 py-3 text-xs">
          <summary className="cursor-pointer font-black text-secondary">¿Por qué el recaudo sale en cero o menor al esperado?</summary>
          <ul className="mt-2 space-y-1 text-muted-foreground font-medium">
            <li>Registros en el reporte bancario cargado: <b className="text-secondary">{diagnostic.total}</b></li>
            <li>Con estado RECIBO (pagados): <b className="text-secondary">{diagnostic.recibo}</b>, de los cuales de tipo "S" (recaudo efectivo): <b className="text-secondary">{diagnostic.tipoS}</b></li>
            <li>Links de pago (Regalo) generados en el panel: <b className="text-secondary">{diagnostic.links}</b></li>
            <li>Pagos RECIBO que corresponden a un link del panel: <b className="text-secondary">{diagnostic.cruzan}</b> (de tipo "S": <b className="text-secondary">{diagnostic.cruzanS}</b>)</li>
            <li>Solo los pagos de tipo "S" que corresponden a un link del panel, y cuya fecha de pago cae en el periodo elegido, suman al recaudo de cada asesor.</li>
          </ul>
        </details>
      )}

      {meta && (
        <p className="text-[11px] text-muted-foreground font-medium text-center">
          Recaudo bancario cargado desde "{meta.fileName}" ({meta.recordCount} filas){meta.uploadedAt ? ` · ${meta.uploadedAt}` : ''}. Se carga en "Seguimiento Recaudo".
        </p>
      )}
    </div>
  );
}
