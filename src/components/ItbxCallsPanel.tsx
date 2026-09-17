import { useEffect, useMemo, useState } from 'react';
import { db } from '@/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, Search, RefreshCcw, PhoneCall, Users as UsersIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { getExtensionCallTotalsForDate, recentDateOptions, todayKey } from '@/lib/itbxCache';

interface ExtensionRow {
  extension: string;
  total: number;
  advisorName: string | null;
  advisorEmail: string | null;
}

export function ItbxCallsPanel() {
  const dateOptions = recentDateOptions(7);
  const [selectedDate, setSelectedDate] = useState(dateOptions[0]?.key ?? todayKey());
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [extensionOwners, setExtensionOwners] = useState<Record<string, { name: string; email: string }>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Quién tiene registrada cada extensión — se busca en 'users' (cada
  // asesor la escribe una vez en su perfil), no depende de ITBX.
  useEffect(() => {
    const loadOwners = async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const map: Record<string, { name: string; email: string }> = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          if (data.extension) {
            map[data.extension] = { name: data.name || data.email || 'Sin nombre', email: data.email || '' };
          }
        });
        setExtensionOwners(map);
      } catch (e) {
        console.error('Error al cargar extensiones registradas:', e);
      }
    };
    loadOwners();
  }, []);

  const loadTotals = async (dateKey: string) => {
    setLoading(true);
    try {
      const data = await getExtensionCallTotalsForDate(dateKey);
      setTotals(data);
    } catch (e: any) {
      console.error('Error al consultar llamadas ITBX:', e);
      toast.error(e.message || 'No fue posible consultar ITBX');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTotals(selectedDate);
  }, [selectedDate]);

  const rows: ExtensionRow[] = useMemo(() => {
    return Object.entries(totals)
      .map(([extension, total]: [string, number]) => ({
        extension,
        total,
        advisorName: extensionOwners[extension]?.name ?? null,
        advisorEmail: extensionOwners[extension]?.email ?? null,
      }))
      .sort((a, b) => b.total - a.total);
  }, [totals, extensionOwners]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        r.extension.toLowerCase().includes(term) ||
        (r.advisorName || '').toLowerCase().includes(term) ||
        (r.advisorEmail || '').toLowerCase().includes(term)
    );
  }, [rows, search]);

  const grandTotal = rows.reduce((acc, r) => acc + r.total, 0);
  const registeredCount = Object.keys(extensionOwners).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-secondary flex items-center gap-2">
            <Phone className="w-6 h-6 text-primary" />
            Llamadas por Extensión (ITBX)
          </h1>
          <p className="text-sm text-muted-foreground font-medium mt-1">
            Reporte de tráfico saliente de toda la cuenta, por extensión.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedDate} onValueChange={setSelectedDate}>
            <SelectTrigger className="h-10 w-[140px] rounded-xl font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {dateOptions.map((opt) => (
                <SelectItem key={opt.key} value={opt.key} className="font-medium">{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-xl"
            onClick={() => loadTotals(selectedDate)}
            disabled={loading}
            title="Refrescar"
          >
            <RefreshCcw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-none shadow-md rounded-2xl bg-card/70">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="w-11 h-11 shrink-0 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-black text-secondary">{grandTotal}</p>
              <p className="text-xs font-bold text-muted-foreground uppercase">Llamadas Totales</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md rounded-2xl bg-card/70">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="w-11 h-11 shrink-0 bg-secondary/10 text-secondary rounded-xl flex items-center justify-center">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-black text-secondary">{rows.length}</p>
              <p className="text-xs font-bold text-muted-foreground uppercase">Extensiones con Actividad</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md rounded-2xl bg-card/70">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="w-11 h-11 shrink-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
              <UsersIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-black text-secondary">{registeredCount}</p>
              <p className="text-xs font-bold text-muted-foreground uppercase">Asesores con Extensión Registrada</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-md rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-lg font-black text-secondary">Detalle por Extensión</CardTitle>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar extensión o asesor..."
                className="pl-9 h-10 rounded-xl"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left">
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Extensión</th>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Asesor</th>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-[10px] tracking-wider text-right">Llamadas</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, i) => (
                  <motion.tr
                    key={row.extension}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.4) }}
                    className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-5 py-3 font-bold text-secondary">{row.extension}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {row.advisorName ?? <span className="italic">Sin asesor asociado</span>}
                    </td>
                    <td className="px-5 py-3 text-right font-black text-secondary">{row.total}</td>
                  </motion.tr>
                ))}
                {!loading && filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-10 text-center text-muted-foreground font-medium">
                      No hay llamadas registradas para este día.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
