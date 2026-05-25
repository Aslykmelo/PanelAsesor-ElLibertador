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
  Filter,
  Eye,
  EyeOff,
  Copy,
  Check,
  Calendar,
  MessageSquare,
  Gift,
  Phone,
  Award
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

interface DashboardAdvisorProps {
  transfers: Transfer[];
  user: User;
  onNewTransfer: () => void;
}

export function DashboardAdviser({ transfers, user, onNewTransfer }: DashboardAdvisorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  // Expanded card state for recent activities on Dashboard Asesor
  const [expandedActivity, setExpandedActivity] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getClientPhone = (t: any): string => {
    if (!t) return 'No especificado';
    return t.phone ||
           t.contactPhones ||
           t.phoneNumber ||
           t.customerPhone ||
           t.telefono ||
           t.telefonoCliente ||
           t.contactPhone ||
           t.mobile ||
           t.celular ||
           'No especificado';
  };

  const handleCopy = (text: string, id: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success('¡Copiado con éxito!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      toast.error('No se pudo copiar');
    }
  };

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
            {recentActivities.map((activity, i) => {
              const isExpanded = !!expandedActivity[activity.id || ''];
              return (
                <div key={activity.id} className="space-y-3">
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => {
                      setExpandedActivity(prev => ({
                        ...prev,
                        [activity.id || '']: !prev[activity.id || '']
                      }));
                    }}
                    className={`group p-5 bg-card rounded-[2rem] border transition-all flex items-center justify-between cursor-pointer select-none ${
                      isExpanded 
                        ? 'border-primary shadow-lg shadow-primary/5 ring-1 ring-primary/20 bg-slate-50/50 dark:bg-slate-900/30' 
                        : 'border-border/50 card-shadow hover:border-primary/30 hover:bg-slate-50/30 dark:hover:bg-slate-900/10'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 ${activity.status === 'gestionado' ? 'bg-green-50 text-green-600 dark:bg-green-950/35 dark:text-green-300' : 'bg-yellow-50 text-yellow-600 dark:bg-yellow-950/35 dark:text-yellow-300'}`}>
                        {activity.status === 'gestionado' ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                      </div>
                      <div>
                        <h3 className="font-black text-secondary dark:text-foreground text-sm sm:text-base">{activity.customerName}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <p className="text-xs text-muted-foreground font-medium">
                            {activity.managementType} • {format(activity.createdAt, "d 'de' MMMM, yyyy", { locale: es })}
                          </p>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            (activity.canalGestion || 'Llamada') === 'WhatsApp' 
                              ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300' 
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                          }`}>
                            {(activity.canalGestion || 'Llamada') === 'WhatsApp' ? '💬 WhatsApp' : '📞 Llamada'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-black text-secondary dark:text-foreground">#{activity.requestNumber}</p>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${activity.status === 'gestionado' ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-300'}`}>
                          {activity.status}
                        </span>
                      </div>
                      <div className="text-muted-foreground p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        {isExpanded ? <EyeOff className="w-5 h-5 text-primary" /> : <Eye className="w-5 h-5" />}
                      </div>
                    </div>
                  </motion.div>

                  {/* Expanded Item Detail */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden px-1"
                      >
                        <div className="bg-slate-50 dark:bg-slate-900/60 rounded-[2rem] border border-border/60 p-5 sm:p-6 space-y-6 shadow-md">
                          
                          {/* HIGHLIGHTED CLIENT CARD */}
                          <div className="bg-card dark:bg-slate-900/80 rounded-2xl p-4 sm:p-5 border border-primary/15 dark:border-primary/10 shadow-sm space-y-4">
                            <h4 className="text-[11px] font-black uppercase tracking-[0.1em] text-primary flex items-center gap-1.5 border-b border-border/20 pb-2">
                              👤 Información del Cliente
                            </h4>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {/* Customer name */}
                              <div className="bg-muted/20 p-3 rounded-xl">
                                <span className="text-[10px] font-bold text-muted-foreground block uppercase tracking-wider">Cliente</span>
                                <span className="text-sm font-extrabold text-secondary dark:text-foreground flex items-center gap-1.5 mt-0.5">
                                  👤 {activity.customerName || '-'}
                                </span>
                              </div>

                              {/* Request number */}
                              <div className="bg-muted/20 p-3 rounded-xl flex justify-between items-center">
                                <div>
                                  <span className="text-[10px] font-bold text-muted-foreground block uppercase tracking-wider">Solicitud / Radicado</span>
                                  <span className="text-sm font-mono font-black text-secondary dark:text-foreground flex items-center gap-1.5 mt-0.5">
                                    📄 #{activity.requestNumber || '-'}
                                  </span>
                                </div>
                                {activity.requestNumber && (
                                  <button 
                                    onClick={() => handleCopy(activity.requestNumber, `req-${activity.id}`)}
                                    className="p-1.5 hover:bg-card rounded-md text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                                    title="Copiar Solicitud"
                                  >
                                    {copiedId === `req-${activity.id}` ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                  </button>
                                )}
                              </div>

                              {/* Prominent client phone */}
                              <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 p-4 rounded-xl flex justify-between items-center sm:col-span-2">
                                <div className="space-y-0.5">
                                  <span className="text-[11px] font-black text-primary block uppercase tracking-wider flex items-center gap-1">
                                    📞 TELÉFONO DE CONTACTO
                                  </span>
                                  <span className="text-xl font-black text-secondary dark:text-foreground tracking-tight block">
                                    {getClientPhone(activity)}
                                  </span>
                                </div>
                                {getClientPhone(activity) !== 'No especificado' && (
                                  <div className="flex gap-1.5">
                                    <button 
                                      onClick={() => handleCopy(getClientPhone(activity), `phone-${activity.id}`)}
                                      className="h-10 px-4 bg-primary text-white font-bold rounded-xl flex items-center gap-1.5 text-xs hover:bg-primary/95 transition-all shadow-sm active:scale-95"
                                      title="Copiar Teléfono de Contacto"
                                    >
                                      {copiedId === `phone-${activity.id}` ? (
                                        <>
                                          <Check className="w-4 h-4" />
                                          <span>Copiado</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-4 h-4" />
                                          <span>Copiar Número</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* EXTRA DETAILS COLLAPSIBLE */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                            <div className="space-y-3">
                              <h5 className="font-black text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-1">Gestión & Asignación</h5>
                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground font-medium">Asesor Emisor:</span>
                                  <span className="font-bold text-secondary dark:text-foreground">{activity.fromAdvisorName}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground font-medium">Asesor Destino:</span>
                                  <span className="font-bold text-secondary dark:text-foreground">{activity.toAdvisorName}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground font-medium">Supervisor:</span>
                                  <span className="font-bold text-secondary dark:text-foreground">{activity.supervisorName || 'No asignado'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground font-medium">Cartera:</span>
                                  <span className="font-black text-primary uppercase">{activity.cartera || 'Sin Cartera'}</span>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <h5 className="font-black text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-1">Canales & Valores</h5>
                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground font-medium">Canal de atención:</span>
                                  <span className="font-bold text-secondary dark:text-foreground">
                                    {(activity.canalGestion || 'Llamada') === 'WhatsApp' ? '💬 WhatsApp' : '📞 Llamada'}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground font-medium">Tipo de gestión:</span>
                                  <span className="font-bold text-secondary dark:text-foreground">{activity.managementType}</span>
                                </div>
                                {activity.paymentLinkValue > 0 && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground font-medium">Valor Link de Pago:</span>
                                    <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                                      ${activity.paymentLinkValue.toLocaleString('es-CO')}
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground font-medium">Fecha Completa:</span>
                                  <span className="font-semibold text-muted-foreground">
                                    {format(activity.createdAt, "dd 'de' MMMM, yyyy - hh:mm:ss a", { locale: es })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* OBSERVATIONS */}
                          {activity.observations && (
                            <div className="bg-card dark:bg-slate-900/40 p-4 rounded-2xl border border-border/40">
                              <span className="text-[10px] font-black text-muted-foreground block uppercase tracking-wider mb-2">📝 Observaciones de Gestión:</span>
                              <p className="text-sm text-secondary dark:text-foreground font-medium leading-relaxed whitespace-pre-line bg-muted/20 p-3 rounded-xl">
                                {activity.observations}
                              </p>
                            </div>
                          )}

                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
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
