import { Target, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getDailyGoal } from '@/lib/goals';
import { todayKey } from '@/lib/itbxCache';

interface DailyGoalsProps {
  user: { email: string; supervisorEmail?: string; cartera?: string; extension?: string };
  calls: number | null;
  conversations: number | null;
  bitacoras: number | null;
  refreshing: boolean;
  cooldownLeft: number;
  onRefresh: () => void;
  // La última consulta de ITBX / Infobip falló (se sigue mostrando el último dato, si hay).
  callsError?: boolean;
  conversationsError?: boolean;
  // Hora (ms) de la consulta más antigua entre llamadas y conversaciones.
  updatedAt?: number | null;
}

function GoalRow({
  label,
  hint,
  current,
  goal,
  emptyText = 'Sin dato todavía',
  loading = false,
  failed = false,
}: {
  label: string;
  hint: string;
  current: number | null;
  goal: number;
  emptyText?: string;
  loading?: boolean;
  failed?: boolean;
}) {
  const pct = current === null ? 0 : Math.min(100, Math.round((current / goal) * 100));
  const done = current !== null && current >= goal;
  const bar = done ? 'bg-emerald-500' : pct >= 50 ? 'bg-primary' : 'bg-amber-500';
  const note =
    current === null
      ? loading
        ? 'Cargando…'
        : failed
          ? 'No se pudo consultar. Pulsa "Actualizar" para reintentar.'
          : emptyText
      : done
        ? '¡Meta cumplida!'
        : `Te faltan ${goal - current}`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-secondary">{label}</p>
          <p className="text-[10px] text-muted-foreground font-medium">{hint}</p>
        </div>
        <p className="text-sm font-black text-secondary shrink-0">
          {current ?? (loading ? '…' : '—')} <span className="text-muted-foreground font-bold">/ {goal}</span>
        </p>
      </div>
      <div className="h-2.5 rounded-full bg-muted/50 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', bar)} style={{ width: `${pct}%` }} />
      </div>
      <p
        className={cn(
          'text-[11px] font-bold',
          done ? 'text-emerald-600 dark:text-emerald-400' : current === null && failed && !loading ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
        )}
      >
        {note}
      </p>
    </div>
  );
}

export function DailyGoals({ user, calls, conversations, bitacoras, refreshing, cooldownLeft, onRefresh, callsError, conversationsError, updatedAt }: DailyGoalsProps) {
  const goal = getDailyGoal(user, todayKey());
  if (!goal) return null;

  const updatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })
    : null;

  return (
    <section className="bg-card rounded-2xl p-5 card-shadow space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-black text-secondary flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Mi Meta de Hoy
          </h3>
          <p className="text-[11px] text-muted-foreground font-medium mt-1">
            {goal.isSaturday ? 'Meta de sábado (con reto)' : 'Meta de lunes a viernes'} · {goal.areaLabel}
          </p>
          {updatedLabel && <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Última actualización: {updatedLabel}</p>}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-full gap-1.5 text-xs font-bold shrink-0"
          onClick={onRefresh}
          disabled={refreshing || cooldownLeft > 0}
          title="Trae tus llamadas y conversaciones más recientes"
        >
          <RefreshCcw className={cn('w-3 h-3', refreshing && 'animate-spin')} />
          {cooldownLeft > 0 ? `${cooldownLeft}s` : 'Actualizar'}
        </Button>
      </div>

      <div className="space-y-5">
        <GoalRow
          label="Llamadas contestadas"
          hint="Según tu extensión en ITBX"
          current={calls}
          goal={goal.calls}
          loading={refreshing && !!user.extension}
          failed={callsError}
          emptyText={user.extension ? 'Sin dato todavía' : 'Registra tu extensión en Mi Perfil'}
        />
        <GoalRow label="Conversaciones" hint="Cerradas hoy en Infobip" current={conversations} goal={goal.conversations} loading={refreshing} failed={conversationsError} />
        {goal.bitacoras !== null && (
          <GoalRow
            label="Bitácoras"
            hint="Se actualiza cuando el equipo sube el reporte"
            current={bitacoras}
            goal={goal.bitacoras}
          />
        )}
      </div>
    </section>
  );
}
