import { Target, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getDailyGoal } from '@/lib/goals';
import { todayKey } from '@/lib/itbxCache';

interface DailyGoalsProps {
  user: { email: string; supervisorEmail?: string; cartera?: string };
  calls: number | null;
  conversations: number | null;
  bitacoras: number | null;
  callsLoading: boolean;
  callsCooldownLeft: number;
  onRefreshCalls: () => void;
}

function GoalRow({ label, hint, current, goal }: { label: string; hint: string; current: number | null; goal: number }) {
  const pct = current === null ? 0 : Math.min(100, Math.round((current / goal) * 100));
  const done = current !== null && current >= goal;
  const bar = done ? 'bg-emerald-500' : pct >= 50 ? 'bg-primary' : 'bg-amber-500';
  return (
    <div className="space-y-1.5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-secondary">{label}</p>
          <p className="text-[10px] text-muted-foreground font-medium">{hint}</p>
        </div>
        <p className="text-sm font-black text-secondary shrink-0">
          {current ?? '—'} <span className="text-muted-foreground font-bold">/ {goal}</span>
        </p>
      </div>
      <div className="h-2.5 rounded-full bg-muted/50 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', bar)} style={{ width: `${pct}%` }} />
      </div>
      <p className={cn('text-[11px] font-bold', done ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
        {current === null ? 'Sin dato todavía' : done ? '¡Meta cumplida!' : `Te faltan ${goal - current}`}
      </p>
    </div>
  );
}

export function DailyGoals({ user, calls, conversations, bitacoras, callsLoading, callsCooldownLeft, onRefreshCalls }: DailyGoalsProps) {
  const goal = getDailyGoal(user, todayKey());
  if (!goal) return null;

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
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-full gap-1.5 text-xs font-bold shrink-0"
          onClick={onRefreshCalls}
          disabled={callsLoading || callsCooldownLeft > 0}
          title="Vuelve a consultar tus llamadas en ITBX"
        >
          <RefreshCcw className={cn('w-3 h-3', callsLoading && 'animate-spin')} />
          {callsCooldownLeft > 0 ? `${callsCooldownLeft}s` : 'Actualizar llamadas'}
        </Button>
      </div>

      <div className="space-y-5">
        <GoalRow label="Llamadas contestadas" hint="Según tu extensión en ITBX" current={calls} goal={goal.calls} />
        <GoalRow label="Conversaciones" hint="Cerradas hoy en Infobip" current={conversations} goal={goal.conversations} />
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
