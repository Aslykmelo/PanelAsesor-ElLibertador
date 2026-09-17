// Cliente para la API de ITBX (conmutador telefónico) — usado solo para
// traer el resumen de tráfico saliente por extensión, y así mostrarle a
// cada asesor cuántas llamadas lleva hoy según su extensión. Usa
// ITBX_API_TOKEN (variable de entorno, token de larga duración entregado
// por ITBX — nunca hardcodeado). Solo se importa desde código de servidor
// (server.ts, api/index.ts) — nunca desde src/, para que el token no
// termine en el bundle del cliente.
//
// ITBX pidió explícitamente evitar consultas frecuentes/repetitivas a este
// endpoint (ver correo de entrega de tokens) — por eso este cliente solo
// expone "traer todo el tráfico de hoy de una vez" (todas las extensiones
// en una sola llamada); la responsabilidad de no golpear esto en cada
// carga de página es del cliente (ver src/lib/itbxCache.ts, que cachea la
// respuesta en Firestore y la comparte entre todos los asesores).

function requireItbxToken(): string {
  const token = process.env.ITBX_API_TOKEN;
  if (!token) {
    throw new Error("Falta configurar ITBX_API_TOKEN en el servidor");
  }
  return token;
}

// Colombia no tiene horario de verano (UTC-5 fijo todo el año) — Vercel
// corre en UTC, así que hay que restar 5 horas para saber qué día es "hoy"
// en Bogotá.
function bogotaDateStr(): string {
  const bogota = new Date(Date.now() - 5 * 60 * 60 * 1000);
  const y = bogota.getUTCFullYear();
  const m = String(bogota.getUTCMonth() + 1).padStart(2, "0");
  const d = String(bogota.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type ItbxOutgoingRow = {
  status: string;
  source: string;
  trunk: string;
  total_calls: string;
  tmo_calls: string;
};

type ItbxOutgoingResponse = {
  error: boolean;
  registros: number;
  data: ItbxOutgoingRow[];
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// El "fecha_fin" de ITBX es EXCLUSIVO, no inclusivo: pedir fecha_inicio =
// fecha_fin = un mismo día SIEMPRE devuelve 0 registros, aunque ese día sí
// tenga llamadas (confirmado empíricamente contra su propia API: el rango
// 2026-09-16..2026-09-16 da 0, pero 2026-09-16..2026-09-17 da los mismos
// totales que muestra el dashboard web de ITBX para el 16). Por eso, para
// traer un solo día "D" hay que pedir fecha_inicio=D, fecha_fin=D+1.
function nextDayStr(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

// Llamadas salientes de un día dado, sumadas por extensión — el reporte
// viene desglosado por estado (Contestada/NoContestada/Ocupado/Fallido) y
// por troncal (ITBX/ITBX_BK), varias filas por extensión, así que hay que
// sumar todas las filas que compartan el mismo "source" (la extensión).
export async function getOutgoingCallTotals(dateStr?: string): Promise<Record<string, number>> {
  const token = requireItbxToken();
  const date = dateStr ?? bogotaDateStr();
  if (!DATE_RE.test(date)) {
    throw new Error("Fecha inválida, se espera formato YYYY-MM-DD");
  }
  const url =
    `https://api.itbx.co/api/v1/usuario/getOutgoingtraficPBX` +
    `?token=${encodeURIComponent(token)}&fecha_inicio=${date}&fecha_fin=${nextDayStr(date)}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ITBX GET getOutgoingtraficPBX respondió ${res.status}${body ? `: ${body}` : ""}`);
  }
  const data = (await res.json()) as ItbxOutgoingResponse;
  if (data.error) {
    throw new Error("ITBX reportó un error en la respuesta de getOutgoingtraficPBX");
  }

  const totals: Record<string, number> = {};
  for (const row of data.data ?? []) {
    const n = Number(row.total_calls) || 0;
    totals[row.source] = (totals[row.source] ?? 0) + n;
  }
  return totals;
}
