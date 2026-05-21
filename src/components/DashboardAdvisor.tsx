import { useMemo, useState } from 'react';
import { Transfer, User } from '../types';
import { 
  Plus, 
  Send, 
  Inbox, 
  Clock, 
  CheckCircle2, 
  ArrowUpRight,
  TrendingUp,
  LayoutDashboard,
  Search,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DashboardAdvisorProps {
  transfers: Transfer[];
  user: User;
  onNewTransfer: () => void;
}

export function DashboardAdviser({ transfers, user, onNewTransfer }: DashboardAdvisorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  const filteredData = useMemo(() => {
    return transfers.filter(t => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        (t.customerName || '').toLowerCase().includes(searchLower) || 
        (t.requestNumber || '').toLowerCase().includes(searchLower) ||
        (t.fromAdvisorName || '').toLowerCase().includes(searchLower) ||
        (t.toAdvisorName || '').toLowerCase().includes(searchLower) ||
        (t.observations || '').toLowerCase().includes(searchLower);
      const matchesStatus = statusFilter === 'todos' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [transfers, searchQuery, statusFilter]);
  
  const stats = useMemo(() => {
    const sent = transfers.filter(t => t.fromAdvisorEmail === user.email).length;
    const received = transfers.filter(t => t.toAdvisorEmail === user.email).length;
    const pending = transfers.filter(t => t.toAdvisorEmail === user.email && t.status === 'pendiente').length;
    
    return { sent, received, pending };
  }, [transfers, user.email]);

  const recentActivities = useMemo(() => {
    return [...filteredData]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5);
  }, [filteredData]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* HERO SECTION */}
      <div className="relative rounded-[2.5rem] bg-secondary p-8 md:p-12 text-white overflow-hidden shadow-2xl shadow-secondary/20 transition-all duration-500 hover:shadow-primary/10 group">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-[80px] group-hover:bg-primary/30 transition-colors" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-[50px]" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2 uppercase italic">Mi Gestión</h1>
            <p className="text-slate-300 text-lg font-medium max-w-md">
              Hola {(user.name || 'Asesor').split(' ')[0]}, tienes <span className="text-white font-bold">{stats.pending} gestiones esperando</span> tu acción.
            </p>
            <div className="mt-8 flex flex-wrap gap-4 justify-center md:justify-start">
              <Button 
                onClick={onNewTransfer}
                className="bg-primary hover:bg-primary/90 text-white font-bold px-8 h-12 rounded-2xl shadow-lg shadow-primary/20 transition-all hover:scale-105"
              >
                <Plus className="w-5 h-5 mr-2" />
                Nueva Gestión
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
            <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10">
              <TrendingUp className="w-6 h-6 text-primary mb-2" />
              <p className="text-2xl font-black">{stats.sent + stats.received}</p>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Mis Movimientos</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10">
              <LayoutDashboard className="w-6 h-6 text-primary mb-2" />
              <p className="text-2xl font-black">{(user.cartera || 'General').split(' ')[0]}</p>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Cartera</p>
            </div>
          </div>
        </div>
      </div>

      {/* STATS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Enviadas', value: stats.sent, icon: Send, color: 'text-primary', bg: 'bg-primary/5' },
          { label: 'Recibidas', value: stats.received, icon: Inbox, color: 'text-secondary', bg: 'bg-secondary/5' },
          { label: 'Pendientes', value: stats.pending, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className="border-none card-shadow rounded-3xl overflow-hidden group">
              <CardContent className="p-8">
                <div className="flex justify-between items-start">
                  <div className={`w-14 h-14 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center`}>
                    <stat.icon className="w-7 h-7" />
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-6">
                  <p className="text-4xl font-black text-secondary">{stat.value}</p>
                  <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mt-1">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* FILTERS SECTION */}
      <Card className="rounded-[2.5rem] border-none card-shadow bg-card/60 backdrop-blur-xl">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Búsqueda Rápida</Label>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input 
                  placeholder="Buscar por cliente, ID, asesor o cartera..." 
                  className="pl-12 h-12 bg-muted/30 border-none rounded-2xl font-bold"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="w-full md:w-64 space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Estado de Gestión</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-12 bg-muted/30 border-none rounded-2xl font-bold">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-2xl">
                  <SelectItem value="todos" className="font-bold">Todos los estados</SelectItem>
                  <SelectItem value="pendiente" className="font-bold">Pendientes</SelectItem>
                  <SelectItem value="gestionado" className="font-bold">Gestionados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RECENT ACTIVITY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-black text-secondary">Actividad Reciente</h2>
              <span className="bg-primary/10 text-primary text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-primary/20">
                Solo mis gestiones
              </span>
            </div>
            <Button variant="link" className="text-primary font-bold" onClick={() => onNewTransfer()}>Ver historial</Button>
          </div>
          
          <div className="space-y-4">
            {recentActivities.map((activity, i) => (
              <motion.div 
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="group p-5 bg-card rounded-[2rem] border border-border/50 card-shadow hover:border-primary/20 transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${activity.status === 'gestionado' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                    {activity.status === 'gestionado' ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-secondary">{activity.customerName}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <p className="text-xs text-muted-foreground">
                        {activity.managementType} • {format(activity.createdAt, "d 'de' MMMM", { locale: es })}
                      </p>
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                        (activity.canalGestion || 'Llamada') === 'WhatsApp' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300' 
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                      }`}>
                        {(activity.canalGestion || 'Llamada') === 'WhatsApp' ? '💬 WhatsApp' : '📞 Llamada'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-secondary">#{activity.requestNumber}</p>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${activity.status === 'gestionado' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {activity.status}
                  </span>
                </div>
              </motion.div>
            ))}
            {recentActivities.length === 0 && (
              <div className="p-20 text-center border-2 border-dashed border-border rounded-[2rem]">
                <p className="text-muted-foreground">No hay gestiones recientes registradas.</p>
              </div>
            )}
          </div>
        </div>

        {/* SIDE BAR DASHBOARD */}
        <div className="space-y-6">
          <h2 className="text-xl font-black text-secondary">Mi Perfil Diario</h2>
          <Card className="bg-primary text-white border-none rounded-[2rem] p-8 space-y-6 shadow-xl shadow-primary/20">
            <div>
              <p className="text-primary-foreground/70 font-bold text-xs uppercase tracking-widest">Cartera Asignada</p>
              <p className="text-2xl font-black mt-1">{user.cartera}</p>
            </div>
            <div className="h-px bg-white/10" />
            <div>
              <p className="text-primary-foreground/70 font-bold text-xs uppercase tracking-widest">Supervisor</p>
              <p className="text-xl font-bold mt-1">{user.supervisorName}</p>
              <p className="text-xs text-primary-foreground/60">{user.supervisorEmail}</p>
            </div>
            <div className="pt-4">
              <div className="bg-white/10 rounded-2xl p-4">
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span>Cumplimiento del día</span>
                  <span>75%</span>
                </div>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white w-3/4 rounded-full" />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
