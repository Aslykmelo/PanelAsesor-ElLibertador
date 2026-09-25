import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { collection, doc, getDocs, writeBatch, serverTimestamp, FieldPath } from 'firebase/firestore';
import { UploadCloud, Loader2, CheckCircle, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/firebase';
import { Button } from '@/components/ui/button';
import { ADVISORS } from '@/constants';
import { logError } from '../logger';
import { User } from '../types';
import { DayStats, NameCandidate, matchAuthor, parseBitacoraRows } from '@/lib/bitacoraParse';

type Matched = { email: string; name: string; days: Record<string, DayStats> };
type Preview = {
  matched: Matched[];
  unmatched: { name: string; total: number }[];
  rowsRead: number;
  rowsSkipped: number;
  automatic: number;
  dayKeys: string[];
  fileName: string;
};

function mergeDays(a: Record<string, DayStats>, b: Record<string, DayStats>): Record<string, DayStats> {
  const out: Record<string, DayStats> = { ...a };
  for (const [day, s] of Object.entries(b)) {
    const cur = out[day];
    if (!cur) {
      out[day] = s;
      continue;
    }
    const sum = (x: Record<string, number>, y: Record<string, number>) => {
      const r = { ...x };
      for (const [k, v] of Object.entries(y)) r[k] = (r[k] ?? 0) + v;
      return r;
    };
    out[day] = {
      total: cur.total + s.total,
      solicitudes: cur.solicitudes + s.solicitudes,
      byGestion: sum(cur.byGestion, s.byGestion),
      byCanal: sum(cur.byCanal, s.byCanal),
      lastAt: cur.lastAt > s.lastAt ? cur.lastAt : s.lastAt,
    };
  }
  return out;
}

// Nombres + correos contra los que se cruza el autor de cada bitácora: la
// lista fija de la app y lo que haya en Firestore (asesores y usuarios).
async function loadCandidates(): Promise<NameCandidate[]> {
  const list: NameCandidate[] = ADVISORS.map((a) => ({ name: a.nombre, email: a.correo }));
  for (const col of ['asesores', 'users']) {
    try {
      const snap = await getDocs(collection(db, col));
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.name && data.email) list.push({ name: String(data.name), email: String(data.email) });
      });
    } catch (e) {
      logError(e as Error, `BitacorasUpload/load_${col}`);
    }
  }
  const byEmail = new Map<string, NameCandidate>();
  for (const c of list) {
    const key = c.email.trim().toLowerCase();
    if (!byEmail.has(key)) byEmail.set(key, { name: c.name, email: key });
  }
  return [...byEmail.values()];
}

