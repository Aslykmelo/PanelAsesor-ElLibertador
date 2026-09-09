import { useMemo, useState } from 'react';
import { Transfer, User } from '../types';
import { cn } from '@/lib/utils';
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
  Award,
  Coins,
  ShieldCheck,
  BarChart3
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
  const [activeTab, setActiveTab] = useState<'all' | 'sent' | 'received' | 'payments' | 'transfers' | 'whatsapp' | 'calls'>('all');

  const handleToggleFilter = (id: 'all' | 'sent' | 'received' | 'payments' | 'transfers' | 'whatsapp' | 'calls') => {
    setActiveTab(id);
  };

  const checkFilterActive = (id: string) => {
    return activeTab === id;
  };

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

  const personalStats = useMemo(() => {
    const isActivityToday = (t: Transfer) => {
      const date = t.createdAt instanceof Date ? t.createdAt : (typeof (t.createdAt as any)?.toDate === 'function' ? (t.createdAt as any).toDate() : new Date(t.createdAt));
      const today = new Date();
      return date.getDate() === today.getDate() &&
             date.getMonth() === today.getMonth() &&
             date.getFullYear() === today.getFullYear();
    };

    const isCreatedByMe = (t: Transfer) => {
      const creatorEmail = (t.createdByEmail || t.createdBy || '').toLowerCase().trim();
      const fromEmail = (t.fromAdvisorEmail || '').toLowerCase().trim();
      const userEmailLower = (user.email || '').toLowerCase().trim();
      return creatorEmail === userEmailLower || fromEmail === userEmailLower;
    };

    const myTransfers = transfers.filter(isCreatedByMe);
    const myTransfersToday = myTransfers.filter(isActivityToday);

    const totalToday = myTransfersToday.length;
    
    const hasPaymentLink = (t: Transfer) => t.paymentLinkValue && t.paymentLinkValue > 0;
    const paymentLinksCount = myTransfers.filter(hasPaymentLink).length;
    const paymentLinksValueSum = myTransfers.filter(hasPaymentLink).reduce((sum, t) => sum + (t.paymentLinkValue || 0), 0);

    const paymentLinksToday = myTransfersToday.filter(hasPaymentLink).length;
    const paymentValueToday = myTransfersToday.filter(hasPaymentLink).reduce((sum, t) => sum + (t.paymentLinkValue || 0), 0);

    const messagesCount = myTransfers.filter(t => t.type === 'mensaje').length;
    const transfersCount = myTransfers.length - messagesCount;

    const whatsappCount = myTransfers.filter(t => (t.canalGestion || 'Llamada') === 'WhatsApp').length;
    const callCount = myTransfers.filter(t => (t.canalGestion || 'Llamada') !== 'WhatsApp').length;
    
    let mostUsedChannel = 'Ninguno';
    if (whatsappCount > 0 || callCount > 0) {
      mostUsedChannel = whatsappCount >= callCount ? '💬 WhatsApp' : '📞 Llamada';
    }

    const sortedMyTransfers = [...myTransfers].sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt : (typeof (a.createdAt as any)?.toDate === 'function' ? (a.createdAt as any).toDate() : new Date(a.createdAt));
      const dateB = b.createdAt instanceof Date ? b.createdAt : (typeof (b.createdAt as any)?.toDate === 'function' ? (b.createdAt as any).toDate() : new Date(b.createdAt));
      return dateB.getTime() - dateA.getTime();
    });
    
    const lastManagement = sortedMyTransfers[0] 
      ? `${sortedMyTransfers[0].customerName || 'Cliente sin nombre'} (${sortedMyTransfers[0].managementType})` 
      : 'Sin registros';

    let progress = 0;
    if (totalToday === 0) progress = 0;
    else if (totalToday <= 2) progress = 25;
    else if (totalToday <= 5) progress = 50;
    else if (totalToday <= 9) progress = 75;
    else progress = 100;

    let motivationText = 'Sin actividad registrada';
    if (totalToday >= 1 && totalToday <= 2) motivationText = '¡Buen inicio! Sigue sumando registros';
    else if (totalToday >= 3 && totalToday <= 5) motivationText = 'Buen ritmo operativo 👍';
    else if (totalToday >= 6 && totalToday <= 9) motivationText = 'Excelente productividad ⚡';
    else if (totalToday >= 10) motivationText = '¡Nivel operativo máximo! 🏆';

    // Top Cartera where registered
    const carteraCounts: Record<string, number> = {};
    myTransfers.forEach(t => {
      const c = t.cartera || 'Sin Cartera';
      carteraCounts[c] = (carteraCounts[c] || 0) + 1;
    });
    let topCartera = 'Ninguna';
    let maxCount = 0;
    Object.entries(carteraCounts).forEach(([cartera, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topCartera = cartera;
      }
    });

    // Real Weekly Trend
    const oneDay = 24 * 60 * 60 * 1000;
    const now = new Date();
    const last7DaysCount = myTransfers.filter(t => {
      const date = t.createdAt instanceof Date ? t.createdAt : (typeof (t.createdAt as any)?.toDate === 'function' ? (t.createdAt as any).toDate() : new Date(t.createdAt));
      return now.getTime() - date.getTime() <= 7 * oneDay;
    }).length;

    const prev7DaysCount = myTransfers.filter(t => {
      const date = t.createdAt instanceof Date ? t.createdAt : (typeof (t.createdAt as any)?.toDate === 'function' ? (t.createdAt as any).toDate() : new Date(t.createdAt));
      const diff = now.getTime() - date.getTime();
      return diff > 7 * oneDay && diff <= 14 * oneDay;
    }).length;

    let trendString = "Estable";
    if (last7DaysCount > prev7DaysCount) {
      trendString = `+${Math.round(((last7DaysCount - prev7DaysCount) / Math.max(1, prev7DaysCount)) * 100)}% esta semana 📈`;
    } else if (last7DaysCount < prev7DaysCount) {
      trendString = `-${Math.round(((prev7DaysCount - last7DaysCount) / Math.max(1, prev7DaysCount)) * 100)}% esta semana 📉`;
    } else if (last7DaysCount > 0) {
      trendString = "Consistente ➡️";
    } else {
      trendString = "Sin registros recientes";
    }

    return {
      totalToday,
      paymentLinksCount,
      paymentLinksValueSum,
      paymentLinksToday,
      paymentValueToday,
      messagesCount,
      transfersCount,
      mostUsedChannel,
      lastManagement,
      progress,
      motivationText,
      topCartera,
      whatsappCount,
      callCount,
      trendString
    };
  }, [transfers, user.email]);

  const filteredData = useMemo(() => {
    const userEmailLower = (user.email || '').toLowerCase().trim();
    const userNameLower = (user.name || '').toLowerCase().trim();

    return transfers.filter(t => {
      // 1. Search Query
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        (t.customerName || '').toLowerCase().includes(searchLower) || 
        (t.requestNumber || '').toLowerCase().includes(searchLower) ||
        (t.fromAdvisorName || '').toLowerCase().includes(searchLower) ||
        (t.toAdvisorName || '').toLowerCase().includes(searchLower) ||
        (t.observations || '').toLowerCase().includes(searchLower) ||
        (t.cartera || '').toLowerCase().includes(searchLower);
      
      if (!matchesSearch) return false;

      // 2. Normalize fields for flexible and single/exclusive filtering
      const creatorEmail = (t.createdByEmail || t.createdBy || '').toLowerCase().trim();
      const fromEmail = (t.fromAdvisorEmail || '').toLowerCase().trim();
      const fromName = (t.fromAdvisorName || '').toLowerCase().trim();
      
      const matchesSent = creatorEmail === userEmailLower || 
                          fromEmail === userEmailLower || 
                          fromName === userNameLower || 
                          t.createdBy === user.uid;

      const toEmail = (t.toAdvisorEmail || '').toLowerCase().trim();
      const toName = (t.toAdvisorName || '').toLowerCase().trim();
      const matchesReceived = toEmail === userEmailLower || toName === userNameLower;

      const managementTypeStr = (t.managementType || '').toLowerCase().trim();
      const typeStr = (t.type || '').toLowerCase().trim();
      
      const esLink = managementTypeStr.includes('regalo') || 
                     managementTypeStr.includes('link') ||
                     typeStr.includes('regalo') ||
                     typeStr.includes('link');

      const esTransferencia = managementTypeStr.includes('mensaje') || 
                              managementTypeStr.includes('transferencia') ||
                              typeStr.includes('mensaje') ||
                              typeStr.includes('transferencia');

      const canalStr = (t.canalGestion || 'llamada').toLowerCase().trim();
      const esWhatsApp = canalStr.includes('whatsapp');
      const esLlamada = canalStr.includes('llamada') || canalStr.includes('llamar');

      // 3. Apply exclusive tab filter
      switch (activeTab) {
        case 'sent':
          return matchesSent;
        case 'received':
          return matchesReceived;
        case 'payments':
          return esLink;
        case 'transfers':
          return esTransferencia;
        case 'whatsapp':
          return esWhatsApp;
        case 'calls':
          return esLlamada;
        case 'all':
        default:
          return true;
      }
    });
  }, [transfers, searchQuery, activeTab, user.email, user.name, user.uid]);
  
  const stats = useMemo(() => {
    const isActivityToday = (t: Transfer) => {
      const date = t.createdAt instanceof Date ? t.createdAt : (typeof (t.createdAt as any)?.toDate === 'function' ? (t.createdAt as any).toDate() : new Date(t.createdAt));
      const today = new Date();
      return date.getDate() === today.getDate() &&
             date.getMonth() === today.getMonth() &&
             date.getFullYear() === today.getFullYear();
    };

    const isCreatedByMe = (t: Transfer) => {
      const creatorEmail = (t.createdByEmail || t.createdBy || '').toLowerCase().trim();
      const fromEmail = (t.fromAdvisorEmail || '').toLowerCase().trim();
      const userEmailLower = (user.email || '').toLowerCase().trim();
      return creatorEmail === userEmailLower || fromEmail === userEmailLower;
    };

    const isResponsibleFor = (t: Transfer) => {
      return (t.toAdvisorEmail || '').toLowerCase().trim() === (user.email || '').toLowerCase().trim();
    };

    const sent = transfers.filter(isCreatedByMe).length;
    const received = transfers.filter(isResponsibleFor).length;
    const totalToday = transfers.filter(t => (isCreatedByMe(t) || isResponsibleFor(t)) && isActivityToday(t)).length;
    
    return { sent, received, totalToday };
  }, [transfers, user.email]);

  const recentActivities = useMemo(() => {
    return [...filteredData]
      .sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : (typeof (a.createdAt as any)?.toDate === 'function' ? (a.createdAt as any).toDate() : new Date(a.createdAt));
        const dateB = b.createdAt instanceof Date ? b.createdAt : (typeof (b.createdAt as any)?.toDate === 'function' ? (b.createdAt as any).toDate() : new Date(b.createdAt));
        return dateB.getTime() - dateA.getTime();
      })
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
              Hola, {(user.name || 'Asesor').split(' ')[0]} 👋 Bienvenido a tu panel operativo diario.
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
          { label: 'Enviadas', value: stats.sent, desc: 'Creadas por mí', icon: Send, color: 'text-rose-500 dark:text-rose-400', bg: 'bg-rose-500/10' },
          { label: 'Recibidas', value: stats.received, desc: 'Asignadas a mí', icon: Inbox, color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Total del Día', value: stats.totalToday, desc: 'Mis registros de hoy', icon: Calendar, color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
        ].map((stat, i) => (
          <motion.div 
            key={stat.label} 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: i * 0.1 }}
            whileHover={{ y: -5 }}
            className="group cursor-pointer"
          >
            <Card className="border-none shadow-md hover:shadow-xl dark:shadow-black/25 rounded-3xl overflow-hidden transition-all duration-300 bg-card/70 backdrop-blur-md border border-border/40 dark:border-border/10">
              <CardContent className="p-5 sm:p-6">
                <div className="flex justify-between items-start">
                  <div className={`w-10 h-10 sm:w-11 sm:h-11 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 shadow-sm`}>
                    <stat.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-30 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-4">
                  <p className="text-2xl sm:text-3xl font-black text-secondary dark:text-foreground tracking-tight transition-transform duration-300 group-hover:translate-x-1">{stat.value}</p>
                  <p className="text-xs sm:text-sm font-black text-secondary dark:text-foreground uppercase tracking-wider mt-1">{stat.label}</p>
                  <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-0.5">{stat.desc}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* FILTERS SECTION */}
      <Card className="rounded-[2.5rem] border-none card-shadow bg-card/60 backdrop-blur-xl">
        <CardContent className="p-8 space-y-6">
          <div className="flex flex-col gap-6">
            <div className="w-full space-y-2">
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
            
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Filtros Rápidos</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'Todas', emoji: '📋', activeColor: 'bg-secondary text-white' },
                  { id: 'sent', label: 'Enviadas por mí', emoji: '📤', activeColor: 'bg-primary text-white shadow-primary/20 shadow-md' },
                  { id: 'received', label: 'Recibidas', emoji: '📥', activeColor: 'bg-amber-600 text-white shadow-amber-600/25 shadow-md' },
                  { id: 'payments', label: 'Links de pago', emoji: '💳', activeColor: 'bg-emerald-600 text-white shadow-emerald-600/25 shadow-md' },
                  { id: 'transfers', label: 'Transferencias', emoji: '🔄', activeColor: 'bg-indigo-600 text-white shadow-indigo-600/25 shadow-md' },
                  { id: 'whatsapp', label: 'WhatsApp', emoji: '💬', activeColor: 'bg-green-600 text-white shadow-green-600/25 shadow-md' },
                  { id: 'calls', label: 'Llamadas', emoji: '📞', activeColor: 'bg-rose-600 text-white shadow-rose-600/25 shadow-md' }
                ].map((tab) => {
                  const isActive = checkFilterActive(tab.id);
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleToggleFilter(tab.id as any)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-1.5 active:scale-95 border",
                        isActive
                          ? `${tab.activeColor} border-transparent scale-105`
                          : "bg-muted/40 hover:bg-muted/80 text-muted-foreground border-border/40 dark:border-border/10"
                      )}
                    >
                      <span className="text-sm">{tab.emoji}</span>
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
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
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-black/5 transition-transform group-hover:scale-105",
                        activity.type === 'mensaje' ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"
                      )}>
                        {activity.type === 'mensaje' ? <MessageSquare className="w-6 h-6" /> : <Gift className="w-6 h-6" />}
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
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/20">
                          {activity.cartera || 'Sin Cartera'}
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
          <h2 className="text-xl font-black text-secondary dark:text-foreground">Mi Perfil Diario</h2>
          
          {/* Main profile card with Seguros Bolívar design premium flair and automatic compliance indicator */}
          <Card className="bg-primary text-white border-none rounded-[2rem] p-8 space-y-6 shadow-xl shadow-primary/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-8 -mt-8" />
            
            <div>
              <p className="text-primary-foreground/70 font-bold text-xs uppercase tracking-widest">Cartera Asignada</p>
              <p className="text-2xl font-black mt-1">{user.cartera || 'No asignada'}</p>
            </div>
            <div className="h-px bg-white/10" />
            <div>
              <p className="text-primary-foreground/70 font-bold text-xs uppercase tracking-widest">Supervisor</p>
              <p className="text-xl font-bold mt-1">{user.supervisorName || 'No asignado'}</p>
              <p className="text-xs text-primary-foreground/60">{user.supervisorEmail || ''}</p>
            </div>
            
            <div className="pt-2">
              <div className="bg-white/10 rounded-2xl p-5 space-y-3">
                <div className="flex justify-between text-xs font-black uppercase tracking-wider">
                  <span>Cumplimiento Diario</span>
                  <span>{personalStats.progress}%</span>
                </div>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${personalStats.progress}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full bg-white rounded-full" 
                  />
                </div>
                <p className="text-[11px] font-black italic tracking-wide text-white/95 text-center pt-1">
                  💡 {personalStats.motivationText}
                </p>
              </div>
            </div>

            {/* Extra profile metrics inside panel */}
            <div className="text-xs font-medium space-y-2 pt-1 border-t border-white/10">
              <div className="flex justify-between text-primary-foreground/80">
                <span>Total Hoy:</span>
                <span className="font-extrabold text-white">{personalStats.totalToday} gestiones</span>
              </div>
              <div className="flex justify-between text-primary-foreground/80">
                <span>Canal Favorito:</span>
                <span className="font-extrabold text-white">{personalStats.mostUsedChannel}</span>
              </div>
            </div>
          </Card>

          {/* SECOND CARD: Productividad de Hoy */}
          <Card className="border-none shadow-md rounded-[2rem] p-6 bg-card border border-border/40 dark:border-border/10 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border/30">
              <Award className="w-5 h-5 text-rose-500" />
              <h3 className="font-black text-secondary dark:text-foreground text-sm uppercase tracking-wider">Productividad de Hoy</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/10 dark:bg-slate-900/40 p-3 rounded-2xl">
                <span className="text-[9px] font-bold text-muted-foreground block uppercase">Gestiones Hoy</span>
                <span className="text-xl font-black text-secondary dark:text-foreground">{personalStats.totalToday}</span>
              </div>
              <div className="bg-muted/10 dark:bg-slate-900/40 p-3 rounded-2xl">
                <span className="text-[9px] font-bold text-muted-foreground block uppercase">Links Generados</span>
                <span className="text-xl font-black text-secondary dark:text-foreground">{personalStats.paymentLinksToday}</span>
              </div>
              <div className="col-span-2 bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/10 p-3 rounded-2xl">
                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 block uppercase">Monto Recaudado Hoy</span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  ${personalStats.paymentValueToday.toLocaleString('es-CO')}
                </span>
              </div>
            </div>
          </Card>

          {/* THIRD CARD: Rendimiento General */}
          <Card className="border-none shadow-md rounded-[2rem] p-6 bg-card border border-border/40 dark:border-border/10 space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-border/30">
              <BarChart3 className="w-5 h-5 text-indigo-500" />
              <h3 className="font-black text-secondary dark:text-foreground text-sm uppercase tracking-wider">Estadísticas Clave</h3>
            </div>
            
            <div className="space-y-3 text-xs">
              
              <div className="flex items-center justify-between p-2 rounded-xl bg-muted/10 dark:bg-slate-900/35">
                <span className="font-bold text-muted-foreground">Cartera Frecuente:</span>
                <span className="font-black text-primary uppercase">{personalStats.topCartera}</span>
              </div>
              
              <div className="flex items-center justify-between p-2 rounded-xl bg-muted/10 dark:bg-slate-900/35">
                <span className="font-bold text-muted-foreground">Tendencia Semanal:</span>
                <span className="font-bold text-orange-500 dark:text-orange-400">{personalStats.trendString}</span>
              </div>

              {/* Comparativo de Canales as small styled labels with nice horizontal bars */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[11px] font-black uppercase text-muted-foreground">
                  <span>Llamadas vs WhatsApp</span>
                  <span>{personalStats.callCount} vs {personalStats.whatsappCount}</span>
                </div>
                <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden flex">
                  {personalStats.callCount + personalStats.whatsappCount > 0 ? (
                    <>
                      <div 
                        className="bg-rose-500 h-full"
                        style={{ width: `${(personalStats.callCount / (personalStats.callCount + personalStats.whatsappCount)) * 100}%` }}
                      />
                      <div 
                        className="bg-green-500 h-full"
                        style={{ width: `${(personalStats.whatsappCount / (personalStats.callCount + personalStats.whatsappCount)) * 100}%` }}
                      />
                    </>
                  ) : (
                    <div className="bg-slate-300 dark:bg-slate-800 w-full h-full" />
                  )}
                </div>
                <div className="flex justify-between text-[8px] font-extrabold text-muted-foreground uppercase">
                  <span className="text-rose-500">📞 Llamadas</span>
                  <span className="text-green-500">💬 WhatsApp</span>
                </div>
              </div>

              <div className="h-px bg-border/20 my-2" />

              <div className="space-y-1 text-muted-foreground">
                <div className="flex justify-between">
                  <span>Monto Total Links:</span>
                  <span className="font-extrabold text-secondary dark:text-foreground">${personalStats.paymentLinksValueSum.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Links Generados:</span>
                  <span className="font-extrabold text-secondary dark:text-foreground">{personalStats.paymentLinksCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Mensajes Enviados:</span>
                  <span className="font-extrabold text-secondary dark:text-foreground">{personalStats.messagesCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Última Gestión:</span>
                  <span className="font-bold text-secondary dark:text-foreground truncate max-w-[130px] inline-block" title={personalStats.lastManagement}>
                    {personalStats.lastManagement}
                  </span>
                </div>
              </div>

            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
