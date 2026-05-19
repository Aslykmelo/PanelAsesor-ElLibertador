import { useMemo, useState } from 'react';
import { Transfer, User, Advisor } from '../types';
import { 
  Users, 
  MessageSquare, 
  Gift, 
  TrendingUp, 
  Download, 
  Filter as FilterIcon,
  ChevronRight,
  User as UserIcon,
  Search,
  Calendar,
  DollarSign,
  Send,
  FileText,
  Briefcase
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ReTooltip, 
  ResponsiveContainer, 
  LineChart,
  Line,
  Cell
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, subDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DashboardAdminProps {
  transfers: Transfer[];
  user: User;
  advisors: Advisor[];
}

export function DashboardAdmin({ transfers, user, advisors }: DashboardAdminProps) {
  const [filterCartera, setFilterCartera] = useState<string>('todos');
  const [filterAdvisor, setFilterAdvisor] = useState<string>('todos');
  const [filterSupervisor, setFilterSupervisor] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // 📊 COMPUTED DATA
  const filteredTransfers = useMemo(() => {
    return transfers.filter(t => {
      const matchesCartera = filterCartera === 'todos' || t.cartera === filterCartera;
      const matchesAdvisor = filterAdvisor === 'todos' || t.fromAdvisorEmail === filterAdvisor || t.toAdvisorEmail === filterAdvisor;
      const matchesSupervisor = filterSupervisor === 'todos' || t.supervisorEmail === filterSupervisor;
      
      // Date filtering
      let matchesDate = true;
      if (dateFrom || dateTo) {
        const tDate = startOfDay(t.createdAt).getTime();
        if (dateFrom) {
          const fromDate = startOfDay(new Date(dateFrom)).getTime();
          if (tDate < fromDate) matchesDate = false;
        }
        if (dateTo) {
          const toDate = startOfDay(new Date(dateTo)).getTime();
          if (tDate > toDate) matchesDate = false;
        }
      }

      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        (t.customerName || '').toLowerCase().includes(searchLower) ||
        (t.requestNumber || '').toLowerCase().includes(searchLower) ||
        (t.fromAdvisorName || '').toLowerCase().includes(searchLower) ||
        (t.toAdvisorName || '').toLowerCase().includes(searchLower) ||
        (t.cartera || '').toLowerCase().includes(searchLower);
      
      return matchesCartera && matchesAdvisor && matchesSupervisor && matchesSearch && matchesDate;
    });
  }, [transfers, filterCartera, filterAdvisor, filterSupervisor, searchQuery, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const total = filteredTransfers.length;
    const callTransfers = filteredTransfers.filter(t => t.type === 'mensaje').length;
    const paymentLinks = filteredTransfers.filter(t => t.type === 'regalo').length;
    const totalValue = filteredTransfers.reduce((acc, t) => acc + (t.paymentLinkValue || 0), 0);
    
    return { total, callTransfers, paymentLinks, totalValue };
  }, [filteredTransfers]);

  // Chart Data: Last 7 Days Evolution
  const evolutionData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = startOfDay(subDays(new Date(), 6 - i));
      return {
        date: format(d, 'dd/MM'),
        dateObj: d,
        transferencias: 0,
        links: 0
      };
    });

    filteredTransfers.forEach(t => {
      const tDate = startOfDay(t.createdAt);
      const day = days.find(d => d.dateObj.getTime() === tDate.getTime());
      if (day) {
        if (t.type === 'mensaje') day.transferencias++;
        else day.links++;
      }
    });

    return days;
  }, [filteredTransfers]);

  const topAdvisorsByVolume = useMemo(() => {
    const map = new Map();
    filteredTransfers.forEach(t => {
      const name = t.fromAdvisorName;
      map.set(name, (map.get(name) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredTransfers]);

  const topValueAdvisors = useMemo(() => {
    const map = new Map();
    filteredTransfers.forEach(t => {
      if (t.type === 'regalo') {
        const name = (t.toAdvisorName || 'Desconocido').toUpperCase();
        const email = t.toAdvisorEmail.toLowerCase();
        const current = map.get(email) || { name, value: 0, count: 0 };
        current.value += t.paymentLinkValue || 0;
        current.count++;
        map.set(email, current);
      }
    });
    return Array.from(map.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
  }, [filteredTransfers]);

  const topReceivers = useMemo(() => {
    const map = new Map();
    filteredTransfers.forEach(t => {
      const email = t.toAdvisorEmail;
      const current = map.get(email) || { name: t.toAdvisorName, email, count: 0 };
      current.count++;
      map.set(email, current);
    });
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [filteredTransfers]);

  const carteras = useMemo(() => {
    const fromTransfers = new Set(transfers.map(t => t.cartera).filter(Boolean));
    const fromAdvisors = new Set(advisors.map(a => a.cartera).filter(Boolean));
    return Array.from(new Set([...Array.from(fromTransfers), ...Array.from(fromAdvisors)]));
  }, [transfers, advisors]);

  const uniqueAdvisors = useMemo(() => {
    const map = new Map();
    // Prioritize actual registered advisors
    advisors.forEach(a => {
      map.set(a.email.toLowerCase(), a.name);
    });
    // Fallback to data from transfers for legacy or unknown advisors
    transfers.forEach(t => {
      if (!map.has(t.fromAdvisorEmail.toLowerCase())) {
        map.set(t.fromAdvisorEmail.toLowerCase(), t.fromAdvisorName);
      }
      if (!map.has(t.toAdvisorEmail.toLowerCase())) {
        map.set(t.toAdvisorEmail.toLowerCase(), t.toAdvisorName);
      }
    });
    return Array.from(map.entries());
  }, [transfers, advisors]);

  const uniqueSupervisors = useMemo(() => {
    const map = new Map();
    // Prioritize actual registered advisors' supervisors
    advisors.forEach(a => {
      if (a.supervisorEmail) {
        map.set(a.supervisorEmail.toLowerCase(), a.supervisor);
      }
    });
    // Fallback to transfers
    transfers.forEach(t => {
      if (t.supervisorEmail && !map.has(t.supervisorEmail.toLowerCase())) {
        map.set(t.supervisorEmail.toLowerCase(), t.supervisorName);
      }
    });
    return Array.from(map.entries());
  }, [transfers, advisors]);

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(21, 49, 87);
    doc.text('Reporte Administrativo - El Libertador', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generado por: ${user.name}`, 14, 30);
    doc.text(`Fecha: ${format(new Date(), 'PPP', { locale: es })}`, 14, 36);

    autoTable(doc, {
      startY: 45,
      head: [['Fecha', 'Tipo', 'Cliente', 'Solicitud', 'De', 'Para', 'Estado', 'Valor']],
      body: filteredTransfers.map(t => [
        format(t.createdAt, 'dd/MM/yyyy'),
        t.managementType,
        t.customerName,
        t.requestNumber,
        t.fromAdvisorName,
        t.toAdvisorName,
        t.status.toUpperCase(),
        `$${(t.paymentLinkValue || 0).toLocaleString('es-CO')}`
      ]),
      headStyles: { fillColor: [21, 49, 87] }
    });

    doc.save(`Reporte_Administrativo_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-secondary tracking-tight">Dashboard Administrativo</h1>
          <p className="text-muted-foreground font-medium">Monitoreo de asesores y desempeño de transferencias</p>
        </div>
        <Button 
          variant="outline" 
          className="rounded-xl border-secondary text-secondary font-bold hover:bg-secondary/5"
          onClick={exportPDF}
        >
          Exportar Reporte
        </Button>
      </div>

      {/* FILTROS AVANZADOS */}
      <Card className="rounded-[2rem] border border-secondary/20 card-shadow-sm overflow-hidden bg-card">
        <CardHeader className="py-4 px-8 border-b border-border/10 bg-muted/5 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold text-secondary flex items-center gap-2">
            <FilterIcon className="w-5 h-5 text-secondary" />
            Filtros Avanzados
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-primary font-black text-[10px] uppercase tracking-widest hover:bg-primary/5"
            onClick={() => {
              setFilterCartera('todos');
              setFilterAdvisor('todos');
              setFilterSupervisor('todos');
              setSearchQuery('');
              setDateFrom('');
              setDateTo('');
            }}
          >
            Limpiar Filtros
          </Button>
        </CardHeader>
        <CardContent className="p-8">
          <div className="space-y-6">
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search className="w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              </div>
              <Input 
                placeholder="Buscar por cliente, ID, asesor o cartera..." 
                className="h-14 pl-12 bg-muted/30 border-secondary/20 rounded-2xl font-bold transition-all focus:ring-2 focus:ring-primary/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="space-y-3">
                <Label className="text-[10px] font-black text-secondary flex items-center gap-1.5 ml-1 uppercase tracking-widest">
                  <Calendar className="w-4 h-4 text-primary" /> Fecha Desde
                </Label>
                <Input 
                  type="date" 
                  className="h-12 bg-muted/30 border-secondary/20 rounded-2xl font-bold" 
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black text-secondary flex items-center gap-1.5 ml-1 uppercase tracking-widest">
                  <Calendar className="w-4 h-4 text-primary" /> Fecha Hasta
                </Label>
                <Input 
                  type="date" 
                  className="h-12 bg-muted/30 border-secondary/20 rounded-2xl font-bold" 
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black text-secondary flex items-center gap-1.5 ml-1 uppercase tracking-widest">
                  <Users className="w-4 h-4 text-primary" /> Filtrar Supervisor
                </Label>
                <Select value={filterSupervisor} onValueChange={setFilterSupervisor}>
                  <SelectTrigger className="h-12 bg-muted/30 border-secondary/20 rounded-2xl font-bold">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl">
                    <SelectItem value="todos" className="font-bold uppercase text-[10px]">Ver Todos</SelectItem>
                    {uniqueSupervisors.map(([email, name]) => (
                      <SelectItem key={email} value={email} className="font-bold text-xs">{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black text-secondary flex items-center gap-1.5 ml-1 uppercase tracking-widest">
                  <UserIcon className="w-4 h-4 text-primary" /> Filtrar Asesor
                </Label>
                <Select value={filterAdvisor} onValueChange={setFilterAdvisor}>
                  <SelectTrigger className="h-12 bg-muted/30 border-secondary/20 rounded-2xl font-bold">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl">
                    <SelectItem value="todos" className="font-bold uppercase text-[10px]">Ver Todos</SelectItem>
                    {uniqueAdvisors.map(([email, name]) => (
                      <SelectItem key={email} value={email} className="font-bold text-xs">{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black text-secondary flex items-center gap-1.5 ml-1 uppercase tracking-widest">
                  <Briefcase className="w-4 h-4 text-primary" /> Filtrar Cartera
                </Label>
                <Select value={filterCartera} onValueChange={setFilterCartera}>
                  <SelectTrigger className="h-12 bg-muted/30 border-secondary/20 rounded-2xl font-bold">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl">
                    <SelectItem value="todos" className="font-bold uppercase text-[10px]">Ver Todas</SelectItem>
                    {carteras.map(c => (
                      <SelectItem key={c} value={c} className="font-bold text-xs">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* STAT CARDS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'TOTAL TRANSFERENCIAS', value: stats.total, icon: TrendingUp, border: 'border-l-[6px] border-l-[#153157]' },
          { label: 'VALOR GENERADO', value: `$${stats.totalValue.toLocaleString('es-CO')}`, icon: DollarSign, border: 'border-l-[6px] border-l-[#22C55E]' },
          { label: 'LINKS DE PAGO ENVIADOS', value: stats.paymentLinks, icon: Send, border: 'border-l-[6px] border-l-[#3B82F6]' },
          { label: 'TRANSFERENCIAS DE LLAMADAS', value: stats.callTransfers, icon: FileText, border: 'border-l-[6px] border-l-[#F97316]' },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className={cn("border border-secondary/10 card-shadow-sm rounded-2xl overflow-hidden py-4 h-full", stat.border)}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <p className="text-[11px] font-black text-secondary uppercase tracking-widest max-w-[150px]">{stat.label}</p>
                  <stat.icon className="w-5 h-5 text-secondary/40" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl sm:text-4xl font-black text-secondary tracking-tighter break-all">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* MAIN LINE CHART */}
      <Card className="rounded-[2.5rem] border border-secondary/10 card-shadow-sm overflow-hidden bg-card">
        <CardHeader className="py-6 px-4 md:px-10 border-b border-border/10">
          <CardTitle className="text-sm md:text-lg font-black text-secondary uppercase tracking-widest">Evolución Últimos 7 Días</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-10 h-[300px] md:h-[400px] min-w-0">
          <div className="w-full h-full min-h-0 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }} dy={15} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }} />
                <ReTooltip 
                  contentStyle={{ borderRadius: '24px', border: 'none', backgroundColor: 'var(--card)', color: 'var(--foreground)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
                  itemStyle={{ fontWeight: 'black', fontSize: '13px' }}
                />
                <Line type="monotone" dataKey="transferencias" stroke="var(--secondary)" strokeWidth={4} dot={{ r: 4, fill: 'var(--secondary)', strokeWidth: 2, stroke: 'var(--background)' }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="links" stroke="var(--primary)" strokeWidth={4} dot={{ r: 4, fill: 'var(--primary)', strokeWidth: 2, stroke: 'var(--background)' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* LOWER GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-auto">
        
        {/* TOP COMPONENT LISTS */}
        <div className="space-y-8 min-w-0">
           {/* TOP GENERADORES */}
           <Card className="rounded-[2.5rem] border border-secondary/10 card-shadow-sm overflow-hidden bg-card">
            <CardHeader className="py-6 px-10 border-b border-border/10 flex flex-row items-center gap-3">
              <Gift className="w-5 h-5 text-primary" />
              <CardTitle className="text-base font-black text-secondary uppercase tracking-wider">Top Generadores de Links de Pago</CardTitle>
            </CardHeader>
            <CardContent className="p-10 space-y-8">
              {topValueAdvisors.map((adv, i) => (
                <div key={adv.name} className="flex justify-between items-center group">
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-black text-primary">#{i+1}</span>
                    <div>
                      <p className="font-black text-secondary group-hover:text-primary transition-colors">{adv.name}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-40">Responsable</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-secondary">${adv.value.toLocaleString('es-CO')}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{adv.count} links enviados</p>
                  </div>
                </div>
              ))}
              {topValueAdvisors.length === 0 && <p className="text-center py-20 italic opacity-40">No hay datos de links de pago</p>}
            </CardContent>
          </Card>

          {/* TOP RECEPTORES */}
          <Card className="rounded-[2.5rem] border border-secondary/10 card-shadow-sm overflow-hidden bg-card">
            <CardHeader className="py-6 px-10 border-b border-border/10 flex flex-row items-center gap-3">
              <FileText className="w-5 h-5 text-primary" />
              <CardTitle className="text-base font-black text-secondary uppercase tracking-wider">Top Receptores de Transferencias</CardTitle>
            </CardHeader>
            <CardContent className="p-10 space-y-8">
              {topReceivers.map((adv, i) => (
                <div key={adv.email} className="flex justify-between items-center group">
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-black text-primary">#{i+1}</span>
                    <div>
                      <p className="font-black text-secondary group-hover:text-primary transition-colors">{adv.name}</p>
                      <p className="text-[10px] font-bold text-muted-foreground truncate max-w-[200px] opacity-40">{adv.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                     <p className="text-2xl font-black text-secondary">{adv.count}</p>
                     <p className="text-[10px] font-bold text-muted-foreground uppercase">transferencias</p>
                  </div>
                </div>
              ))}
              {topReceivers.length === 0 && <p className="text-center py-20 italic opacity-40">No hay datos de receptores</p>}
            </CardContent>
          </Card>
        </div>

        {/* CHARTS VOLUMEN */}
        <div className="space-y-8">
           {/* MAYOR VOLUMEN ENVÍOS (VERTICAL BARS) */}
           <Card className="rounded-[2.5rem] border border-secondary/10 card-shadow-sm overflow-hidden bg-card">
            <CardHeader className="py-6 px-10 border-b border-border/10 flex flex-row items-center gap-3">
              <Send className="w-5 h-5 text-primary" />
              <CardTitle className="text-base font-black text-secondary uppercase tracking-wider">Asesores con Mayor Volumen de Envíos</CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-10 h-[300px] md:h-[350px] min-w-0">
              <div className="w-full h-full min-h-0 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topAdvisorsByVolume} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#64748B' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }} />
                    <ReTooltip cursor={{ fill: 'var(--muted)' }} contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: 'var(--card)' }} />
                    <Bar dataKey="value" fill="var(--secondary)" radius={[8, 8, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* TOP ASESORES VOLUMEN (HORIZONTAL BARS) */}
          <Card className="rounded-[2.5rem] border border-secondary/10 card-shadow-sm overflow-hidden bg-card">
            <CardHeader className="py-6 px-4 md:px-10 border-b border-border/10 flex flex-row items-center gap-3">
              <Users className="w-5 h-5 text-primary" />
              <CardTitle className="text-base font-black text-secondary uppercase tracking-wider">Top Asesores por Volumen</CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-10 h-[300px] md:h-[350px] min-w-0">
               <div className="w-full h-full min-h-0 min-w-0">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={topAdvisorsByVolume} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                     <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" opacity={0.5} />
                     <XAxis type="number" hide />
                     <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: 'var(--foreground)' }} width={80} />
                     <ReTooltip cursor={{ fill: 'var(--muted)' }} contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: 'var(--card)' }} />
                     <Bar dataKey="value" fill="var(--primary)" radius={[0, 8, 8, 0]} barSize={25} />
                   </BarChart>
                 </ResponsiveContainer>
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
