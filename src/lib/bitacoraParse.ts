// Lectura de los reportes de bitácoras ("GESTION BITACORAS TOTALES" y "CUOTAS AL DIA CON GESTION", mismo formato) y cruce de nombres con los
// asesores. Es lógica pura (sin Firebase) para poder probarla aparte.
//
// El reporte no trae correos: cada fila es UNA bitácora, con el nombre de
// quien la escribió ("Nombre completo") — a veces un compañero y a veces el
// sistema ("ICX Admin"). Se cuentan solo las escritas por personas y se
// asignan al asesor cuyo nombre coincida.

export type DayStats = {
  total: number;
  solicitudes: number;
  byGestion: Record<string, number>;
  byCanal: Record<string, number>;
  lastAt: string;
};

export type AuthorAgg = {
  displayName: string;
  days: Record<string, DayStats>;
};

export type ParseResult = {
  authors: Map<string, AuthorAgg>;
  rowsRead: number;
  rowsSkipped: number;
  automatic: number;
  dayKeys: string[];
};

const STOPWORDS = new Set(['DE', 'LA', 'DEL', 'LOS', 'LAS', 'Y', 'ABOG', 'DR', 'DRA']);

export function normalizeHeader(v: unknown): string {
  return String(v ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function nameTokens(name: string): Set<string> {
  const tokens = name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
  return new Set(tokens);
}

function tokenKey(tokens: Set<string>): string {
  return [...tokens].sort().join(' ');
}

// Los pocos textos libres del reporte pueden traer caracteres que Firestore
// no admite en nombres de campo.
function safeLabel(v: unknown, fallback: string): string {
  const s = String(v ?? '')
    .replace(/[./~*[\]`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s || fallback;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// Devuelve { day: "YYYY-MM-DD", at: "YYYY-MM-DD HH:mm" } o null.
function parseDate(v: unknown): { day: string; at: string } | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    const day = `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
    return { day, at: `${day} ${pad(v.getHours())}:${pad(v.getMinutes())}` };
  }
  if (typeof v === 'number' && v > 20000) {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    const day = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    return { day, at: `${day} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` };
  }
  const m = String(v ?? '')
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const day = `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  return { day, at: `${day} ${pad(Number(m[4] ?? 0))}:${m[5] ?? '00'}` };
}

export function parseBitacoraRows(rows: unknown[][]): ParseResult {
  const headerIdx = rows.slice(0, 30).findIndex((r) => r.some((c) => normalizeHeader(c) === '# solicitud'));
  if (headerIdx < 0) {
    throw new Error('No se encontró la fila de encabezados (columna "# Solicitud"). ¿Es el reporte de bitácoras?');
  }
  const norm = rows[headerIdx].map(normalizeHeader);
  const solCol = norm.indexOf('# solicitud');
  const authorCol = norm.indexOf('nombre completo');
  const dateCol = norm.findIndex((h, i) => i > authorCol && h === 'fecha de creacion');
  const gestionCol = norm.indexOf('gestion de pago');
  const canalCol = norm.indexOf('canal de gestion');
  if (authorCol < 0 || dateCol < 0) {
    throw new Error('Faltan columnas: se necesita "Nombre completo" y la "Fecha de creación" de la bitácora.');
  }

  type Tmp = { displayName: string; days: Map<string, { total: number; sols: Set<string>; byGestion: Record<string, number>; byCanal: Record<string, number>; lastAt: string }> };
  const tmp = new Map<string, Tmp>();
  const dayKeys = new Set<string>();
  let rowsRead = 0;
  let rowsSkipped = 0;
  let automatic = 0;

  for (const r of rows.slice(headerIdx + 1)) {
    const sol = String(r[solCol] ?? '').trim();
    if (!sol) continue;
    rowsRead++;

    const authorRaw = String(r[authorCol] ?? '').trim();
    const lower = authorRaw.toLowerCase();
    if (lower.startsWith('icx')) {
      automatic++;
      continue;
    }
    const tokens = nameTokens(authorRaw);
    const when = parseDate(r[dateCol]);
    if (!authorRaw || lower === 'sin valor' || tokens.size === 0 || !when) {
      rowsSkipped++;
      continue;
    }

    const key = tokenKey(tokens);
    let agg = tmp.get(key);
    if (!agg) {
      agg = { displayName: authorRaw.replace(/^abog\.?_?\s*/i, '').replace(/\s+/g, ' ').trim(), days: new Map() };
      tmp.set(key, agg);
    }
    let day = agg.days.get(when.day);
    if (!day) {
      day = { total: 0, sols: new Set(), byGestion: {}, byCanal: {}, lastAt: '' };
      agg.days.set(when.day, day);
    }
    day.total++;
    day.sols.add(sol);
    const g = safeLabel(gestionCol >= 0 ? r[gestionCol] : '', 'Sin dato');
    day.byGestion[g] = (day.byGestion[g] ?? 0) + 1;
    const rawCanal = safeLabel(canalCol >= 0 ? r[canalCol] : '', 'Sin canal');
    const c = rawCanal === 'Sin valor' ? 'Sin canal' : rawCanal;
    day.byCanal[c] = (day.byCanal[c] ?? 0) + 1;
    if (when.at > day.lastAt) day.lastAt = when.at;
    dayKeys.add(when.day);
  }

  const authors = new Map<string, AuthorAgg>();
  for (const [key, a] of tmp) {
    const days: Record<string, DayStats> = {};
    for (const [d, s] of a.days) {
      days[d] = { total: s.total, solicitudes: s.sols.size, byGestion: s.byGestion, byCanal: s.byCanal, lastAt: s.lastAt };
    }
    authors.set(key, { displayName: a.displayName, days });
  }
  return { authors, rowsRead, rowsSkipped, automatic, dayKeys: [...dayKeys].sort() };
}

export type NameCandidate = { name: string; email: string };

export type MatchOutcome =
  | { kind: 'match'; email: string; name: string }
  | { kind: 'ambiguous'; options: string[] }
  | { kind: 'none' };

// Coincide si TODOS los nombres/apellidos del más corto están en el más
// largo (y son al menos 2) — así "ANYI URREA" encaja con "Anyi Paola Urrea
// Saenz" y los nombres escritos con los apellidos primero también.
// Dos palabras iguales, o (si son largas) que difieran en una sola letra
// faltante — el reporte a veces pierde la "ñ" ("ESTUPIAN" por "ESTUPIÑAN").
function sameToken(x: string, y: string): boolean {
  if (x === y) return true;
  // Una letra cambiada en palabras largas ("STIVEN" por "STEVEN").
  if (x.length === y.length && x.length >= 6) {
    let diff = 0;
    for (let i = 0; i < x.length && diff < 2; i++) if (x[i] !== y[i]) diff++;
    if (diff === 1) return true;
  }
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (long.length < 6 || long.length - short.length !== 1) return false;
  for (let i = 0; i < long.length; i++) {
    if (long.slice(0, i) + long.slice(i + 1) === short) return true;
  }
  return false;
}

export function matchAuthor(authorName: string, candidates: NameCandidate[]): MatchOutcome {
  const a = nameTokens(authorName);
  let bestScore = 0;
  let best = new Map<string, string>();
  for (const cand of candidates) {
    const email = cand.email.trim().toLowerCase();
    if (!email) continue;
    const c = nameTokens(cand.name);
    let shared = 0;
    for (const t of a) {
      if (c.has(t) || [...c].some((u) => sameToken(t, u))) shared++;
    }
    if (shared < 2 || (shared !== a.size && shared !== c.size)) continue;
    if (shared > bestScore) {
      bestScore = shared;
      best = new Map([[email, cand.name]]);
    } else if (shared === bestScore) {
      best.set(email, cand.name);
    }
  }
  if (best.size === 0) return { kind: 'none' };
  if (best.size > 1) return { kind: 'ambiguous', options: [...best.values()] };
  const [email, name] = [...best][0];
  return { kind: 'match', email, name };
}