export function BitacorasUpload({ currentUser }: { currentUser: User }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setWorking(true);
    setDone(null);
    setPreview(null);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
      const parsed = parseBitacoraRows(rows);
      if (parsed.authors.size === 0) {
        toast.error('No se encontraron bitácoras escritas por personas en el archivo.');
        return;
      }

      const candidates = await loadCandidates();
      const byEmail = new Map<string, Matched>();
      const unmatched: { name: string; total: number }[] = [];
      for (const author of parsed.authors.values()) {
        const total = Object.values(author.days).reduce((s, d) => s + d.total, 0);
        const m = matchAuthor(author.displayName, candidates);
        if (m.kind === 'match') {
          const prev = byEmail.get(m.email);
          byEmail.set(m.email, {
            email: m.email,
            name: m.name,
            days: prev ? mergeDays(prev.days, author.days) : author.days,
          });
        } else {
          unmatched.push({ name: m.kind === 'ambiguous' ? `${author.displayName} (nombre ambiguo)` : author.displayName, total });
        }
      }
      unmatched.sort((a, b) => b.total - a.total);

      setPreview({
        matched: [...byEmail.values()],
        unmatched,
        rowsRead: parsed.rowsRead,
        rowsSkipped: parsed.rowsSkipped,
        automatic: parsed.automatic,
        dayKeys: parsed.dayKeys,
        fileName: file.name,
      });
    } catch (e: any) {
      logError(e, 'BitacorasUpload/parse');
      toast.error(e.message || 'No fue posible leer el archivo');
    } finally {
      setWorking(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const publish = async () => {
    if (!preview) return;
    setWorking(true);
    try {
      const uploader = (currentUser.email || '').toLowerCase();
      for (let i = 0; i < preview.matched.length; i += 400) {
        const batch = writeBatch(db);
        for (const adv of preview.matched.slice(i, i + 400)) {
          // mergeFields reemplaza cada día completo (sin arrastrar desgloses
          // viejos) y deja intactos los demás días ya cargados.
          batch.set(
            doc(db, 'bitacoras', adv.email),
            { email: adv.email, name: adv.name, updatedAt: serverTimestamp(), uploadedByEmail: uploader, days: adv.days },
            {
              mergeFields: [
                'email',
                'name',
                'updatedAt',
                'uploadedByEmail',
                ...Object.keys(adv.days).map((d) => new FieldPath('days', d)),
              ],
            }
          );
        }
        await batch.commit();
      }
      setDone(`Listo: bitácoras publicadas para ${preview.matched.length} asesor(es).`);
      setPreview(null);
      toast.success('Bitácoras cargadas');
    } catch (e: any) {
      logError(e, 'BitacorasUpload/publish');
      toast.error(e.message || 'No fue posible publicar las bitácoras');
    } finally {
      setWorking(false);
    }
  };

  const matchedTotal =
    preview?.matched.reduce(
      (s: number, m: Matched) => s + (Object.values(m.days) as DayStats[]).reduce((x: number, d: DayStats) => x + d.total, 0),
      0
    ) ?? 0;

  return (
    <section className="bg-card rounded-2xl p-5 card-shadow space-y-4">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-black text-secondary">Cargar Bitácoras</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Sube el reporte "GESTION BITACORAS TOTALES" (.xlsx). Cada asesor verá solo sus propias bitácoras. Volver a subir un día lo reemplaza; los demás días se conservan.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <Button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={working}
        className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-black rounded-2xl"
      >
        {working && !preview ? <Loader2 className="w-5 h-5 animate-spin" /> : <><UploadCloud className="w-5 h-5 mr-2" /> Seleccionar archivo</>}
      </Button>

      {preview && (
        <div className="space-y-3 rounded-2xl border border-border/50 bg-muted/20 p-4 text-sm">
          <p className="font-bold text-secondary break-all">{preview.fileName}</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>Días en el archivo: <b className="text-secondary">{preview.dayKeys.join(', ') || '—'}</b></li>
            <li>Asesores identificados: <b className="text-secondary">{preview.matched.length}</b> ({matchedTotal} bitácoras)</li>
            <li>Bitácoras automáticas (ICX) que no se cuentan: <b className="text-secondary">{preview.automatic}</b></li>
            {preview.rowsSkipped > 0 && <li>Filas sin autor o fecha válida: <b className="text-secondary">{preview.rowsSkipped}</b></li>}
            <li>Autores sin coincidir con un asesor: <b className="text-secondary">{preview.unmatched.length}</b></li>
          </ul>
          {preview.unmatched.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer font-bold text-muted-foreground">Ver autores sin coincidencia (no son asesores del panel o el nombre no coincide)</summary>
              <ul className="mt-2 max-h-48 overflow-y-auto space-y-0.5 text-muted-foreground">
                {preview.unmatched.map((u) => (
                  <li key={u.name}>{u.total} · {u.name}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="flex gap-2">
            <Button type="button" onClick={publish} disabled={working || preview.matched.length === 0} className="flex-1 h-11 font-black rounded-xl">
              {working ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar y publicar'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setPreview(null)} disabled={working} className="h-11 rounded-xl">
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {done && (
        <div className="flex items-center gap-2 rounded-2xl border border-green-500/20 bg-green-500/10 p-3 text-sm font-bold text-green-700 dark:text-green-400">
          <CheckCircle className="w-4 h-4" /> {done}
        </div>
      )}
    </section>
  );
}
