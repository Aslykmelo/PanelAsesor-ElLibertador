import { useEffect, useState } from 'react';
import { useConversations } from '@/lib/useConversations';
import { useItbxCalls } from '@/lib/useItbxCalls';

const REFRESH_COOLDOWN_MS = 5 * 60 * 1000;
// Si la consulta falla, el botón no se bloquea 5 minutos: solo unos segundos.
const RETRY_AFTER_FAILURE_MS = 20 * 1000;
// Pausas entre los intentos de la carga inicial (el primero es inmediato).
const ENTRY_RETRY_WAITS_MS = [0, 5000, 12000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface MyDayUser {
  email: string;
  name?: string;
  supervisorEmail?: string;
  cartera?: string;
  extension?: string;
}

// Conversaciones (Infobip) + llamadas (ITBX) del asesor, con el único botón
// "Actualizar" y su enfriamiento de 5 minutos. Lo comparten Mi Gestión y Mi
// Perfil.
//
// - Al entrar se carga UNA vez sin gastar el enfriamiento; si falla, reintenta
//   sola dos veces más (a los 5 y a los 12 segundos), porque cuando muchos
//   asesores entran a la vez Infobip responde "demasiadas peticiones".
// - Si "Actualizar" falla, el enfriamiento se libera casi de inmediato.
export function useMyDayStats(user: MyDayUser) {
  const conversations = useConversations(user);
  const itbx = useItbxCalls(user.extension);

  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  const cooldownSecondsLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const refreshing = conversations.loading || itbx.loading;

  const fetchAll = async (): Promise<boolean> => {
    const [convOk, itbxOk] = await Promise.all([conversations.check(), itbx.refresh()]);
    return convOk && itbxOk;
  };

  const startCooldown = (ms: number) => {
    setNow(Date.now());
    setCooldownUntil(Date.now() + ms);
  };

  const handleRefreshAll = async () => {
    if (cooldownSecondsLeft > 0 || refreshing) return;
    startCooldown(REFRESH_COOLDOWN_MS);
    const ok = await fetchAll();
    if (!ok) startCooldown(RETRY_AFTER_FAILURE_MS);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const wait of ENTRY_RETRY_WAITS_MS) {
        if (wait) await sleep(wait);
        if (cancelled) return;
        if (await fetchAll()) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user.email, user.extension]);

  const updatedTimes = [conversations.updatedAt, user.extension ? itbx.updatedAt : null].filter((t): t is number => t !== null);

  return {
    activeConversations: conversations.active,
    closedTodayConversations: conversations.closedToday,
    conversationsError: conversations.error,
    callsFailed: itbx.failed,
    itbxDateOptions: itbx.dateOptions,
    itbxDate: itbx.date,
    setItbxDate: itbx.setDate,
    itbxCallTotal: itbx.total,
    itbxAnswered: itbx.answered,
    itbxTodayAnswered: itbx.todayAnswered,
    itbxLoading: itbx.loading,
    itbxError: itbx.error,
    refreshing,
    cooldownSecondsLeft,
    handleRefreshAll,
    // Hora de la consulta más antigua entre las dos — la que manda para saber
    // "qué tan viejo" es lo que se está viendo.
    updatedAt: updatedTimes.length ? Math.min(...updatedTimes) : null,
  };
}
