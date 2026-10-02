import { useEffect, useState } from 'react';
import { User } from '../types';
import { CheckCircle2, LayoutDashboard, Check, Phone, PhoneCall, BookOpen } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'motion/react';
import { es } from 'date-fns/locale';
import { todayKey } from '@/lib/itbxCache';
import { useItbxCalls } from '@/lib/useItbxCalls';
import { useConversations } from '@/lib/useConversations';
import { useMyBitacoras, sortedDays, dayLabel } from '@/components/MyBitacoras';
import { DailyGoals } from '@/components/DailyGoals';

interface DashboardAdvisorProps {
  user: User;
}

export function DashboardAdviser({ user }: DashboardAdvisorProps) {
  // Conversaciones de Infobip + llamadas de ITBX: se cargan una vez al entrar
  // y después solo con el botón "Actualizar" (trae ambas, enfriamiento de 5 min).
  const {
    active: activeConversations,
    closedToday: closedTodayConversations,
    loading: checkingConversations,
    check: checkActiveConversations,
  } = useConversations(user);

  // Bitácoras del asesor (solo lee su propio documento) — el detalle está en Mi Perfil.
  const { data: bitacoraDoc } = useMyBitacoras(user.email);
  const latestBitacoraDay = sortedDays(bitacoraDoc)[0];
  const latestBitacora = latestBitacoraDay ? bitacoraDoc?.days[latestBitacoraDay] : undefined;

  // Llamadas según extensión ITBX — la extensión se registra en Mi Perfil.
  // Se deja elegir el día, además de "hoy", por si se necesita ver uno
  // anterior.
  const {
    dateOptions: itbxDateOptions,
    date: itbxDate,
    setDate: setItbxDate,
    total: itbxCallTotal,
    answered: itbxAnswered,
    todayAnswered: itbxTodayAnswered,
    loading: itbxLoading,
    error: itbxError,
    refresh: refreshItbx,
  } = useItbxCalls(user.extension);
  const todayBitacoras = bitacoraDoc?.days[todayKey()]?.total ?? null;

  // Un solo botón "Actualizar" trae llamadas y conversaciones a la vez (ver
  // por qué en Profile.tsx).
  const REFRESH_COOLDOWN_MS = 5 * 60 * 1000;
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  const cooldownSecondsLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const isCoolingDown = cooldownSecondsLeft > 0;
  const refreshing = checkingConversations || itbxLoading;

  const handleRefreshAll = () => {
    if (isCoolingDown || refreshing) return;
    setNow(Date.now());
    setCooldownUntil(Date.now() + REFRESH_COOLDOWN_MS);
    checkActiveConversations();
    refreshItbx();
  };

  // Una sola carga al entrar al dashboard — no cuenta para el enfriamiento
  // del botón, así que "Actualizar" queda disponible de inmediato después.
  useEffect(() => {
    checkActiveConversations();
    refreshItbx();
  }, [user.email, user.extension]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* HERO SECTION */}
      <div className="relative rounded-3xl bg-secondary p-6 md:p-5 text-white overflow-hidden shadow-lg shadow-secondary/20 transition-all duration-500 hover:shadow-primary/10 group">
        <div className="absolute top-0 right-0 w-72 h-72 bg-primary/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-[80px] group-hover:bg-primary/30 transition-colors" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-primary/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-[50px]" />

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-1 uppercase italic">Mi Gestión</h1>
            <p className="text-slate-300 text-sm font-medium max-w-md">
              Hola, {(user.name || 'Asesor').split(' ')[0]} 👋 Bienvenido a tu panel operativo diario.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
              <LayoutDashboard className="w-5 h-5 text-primary mb-1.5" />
              <p className="text-lg font-black">{(user.cartera || 'General').split(' ')[0]}</p>
              <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Cartera</p>
            </div>
          </div>
        </div>
      </div>

      {/* STATS ROW — datos reales de hoy (Infobip, ITBX y bitácoras) */}
      <div className="flex flex-wrap gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="group flex-1 min-w-[220px] max-w-xs"
        >
          <Card className="border-none shadow-md hover:shadow-xl dark:shadow-black/25 rounded-2xl overflow-hidden transition-all duration-300 bg-card/70 backdrop-blur-md border border-border/40 dark:border-border/10 h-full">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-11 h-11 shrink-0 bg-primary/10 text-primary rounded-xl flex items-center justify-center shadow-sm">
                <PhoneCall className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-2xl font-black text-secondary dark:text-foreground tracking-tight leading-tight">{activeConversations ?? '—'}</p>
                <p className="text-xs font-black text-secondary dark:text-foreground uppercase tracking-wider truncate">Conversaciones Activas Ahora</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="group flex-1 min-w-[220px] max-w-xs"
        >
          <Card className="border-none shadow-md hover:shadow-xl dark:shadow-black/25 rounded-2xl overflow-hidden transition-all duration-300 bg-card/70 backdrop-blur-md border border-border/40 dark:border-border/10 h-full">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-11 h-11 shrink-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shadow-sm">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-black text-secondary dark:text-foreground tracking-tight leading-tight">{closedTodayConversations ?? '—'}</p>
                <p className="text-xs font-black text-secondary dark:text-foreground uppercase tracking-wider truncate">Conversaciones Cerradas Hoy</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="group flex-1 min-w-[220px] max-w-xs"
        >
          <Card className="border-none shadow-md hover:shadow-xl dark:shadow-black/25 rounded-2xl overflow-hidden transition-all duration-300 bg-card/70 backdrop-blur-md border border-border/40 dark:border-border/10 h-full">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-11 h-11 shrink-0 bg-primary/10 text-primary rounded-xl flex items-center justify-center shadow-sm">
                <Phone className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                {!user.extension ? (
                  <>
                    <p className="text-2xl font-black text-secondary dark:text-foreground tracking-tight leading-tight">—</p>
                    <p className="text-xs font-black text-secondary dark:text-foreground uppercase tracking-wider truncate">Llamadas (ITBX)</p>
                    <p className="text-[9px] text-muted-foreground font-medium mt-0.5 truncate">Registra tu extensión en Mi Perfil</p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-2xl font-black text-secondary dark:text-foreground tracking-tight leading-tight">
                        {itbxLoading ? '...' : itbxError ? '—' : itbxCallTotal ?? '—'}
                      </p>
                      <Select value={itbxDate} onValueChange={setItbxDate}>
                        <SelectTrigger className="h-5 w-auto px-1.5 rounded-full text-[9px] font-bold border-none bg-transparent gap-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {itbxDateOptions.map(opt => (
                            <SelectItem key={opt.key} value={opt.key} className="text-xs font-medium">{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs font-black text-secondary dark:text-foreground uppercase tracking-wider truncate">
                      {itbxError ? 'Llamadas (ITBX) — error' : 'Llamadas (ITBX)'}
                    </p>
                    <p className="text-[9px] text-muted-foreground font-medium mt-0.5 truncate">Extensión {user.extension}</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="group flex-1 min-w-[220px] max-w-xs"
        >
          <Card className="border-none shadow-md hover:shadow-xl dark:shadow-black/25 rounded-2xl overflow-hidden transition-all duration-300 bg-card/70 backdrop-blur-md border border-border/40 dark:border-border/10 h-full">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-11 h-11 shrink-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shadow-sm">
                <PhoneCall className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-black text-secondary dark:text-foreground tracking-tight leading-tight">
                  {!user.extension || itbxError ? '—' : itbxLoading ? '...' : itbxAnswered ?? '—'}
                </p>
                <p className="text-xs font-black text-secondary dark:text-foreground uppercase tracking-wider truncate">Llamadas Contestadas</p>
                <p className="text-[9px] text-muted-foreground font-medium mt-0.5 truncate">
                  {user.extension ? 'Del día elegido en la tarjeta anterior' : 'Registra tu extensión en Mi Perfil'}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="group flex-1 min-w-[220px] max-w-xs"
        >
          <Card className="border-none shadow-md hover:shadow-xl dark:shadow-black/25 rounded-2xl overflow-hidden transition-all duration-300 bg-card/70 backdrop-blur-md border border-border/40 dark:border-border/10 h-full">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-11 h-11 shrink-0 bg-secondary/10 text-secondary rounded-xl flex items-center justify-center shadow-sm">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-black text-secondary dark:text-foreground tracking-tight leading-tight">
                  {latestBitacora ? latestBitacora.total : '—'}
                </p>
                <p className="text-xs font-black text-secondary dark:text-foreground uppercase tracking-wider truncate">Mis Bitácoras</p>
                <p className="text-[9px] text-muted-foreground font-medium mt-0.5 truncate">
                  {latestBitacora && latestBitacoraDay
                    ? `${dayLabel(latestBitacoraDay)} · ${latestBitacora.solicitudes} solicitudes`
                    : 'Aún sin datos cargados'}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <DailyGoals
        user={user}
        calls={user.extension ? itbxTodayAnswered : null}
        conversations={closedTodayConversations}
        bitacoras={todayBitacoras}
        refreshing={refreshing}
        cooldownLeft={cooldownSecondsLeft}
        onRefresh={handleRefreshAll}
      />
    </div>
  );
}
