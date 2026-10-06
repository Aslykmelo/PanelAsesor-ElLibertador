import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/firebase';

// Recaudo bancario compartido en Firestore.
//
// "Seguimiento Recaudo" guardaba el reporte del banco en Supabase, pero este
// despliegue no tiene Supabase configurado: sin eso el recaudo quedaba solo
// en el navegador de quien subió el Excel (localStorage) y nadie más — ni la
// pantalla de Premiación — podía verlo. Cuando no hay Supabase, el recaudo se
// guarda aquí, en la colección `recaudo_shared`: un documento `meta` y los
// registros repartidos en documentos `chunk_NNN` (400 por documento, para
// leer pocos documentos y no pasar el límite de 1 MB).
const COL = 'recaudo_shared';
const CHUNK_SIZE = 400;
const LOCAL_RECORDS_KEY = 'recaudo_historico_local_cache';
const LOCAL_META_KEY = 'recaudo_excel_metadata_v2';

export type SharedRecaudoMeta = {
  fileName: string;
  uploadedAtDate: string;
  uploadedAtTime: string;
  uploaderName: string;
  uploaderEmail: string;
  recordCount: number;
};

// `exists`: ya hay recaudo compartido en Firestore (aunque esté vacío por un reinicio).
export type SharedRecaudo<T> = { records: T[]; meta: SharedRecaudoMeta | null; exists: boolean };

async function readShared<T>(): Promise<SharedRecaudo<T>> {
  const snap = await getDocs(collection(db, COL));
  let exists = false;
  let meta: SharedRecaudoMeta | null = null;
  const chunks: { id: string; records: T[] }[] = [];
  snap.docs.forEach((d) => {
    if (d.id === 'meta') {
      exists = true;
      meta = (d.data().meta as SharedRecaudoMeta | null) ?? null;
    } else if (d.id.startsWith('chunk_')) {
      chunks.push({ id: d.id, records: (d.data().records as T[]) ?? [] });
    }
  });
  chunks.sort((a, b) => a.id.localeCompare(b.id));
  return { exists, meta, records: chunks.flatMap((c) => c.records) };
}

// Reemplaza TODO el recaudo compartido (el Excel se procesa de forma
// incremental y ya produce la lista completa). Con `records` vacío queda
// "reiniciado": el documento `meta` sigue existiendo para que la copia
// vieja de algún navegador no vuelva a subirse sola (ver loadOrMigrate).
export async function saveRecaudoShared<T extends object>(records: T[], meta: SharedRecaudoMeta | null): Promise<void> {
  // JSON quita los `undefined`, que Firestore no acepta.
  const clean = JSON.parse(JSON.stringify(records)) as T[];
  const existing = await getDocs(collection(db, COL));
  const keep = new Set<string>(['meta']);
  const ops: ((b: ReturnType<typeof writeBatch>) => void)[] = [];

  for (let i = 0; i * CHUNK_SIZE < clean.length; i++) {
    const id = `chunk_${String(i).padStart(3, '0')}`;
    keep.add(id);
    const slice = clean.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    ops.push((b) => b.set(doc(db, COL, id), { records: slice }));
  }
  ops.push((b) => b.set(doc(db, COL, 'meta'), { meta: meta ?? null, recordCount: clean.length, updatedAt: new Date().toISOString() }));
  existing.docs.forEach((d) => {
    if (!keep.has(d.id)) ops.push((b) => b.delete(d.ref));
  });

  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    ops.slice(i, i + 400).forEach((op) => op(batch));
    await batch.commit();
  }
}

// Lee el recaudo compartido. Si todavía no existe (nadie lo ha subido a
// Firestore) y este navegador tiene una copia local de un cargue anterior, la
// sube para no obligar a volver a cargar el Excel.
export async function loadRecaudoShared<T extends object>(): Promise<SharedRecaudo<T>> {
  const shared = await readShared<T>();
  if (shared.exists) return shared;

  try {
    const cached = localStorage.getItem(LOCAL_RECORDS_KEY);
    const records: T[] = cached ? JSON.parse(cached) : [];
    if (records.length > 0) {
      const rawMeta = localStorage.getItem(LOCAL_META_KEY);
      const meta: SharedRecaudoMeta | null = rawMeta ? JSON.parse(rawMeta) : null;
      await saveRecaudoShared(records, meta);
      return { records, meta, exists: true };
    }
  } catch (e) {
    console.error('No se pudo migrar el recaudo local a Firestore:', e);
  }
  return { records: [], meta: null, exists: false };
}
