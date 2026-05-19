import { useMemo, useState } from 'react';
import { Transfer, Advisor } from '../types';
import { 
  Trophy, 
  DollarSign, 
  Star, 
  TrendingUp,
  Award,
  Download,
  Search,
  Filter,
  Users,
  FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface RankingProps {
  transfers: Transfer[];
  advisors: Advisor[];
}

export function Ranking({ transfers, advisors }: RankingProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [supervisorFilter, setSupervisorFilter] = useState('todos');
  const [carteraFilter, setCarteraFilter] = useState('todos');

  const supervisors = useMemo(() => {
    const fromAdvisors = new Set(advisors.map(a => a.supervisor).filter(Boolean));
    const fromTransfers = new Set(transfers.map(t => t.supervisorName).filter(Boolean));
    return Array.from(new Set([...Array.from(fromAdvisors), ...Array.from(fromTransfers)]));
  }, [advisors, transfers]);

  const carteras = useMemo(() => {
    const fromAdvisors = new Set(advisors.map(a => a.cartera).filter(Boolean));
    const fromTransfers = new Set(transfers.map(t => t.cartera).filter(Boolean));
    return Array.from(new Set([...Array.from(fromAdvisors), ...Array.from(fromTransfers)]));
  }, [advisors, transfers]);

  const filteredTransfers = useMemo(() => {
    return transfers.filter(t => {
      const matchesSearch = 
        t.fromAdvisorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.fromAdvisorEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.toAdvisorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.toAdvisorEmail.toLowerCase().includes(searchTerm.toLowerCase());
      
      const advisorData = advisors.find(a => a.email.toLowerCase() === t.fromAdvisorEmail.toLowerCase());
      
      const matchesSupervisor = supervisorFilter === 'todos' || 
        t.supervisorName === supervisorFilter || 
        advisorData?.supervisor === supervisorFilter;
      
      const matchesCartera = carteraFilter === 'todos' || 
        t.cartera === carteraFilter || 
        advisorData?.cartera === carteraFilter;

      return matchesSearch && matchesSupervisor && matchesCartera;
    });
  }, [transfers, searchTerm, supervisorFilter, carteraFilter, advisors]);

  const rankingData = useMemo(() => {
    const counts: Record<string, { 
      count: number, 
      name: string, 
      email: string,
      totalValue: number,
      receiveCount: number,
      linksCount: number
    }> = {};

    filteredTransfers.forEach(t => {
      // 1. REGISTRAR STATS (QUIEN REALIZA LA ACCIÓN)
      const creatorEmail = t.createdByEmail || t.fromAdvisorEmail;
      const creatorName = t.createdByName || t.fromAdvisorName;

      if (!counts[creatorEmail]) {
        counts[creatorEmail] = { count: 0, name: creatorName, email: creatorEmail, totalValue: 0, receiveCount: 0, linksCount: 0 };
      }
      counts[creatorEmail].count++;

      // 2. RESPONSIBLE STATS (A QUIEN PERTENECE EL CASO)
      if (!counts[t.toAdvisorEmail]) {
        counts[t.toAdvisorEmail] = { count: 0, name: t.toAdvisorName, email: t.toAdvisorEmail, totalValue: 0, receiveCount: 0, linksCount: 0 };
      }
      counts[t.toAdvisorEmail].receiveCount++;
      counts[t.toAdvisorEmail].totalValue += (t.paymentLinkValue || 0);
      if (t.type === 'regalo') {
        counts[t.toAdvisorEmail].linksCount++;
      }
    });

    return Object.values(counts);
  }, [filteredTransfers]);

  const topLinks = useMemo(() => [...rankingData].sort((a, b) => b.linksCount - a.linksCount).slice(0, 3), [rankingData]);
  const topSenders = useMemo(() => [...rankingData].sort((a, b) => b.count - a.count).slice(0, 3), [rankingData]);
  const topReceivers = useMemo(() => [...rankingData].sort((a, b) => b.receiveCount - a.receiveCount).slice(0, 3), [rankingData]);

  const fullRanking = useMemo(() => [...rankingData].sort((a, b) => b.count - a.count), [rankingData]);

  const exportToPDF = () => {
    if (fullRanking.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    const doc = new jsPDF();
    
    // Header background
    doc.setFillColor(21, 49, 87); // Corporate Navy
    doc.rect(0, 0, 210, 40, 'F');
    
    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('EL LIBERTADOR', 105, 18, { align: 'center' });
    doc.setFontSize(14);
    doc.text('REPORTES DE DESEMPEÑO CORPORATIVO', 105, 28, { align: 'center' });
    
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-CO')} ${new Date().toLocaleTimeString()}`, 105, 36, { align: 'center' });

    // Table
    autoTable(doc, {
      startY: 50,
      head: [['#', 'Asesor', 'Email', 'Envíos', 'Recibs', 'Links', 'Valor Total']],
      body: fullRanking.map((adv, idx) => [
        idx + 1,
        adv.name.toUpperCase(),
        adv.email,
        adv.count,
        adv.receiveCount,
        adv.linksCount,
        `$${adv.totalValue.toLocaleString('es-CO')}`
      ]),
      headStyles: { 
        fillColor: [161, 22, 27], 
        textColor: 255, 
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold' },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'right', fontStyle: 'bold' }
      },
      styles: { fontSize: 8, font: 'helvetica' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { top: 50 }
    });

    doc.save(`ranking_libertador_${(new Date().toISOString() || 'report').split('T')[0]}.pdf`);
    toast.success('PDF generado con éxito');
  };

  return (
    <div className="space-y-12 py-4 md:py-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
      
      {/* CUADRO DE HONOR SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="text-center md:text-left space-y-2">
          <h1 className="text-4xl md:text-5xl font-black text-secondary tracking-tighter uppercase italic">Cuadro de Honor</h1>
          <p className="text-muted-foreground max-w-2xl font-bold uppercase text-[10px] tracking-widest leading-relaxed">
            Reconocimiento a los asesores con mejor desempeño en la gestión.
          </p>
        </div>
        <Button 
          onClick={exportToPDF}
          className="bg-primary hover:bg-primary/90 text-white font-black rounded-2xl h-12 px-8 shadow-xl shadow-primary/20 transition-all hover:scale-105"
        >
          <FileText className="w-5 h-5 mr-2" />
          DESCARGAR REPORTE PDF
        </Button>
      </div>

      {/* FILTERS */}
      <Card className="rounded-[2.5rem] border-none shadow-2xl bg-card/60 backdrop-blur-xl ring-1 ring-white/10 overflow-hidden">
        <div className="bg-muted/30 px-8 py-3 border-b border-border/10">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary/50">Panel de Filtros Avanzados</p>
        </div>
        <CardContent className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-2 space-y-2.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Búsqueda por Asesor</Label>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input 
                  placeholder="Nombre o correo corporativo..." 
                  className="pl-12 h-14 bg-muted/40 border-none rounded-2xl font-bold text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Filtro Supervisor</Label>
              <Select value={supervisorFilter} onValueChange={setSupervisorFilter}>
                <SelectTrigger className="h-14 bg-muted/40 border-none rounded-2xl font-bold text-sm">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-2xl">
                  <SelectItem value="todos" className="font-bold">Todos los supervisores</SelectItem>
                  {supervisors.map(sup => (
                    <SelectItem key={sup} value={sup} className="font-bold">{sup}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Filtro Cartera</Label>
              <Select value={carteraFilter} onValueChange={setCarteraFilter}>
                <SelectTrigger className="h-14 bg-muted/40 border-none rounded-2xl font-bold text-sm">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-2xl">
                  <SelectItem value="todos" className="font-bold">Todas las carteras</SelectItem>
                  {carteras.map(cart => (
                    <SelectItem key={cart} value={cart} className="font-bold">{cart}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* TOP LINKS PAGOS */}
        <Card className="rounded-3xl border border-secondary/10 card-shadow-sm overflow-hidden bg-card">
          <CardHeader className="py-6 px-8 border-b border-border/10 flex flex-row items-center gap-3">
            <DollarSign className="w-5 h-5 text-yellow-500" />
            <CardTitle className="text-base font-black text-secondary tracking-tight">Top Generación Links</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {topLinks.map((adv, i) => (
              <div key={adv.email} className={cn(
                "p-4 rounded-2xl border flex items-center justify-between group transition-all",
                i === 0 ? "border-yellow-500/30 bg-yellow-50/10" : "border-border/50 bg-muted/5"
              )}>
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm",
                    i === 0 ? "bg-yellow-400" : "bg-slate-200"
                  )}>
                    <Trophy className={cn("w-5 h-5", i === 0 ? "text-white" : "text-slate-400")} />
                  </div>
                  <div>
                    <p className="font-black text-secondary text-sm leading-tight uppercase">{adv.name}</p>
                    <p className="text-[10px] font-bold text-secondary/40 whitespace-nowrap">${adv.totalValue.toLocaleString('es-CO')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-secondary text-xl">{adv.linksCount}</p>
                  <div className="flex items-center justify-end gap-1 text-[10px] font-black text-green-600">
                    <TrendingUp className="w-3 h-3" /> TOP {i + 1}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* TOP ENVÍOS */}
        <Card className="rounded-3xl border border-secondary/10 card-shadow-sm overflow-hidden bg-card">
          <CardHeader className="py-6 px-8 border-b border-border/10 flex flex-row items-center gap-3">
            <Trophy className="w-5 h-5 text-secondary" />
            <CardTitle className="text-base font-black text-secondary tracking-tight">Top Asesores que Envían</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {topSenders.map((adv, i) => (
              <div key={adv.email} className={cn(
                "p-4 rounded-2xl border flex items-center justify-between group transition-all",
                i === 0 ? "border-primary/30 bg-primary/5" : "border-border/50 bg-muted/5"
              )}>
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm",
                    i === 0 ? "bg-yellow-400" : "bg-slate-300"
                  )}>
                    <Award className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-black text-secondary text-sm leading-tight uppercase">{adv.name}</p>
                    {i === 0 && <p className="text-[10px] font-bold text-secondary/40 whitespace-nowrap">LÍDER ACTUAL</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-secondary text-xl">{adv.count}</p>
                  <div className="flex items-center justify-end gap-1 text-[10px] font-black text-green-600">
                    <TrendingUp className="w-3 h-3" /> TOP {i + 1}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* TOP RECIBEN */}
        <Card className="rounded-3xl border border-secondary/10 card-shadow-sm overflow-hidden bg-card">
          <CardHeader className="py-6 px-8 border-b border-border/10 flex flex-row items-center gap-3">
            <Star className="w-5 h-5 text-secondary" />
            <CardTitle className="text-base font-black text-secondary tracking-tight">Top Asesores que Reciben</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {topReceivers.map((adv, i) => (
              <div key={adv.email} className={cn(
                "p-4 rounded-2xl border flex items-center justify-between group transition-all",
                i === 0 ? "border-secondary/30 bg-secondary/5" : "border-border/50 bg-muted/5"
              )}>
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm",
                    i === 0 ? "bg-yellow-400" : i === 1 ? "bg-slate-400" : "bg-orange-400"
                  )}>
                    <Trophy className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-black text-secondary text-sm leading-tight uppercase">{adv.name}</p>
                    {i === 0 && <p className="text-[10px] font-bold text-secondary/40 whitespace-nowrap">LÍDER ACTUAL</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-secondary text-xl">{adv.receiveCount}</p>
                  <div className="flex items-center justify-end gap-1 text-[10px] font-black text-green-600">
                    <TrendingUp className="w-3 h-3" /> TOP {i + 1}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* FULL RANKING TABLE */}
      <Card className="rounded-[2.5rem] border border-secondary/10 card-shadow-sm overflow-hidden bg-card">
        <CardHeader className="p-8 border-b border-border/10">
          <CardTitle className="text-xl font-black text-secondary tracking-tight">Ranking Completo de Asesores</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/5 border-b border-border/10">
                  <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-secondary/50">Posición</th>
                  <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-secondary/50">Asesor</th>
                  <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-secondary/50">Correo</th>
                  <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-widest text-secondary/50 text-primary">Envíos</th>
                  <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-widest text-secondary/50 text-secondary">Recibidos</th>
                  <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-secondary/50">Valor Generado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                <AnimatePresence>
                  {fullRanking.map((adv, idx) => (
                    <motion.tr 
                      key={adv.email} 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="group hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-8 py-6 font-black text-secondary/30 group-hover:text-primary transition-colors italic">#{idx + 1}</td>
                      <td className="px-6 py-6 font-black text-secondary uppercase text-sm tracking-tight">{adv.name}</td>
                      <td className="px-6 py-6 font-medium text-muted-foreground text-xs">{adv.email}</td>
                      <td className="px-6 py-6 text-right font-black text-primary text-lg">{adv.count}</td>
                      <td className="px-6 py-6 text-right font-black text-secondary text-lg">{adv.receiveCount}</td>
                      <td className="px-8 py-6 text-right font-black text-secondary text-lg">${adv.totalValue.toLocaleString('es-CO')}</td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
          {fullRanking.length === 0 && (
            <div className="p-20 text-center">
              <p className="text-muted-foreground italic font-medium">No hay suficientes datos registrados para generar el ranking.</p>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
