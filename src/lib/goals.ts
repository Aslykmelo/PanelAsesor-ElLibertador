// Metas diarias por equipo. Para cambiarlas basta editar estas tablas.
//
// - "llamadas" es el ALO del reporte de metas: llamadas CONTESTADAS.
// - "conversaciones" se mide con las conversaciones cerradas hoy en Infobip.
// - bitacoras = null significa que ese equipo no tiene meta de bitácoras.

import { ADVISORS } from '@/constants';

export type Goal = { calls: number; conversations: number; bitacoras: number | null };
type Area = 'prejuridico' | 'cuotas' | 'copropiedades' | 'desocupados';

export const AREA_LABEL: Record<Area, string> = {
  prejuridico: 'Prejurídico / Jurídico',
  cuotas: 'Cuotas al día',
  copropiedades: 'Copropiedades',
  desocupados: 'Desocupados',
};

// Meta de lunes a viernes.
const WEEKDAY_GOALS: Record<Area, Goal> = {
  prejuridico: { calls: 31, conversations: 53, bitacoras: 50 },
  cuotas: { calls: 44, conversations: 44, bitacoras: 35 },
  copropiedades: { calls: 30, conversations: 25, bitacoras: null },
  desocupados: { calls: 35, conversations: 57, bitacoras: 50 },
};

// Meta de los sábados (con reto).
const SATURDAY_GOALS: Record<Area, Goal> = {
  prejuridico: { calls: 9, conversations: 16, bitacoras: 9 },
  cuotas: { calls: 13, conversations: 13, bitacoras: 9 },
  copropiedades: { calls: 9, conversations: 7, bitacoras: null },
  desocupados: { calls: 10, conversations: 17, bitacoras: 9 },
};

const AREA_BY_SUPERVISOR: Record<string, Area> = {
  'luis.mondragon@segurosbolivar.com': 'prejuridico',
  'ana.gutierrez@segurosbolivar.com': 'prejuridico',
  'yulieth.moreno@segurosbolivar.com': 'prejuridico',
  'lizeth.osma@segurosbolivar.com': 'cuotas',
  'mabel.elizabeth.andrade@segurosbolivar.com': 'desocupados',
};

function areaFor(email: string, supervisorEmail?: string, cartera?: string): Area | null {
  let sup = (supervisorEmail || '').toLowerCase();
  let car = (cartera || '').toLowerCase();
  // Si el perfil no trae supervisor/cartera, se busca en la lista de asesores.
  if (!AREA_BY_SUPERVISOR[sup]) {
    const known = ADVISORS.find((a) => a.correo.toLowerCase() === email.toLowerCase());
    if (known) {
      sup = known.correo_supervisor.toLowerCase();
      car = known.cartera.toLowerCase();
    }
  }
  const area = AREA_BY_SUPERVISOR[sup];
  if (!area) return null;
  return area === 'cuotas' && car.includes('copropiedad') ? 'copropiedades' : area;
}

export type DailyGoal = Goal & { area: Area; areaLabel: string; isSaturday: boolean };

// Meta del día `dayKey` (YYYY-MM-DD, hora de Bogotá) para un asesor; null si
// no tiene equipo con meta o es domingo.
export function getDailyGoal(
  user: { email: string; supervisorEmail?: string; cartera?: string },
  dayKey: string
): DailyGoal | null {
  const area = areaFor(user.email || '', user.supervisorEmail, user.cartera);
  if (!area) return null;
  const dow = new Date(`${dayKey}T12:00:00`).getDay();
  if (dow === 0) return null;
  const isSaturday = dow === 6;
  const goal = (isSaturday ? SATURDAY_GOALS : WEEKDAY_GOALS)[area];
  return { ...goal, area, areaLabel: AREA_LABEL[area], isSaturday };
}
