import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { db } from '@/firebase';
import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { logError } from '../logger';
import { User } from '../types';
import { UploadCloud, Loader2, ListChecks } from 'lucide-react';

interface UploadCallTotalsProps {
  currentUser: User;
}

type ParsedRow = { email: string; name: string; totalCalls: number };

// Localiza una columna por su encabezado sin importar mayúsculas, tildes ni
// espacios extra — los CSV de este equipo no siempre nombran las columnas
// igual entre un corte y el siguiente.
function normalizeHeader(v: string): string {
  return String(v ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findColumn(row: Record<string, unknown>, candidates: string[]): unknown {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const key = keys.find(k => normalizeHeader(k) === candidate);
    if (key) return row[key];
  }
  // Coincidencia parcial como respaldo (ej. "total de llamadas del dia").
  for (const candidate of candidates) {
    const key = keys.find(k => normalizeHeader(k).includes(candidate));
    if (key) return row[key];
  }
  return undefined;
}

function parseRows(raw: Record<string, unknown>[]): { rows: ParsedRow[]; skipped: number } {
  const rows: ParsedRow[] = [];
  let skipped = 0;

  for (const raw_row of raw) {
    const emailRaw = findColumn(raw_row, ['correo', 'email', 'correo electronico']);
    const totalRaw = findColumn(raw_row, ['total llamadas', 'total de llamadas', 'total', 'llamadas']);
    const nameRaw = findColumn(raw_row, ['nombre', 'asesor', 'nombre asesor']);

    const email = String(emailRaw ?? '').trim().toLowerCase();
    const totalCalls = Number(String(totalRaw ?? '').replace(/[^\d.-]/g, ''));

    if (!email || !email.includes('@') || !Number.isFinite(totalCalls)) {
      skipped++;
      continue;
    }

    rows.push({ email, name: String(nameRaw ?? '').trim(), totalCalls });
  }

  return { rows, skipped };
}

export const UploadCallTotals: React.FC<UploadCallTotalsProps> = ({ currentUser }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lastResult, setLastResult] = useState<{ updated: number; skipped: number } | null>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const bstr = e.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

        const { rows, skipped } = parseRows(raw);
        if (rows.length === 0) {
          toast.error('No se encontraron filas válidas (se necesita una columna de correo y una de total de llamadas).');
          return;
        }

        setUploading(true);
        const batch = writeBatch(db);
        for (const row of rows) {
          batch.set(doc(db, 'call_totals', row.email), {
            email: row.email,
            name: row.name || null,
            totalCalls: row.totalCalls,
            uploadedAt: serverTimestamp(),
            uploadedByEmail: (currentUser.email || '').toLowerCase(),
            uploadedByName: currentUser.name || ''
          });
        }
        await batch.commit();

        setLastResult({ updated: rows.length, skipped });
        toast.success(`Totales actualizados para ${rows.length} asesor(es)${skipped > 0 ? ` (${skipped} fila(s) ignoradas)` : ''}.`);
      } catch (err: any) {
        logError(err, 'UploadCallTotals/Upload');
        toast.error(err.message || 'No fue posible procesar el archivo');
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-4 border-2 border-primary/20">
          <ListChecks className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-black text-secondary tracking-tight">Cargar Totales de Llamadas</h1>
        <p className="text-muted-foreground mt-2 font-medium">
          Sube el CSV/Excel con el correo de cada asesor y su total de llamadas. Cada asesor ve solo su propio total en su perfil.
        </p>
      </div>

      <Card className="border-none rounded-[2.5rem] card-shadow overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border/10">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-primary" />
            Archivo de Totales
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 space-y-4">
          <p className="text-xs text-muted-foreground">
            Columnas esperadas: una con el correo del asesor (ej. "Correo") y otra con el total (ej. "Total Llamadas"). El nombre de asesor es opcional. Cada fila reemplaza el total anterior de ese correo.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-black rounded-2xl"
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Seleccionar Archivo'}
          </Button>

          {lastResult && (
            <div className="bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 rounded-2xl p-4 text-sm font-bold">
              Última carga: {lastResult.updated} asesor(es) actualizados{lastResult.skipped > 0 ? `, ${lastResult.skipped} fila(s) ignoradas por no tener correo/total válido` : ''}.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
