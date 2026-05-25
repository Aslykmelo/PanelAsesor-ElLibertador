import React, { useState, useMemo } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { MANAGEMENT_TYPES, UserRole } from '@/constants';
import { Transfer, Advisor } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Search, Filter, Calendar, MessageSquare, Gift, MoreHorizontal, Mail, Check, Trash2, Eye, EyeOff, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const getRecordChannel = (t: any): string => {
  return t.canalGestion || t.channel || t.canal || 'Llamada';
};

interface TransferListProps {
  transfers: Transfer[];
  onStatusChange?: (id: string, status: string) => void;
  onDelete?: (id: string) => void;
  userRole: UserRole;
  advisors: Advisor[];
  title?: string;
}

export const TransferList: React.FC<TransferListProps> = ({ transfers, onStatusChange, onDelete, userRole, advisors, title }) => {
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

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('todos');
  const [supervisorFilter, setSupervisorFilter] = useState('todos');
  const [channelFilter, setChannelFilter] = useState('todos');

  // Multi-row expanded states
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  // Sorting State
  const [sortField, setSortField] = useState<'createdAt' | 'customerName' | 'paymentLinkValue' | 'requestNumber' | 'status'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const supervisors = useMemo(() => {
    const fromAdvisors = new Set(advisors.map(a => a.supervisor).filter(Boolean));
    const fromTransfers = new Set(transfers.map(t => t.supervisorName).filter(Boolean));
    return Array.from(new Set([...Array.from(fromAdvisors), ...Array.from(fromTransfers)]));
  }, [advisors, transfers]);

  const toggleSort = (field: 'createdAt' | 'customerName' | 'paymentLinkValue' | 'requestNumber' | 'status') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  const processedTransfers = useMemo(() => {
    // 1. Filter
    const filtered = transfers.filter(t => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (t.customerName || '').toLowerCase().includes(searchLower) ||
        (t.requestNumber || '').toLowerCase().includes(searchLower) ||
        (t.fromAdvisorName || '').toLowerCase().includes(searchLower) ||
        (t.toAdvisorName || '').toLowerCase().includes(searchLower) ||
        (t.cartera || '').toLowerCase().includes(searchLower) ||
        (t.observations || '').toLowerCase().includes(searchLower);
      const matchesType = typeFilter === 'todos' || t.managementType === typeFilter;
      const matchesSupervisor = supervisorFilter === 'todos' || t.supervisorName === supervisorFilter;
      const matchesChannel = channelFilter === 'todos' || 
        getRecordChannel(t).toLowerCase().trim() === channelFilter.toLowerCase().trim();
      return matchesSearch && matchesType && matchesSupervisor && matchesChannel;
    });

    // 2. Sort
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'createdAt') {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        comparison = dateA - dateB;
      } else if (sortField === 'customerName') {
        comparison = (a.customerName || '').localeCompare(b.customerName || '');
      } else if (sortField === 'paymentLinkValue') {
        comparison = (a.paymentLinkValue || 0) - (b.paymentLinkValue || 0);
      } else if (sortField === 'requestNumber') {
        comparison = (a.requestNumber || '').localeCompare(b.requestNumber || '');
      } else if (sortField === 'status') {
        comparison = (a.status || '').localeCompare(b.status || '');
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [transfers, searchTerm, typeFilter, supervisorFilter, channelFilter, sortField, sortDirection]);

  // Pagination Calculations
  const totalItems = processedTransfers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedTransfers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return processedTransfers.slice(startIndex, startIndex + pageSize);
  }, [processedTransfers, currentPage, pageSize]);

  // Export to CSV Functionality
  const exportToCSV = () => {
    try {
      const headers = ['Fecha', 'Tipo', 'Canal de Gestión', 'Cliente', 'ID Solicitud', 'Telefono', 'De Asesor', 'Para Asesor', 'Supervisor', 'Cartera', 'Estado', 'Valor Link'];
      const rows = processedTransfers.map(t => [
        format(new Date(t.createdAt), 'yyyy-MM-dd HH:mm:ss'),
        t.managementType,
        getRecordChannel(t),
        t.customerName,
        t.requestNumber,
        getClientPhone(t),
        t.fromAdvisorName,
        t.toAdvisorName,
        t.supervisorName,
        t.cartera,
        t.status,
        t.paymentLinkValue || 0
      ]);

      const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
        + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Reporte_Gestiones_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("CSV exportado exitosamente con " + totalItems + " registros");
    } catch (e) {
      console.error(e);
      toast.error("Error al exportar archivo CSV");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* HEADER & FILTERS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-secondary dark:text-foreground">{title || "Historial de Gestiones"}</h2>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={exportToCSV}
            variant="outline"
            className="rounded-xl border-secondary text-secondary font-bold hover:bg-secondary/5 dark:border-border dark:text-foreground"
            disabled={totalItems === 0}
          >
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className="p-4 md:p-6 bg-card rounded-[2rem] card-shadow border border-border/40 dark:border-border/10 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row w-full gap-4 items-end">
          <div className="relative flex-1 w-full space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Búsqueda General</Label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar cliente, ID, asesor, cartera u observaciones..." 
                className="pl-12 h-12 bg-muted/30 border-none rounded-2xl focus-visible:ring-primary shadow-none font-medium"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-primary font-black text-[10px] uppercase tracking-widest hover:bg-primary/5 h-12 px-6 rounded-2xl border border-primary/20"
            onClick={() => {
              setSearchTerm('');
              setTypeFilter('todos');
              setSupervisorFilter('todos');
              setChannelFilter('todos');
              setCurrentPage(1);
            }}
          >
            Limpiar Filtros
          </Button>
        </div>
        
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${userRole !== 'asesor' ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-6 w-full`}>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Tipo de Gestión</Label>
            <Select value={typeFilter} onValueChange={(val) => { setTypeFilter(val); setCurrentPage(1); }}>
              <SelectTrigger className="w-full h-12 bg-muted/50 border-none rounded-2xl focus:ring-primary shadow-none font-bold text-xs">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="todos">Todos los tipos</SelectItem>
                {MANAGEMENT_TYPES.map(type => (
                  <SelectItem key={type} value={type}>{(type || 'Gestión').split(' ')[0]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {userRole !== 'asesor' && (
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Supervisor</Label>
              <Select value={supervisorFilter} onValueChange={(val) => { setSupervisorFilter(val); setCurrentPage(1); }}>
                <SelectTrigger className="w-full h-12 bg-muted/50 border-none rounded-2xl focus:ring-primary shadow-none font-bold text-xs">
                  <SelectValue placeholder="Supervisor" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="todos">Ver Todos</SelectItem>
                  {supervisors.map(sup => (
                    <SelectItem key={sup} value={sup}>{sup}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Canal de Gestión</Label>
            <Select value={channelFilter} onValueChange={(val) => { setChannelFilter(val); setCurrentPage(1); }}>
              <SelectTrigger className="w-full h-12 bg-muted/50 border-none rounded-2xl focus:ring-primary shadow-none font-bold text-xs">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="todos">Todos los canales</SelectItem>
                <SelectItem value="Llamada">📞 Llamada</SelectItem>
                <SelectItem value="WhatsApp">💬 WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-card rounded-[2.5rem] card-shadow border border-border/40 dark:border-border/10 overflow-hidden pb-4 text-secondary dark:text-foreground">
        <div className="overflow-x-auto custom-scrollbar">
          <Table className="relative min-w-full">
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow className="border-b border-border/50 hover:bg-transparent bg-muted/20">
                <TableHead 
                  onClick={() => toggleSort('customerName')}
                  className="font-black text-[10px] uppercase tracking-[0.2em] h-16 pl-8 text-primary cursor-pointer select-none"
                >
                  CLIENTE / SOLICITUD {sortField === 'customerName' && (sortDirection === 'asc' ? '▲' : '▼')}
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] h-16 text-primary">TIPO & CARTERA</TableHead>
                <TableHead 
                  onClick={() => toggleSort('status')}
                  className="font-black text-[10px] uppercase tracking-[0.2em] h-16 text-center text-primary cursor-pointer select-none"
                >
                  ESTADO {sortField === 'status' && (sortDirection === 'asc' ? '▲' : '▼')}
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] h-16 text-primary">EQUIPO (DE/PARA)</TableHead>
                <TableHead 
                  onClick={() => toggleSort('createdAt')}
                  className="font-black text-[10px] uppercase tracking-[0.2em] h-16 text-right pr-8 text-primary cursor-pointer select-none"
                >
                  FECHA {sortField === 'createdAt' && (sortDirection === 'asc' ? '▲' : '▼')}
                </TableHead>
                <TableHead className="h-16 w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTransfers.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={6} className="text-center py-20">
                      <div className="flex flex-col items-center gap-4 opacity-40">
                        <Search className="w-12 h-12" />
                        <p className="font-black text-lg">Sin resultados que coincidan</p>
                        <p className="text-sm">Intenta ajustar tus filtros de búsqueda</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedTransfers.map((t, idx) => {
                    const isExpanded = !!expandedRows[t.id || ''];
                    
                    const safeFormatDate = (dateVal: any, formatStr: string = "dd 'de' MMMM, yyyy - hh:mm:ss a") => {
                      if (!dateVal) return '';
                      try {
                        let d = dateVal;
                        if (typeof dateVal?.toDate === 'function') {
                          d = dateVal.toDate();
                        } else {
                          d = new Date(dateVal);
                        }
                        return format(d, formatStr, { locale: es });
                      } catch (err) {
                        return '';
                      }
                    };

                    const registradoPorName = t.createdByName || t.fromAdvisorName || 'No especificado';
                    const registradoPorEmail = t.createdByEmail || t.fromAdvisorEmail || '';
                    const responsableName = t.toAdvisorName || 'Pendiente';
                    const responsableEmail = t.toAdvisorEmail || '';

                    return (
                      <React.Fragment key={t.id || `row-${idx}`}>
                        <motion.tr 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className={cn(
                            "group border-b border-border/30 hover:bg-primary/[0.02] dark:hover:bg-primary/[0.05] transition-colors relative",
                            isExpanded && "bg-primary/[0.01] dark:bg-primary/[0.02]"
                          )}
                        >
                          <TableCell className="pl-8 py-6 relative">
                            <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-primary rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="flex items-center gap-5">
                              <div className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-black/5 transition-transform group-hover:scale-105",
                                t.type === 'mensaje' ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"
                              )}>
                                {t.type === 'mensaje' ? <MessageSquare className="w-6 h-6" /> : <Gift className="w-6 h-6" />}
                              </div>
                              <div className="space-y-1">
                                <p className="font-black text-base text-secondary dark:text-foreground group-hover:text-primary transition-colors leading-tight">{t.customerName}</p>
                                <div className="flex flex-wrap items-center gap-2">
                                   <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted/60 dark:bg-muted/10 px-2 py-0.5 rounded">ID: {t.requestNumber}</span>
                                   {getClientPhone(t) !== 'No especificado' && (
                                     <span className="text-[10px] font-bold text-muted-foreground">📞 {getClientPhone(t)}</span>
                                   )}
                                   {t.paymentLinkValue > 0 && (
                                     <span className="text-[10px] font-black text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">${t.paymentLinkValue.toLocaleString('es-CO')}</span>
                                   )}
                                   {t.notified && (
                                     <div className="flex items-center gap-1 bg-green-500/10 text-green-600 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border border-green-500/20" title="Notificación enviada por correo">
                                       <Mail className="w-3 h-3" />
                                       <span>Enviado</span>
                                     </div>
                                    )}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <div className="space-y-1">
                               <p className="text-xs font-black text-secondary dark:text-foreground uppercase leading-none">{(t.managementType || 'Gestión').split(' ')[0]}</p>
                               <div className="flex items-center gap-1.5">
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter">
                                    {t.cartera || 'Sin Cartera'}
                                  </p>
                               </div>
                               <div className="pt-1">
                                 <span className={cn(
                                   "text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider",
                                   getRecordChannel(t) === 'WhatsApp' ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300" :
                                   "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                                 )}>
                                   {getRecordChannel(t) === 'WhatsApp' ? '💬 WhatsApp' : '📞 Llamada'}
                                 </span>
                               </div>
                            </div>
                          </TableCell>
    
                          <TableCell className="text-center">
                            <div className="flex justify-center">
                              <span className={cn(
                                "px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm",
                                t.status === 'gestionado' ? "bg-green-100 text-green-700 dark:bg-green-950/45 dark:text-green-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/45 dark:text-yellow-400"
                              )}>
                                {t.status}
                              </span>
                            </div>
                          </TableCell>
    
                          <TableCell>
                            <div className="flex items-center gap-3">
                               <div className="flex -space-x-2.5">
                                  <div className="w-7 h-7 rounded-full bg-secondary border-2 border-card flex items-center justify-center text-[9px] font-bold text-white shadow-sm" title={`De: ${t.fromAdvisorName}`}>
                                     {(t.fromAdvisorName || '?').charAt(0)}
                                  </div>
                                  <div className="w-7 h-7 rounded-full bg-primary border-2 border-card flex items-center justify-center text-[9px] font-bold text-white shadow-sm" title={`Para: ${t.toAdvisorName}`}>
                                     {(t.toAdvisorName || '?').charAt(0)}
                                  </div>
                               </div>
                               <div className="hidden sm:block">
                                  <p className="text-[10px] font-black text-primary dark:text-rose-400 uppercase leading-tight">{(t.toAdvisorName || 'Asesor').split(' ')[0]}</p>
                                  <p className="text-[9px] font-bold text-muted-foreground uppercase">{(t.supervisorName || 'N/A').split(' ')[0]}</p>
                               </div>
                            </div>
                          </TableCell>
    
                          <TableCell className="text-right pr-8">
                            <div className="flex flex-col items-end">
                               <div className="flex items-center gap-1 text-secondary dark:text-foreground">
                                  <Calendar className="w-3 h-3 opacity-40" />
                                  <p className="text-xs font-black">{safeFormatDate(t.createdAt, 'dd MMM')}</p>
                               </div>
                               <p className="text-[9px] font-bold text-muted-foreground uppercase">{safeFormatDate(t.createdAt, 'h:mm a')}</p>
                            </div>
                          </TableCell>
    
                          <TableCell className="pr-8 text-right">
                            <div className="flex items-center justify-end gap-2">
                               <Button 
                                 onClick={() => {
                                   setExpandedRows(prev => ({
                                     ...prev,
                                     [t.id || '']: !prev[t.id || '']
                                   }));
                                 }}
                                 variant="ghost" 
                                 size="sm" 
                                 className={cn(
                                   "h-9 px-3 rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all outline-none",
                                   isExpanded 
                                     ? "bg-slate-200 dark:bg-slate-800 text-primary" 
                                     : "bg-primary/10 text-primary dark:bg-primary/20 hover:bg-primary/20"
                                 )}
                                 title="Ver Gestión Completa"
                               >
                                 {isExpanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                 <span>{isExpanded ? 'Ocultar' : 'Detalles'}</span>
                               </Button>


                              
                               {userRole === 'admin' && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-9 w-9 rounded-xl hover:bg-destructive/10 text-destructive border border-transparent hover:border-destructive/20 transition-all"
                                  onClick={() => {
                                    toast.warning('¿Eliminar registro?', {
                                      description: 'Esta acción no se puede deshacer.',
                                      action: {
                                        label: 'Eliminar',
                                        onClick: () => onDelete?.(t.id!)
                                      },
                                      cancel: {
                                        label: 'Cancelar'
                                      }
                                    });
                                  }}
                                  title="Eliminar Registro"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                               )}
                            </div>
                          </TableCell>
                        </motion.tr>

                        {/* Collapsible Expanded Details subrow */}
                        {isExpanded && (
                          <TableRow className="bg-muted/15 dark:bg-muted/5 hover:bg-transparent border-b border-border/20">
                            <TableCell colSpan={6} className="p-4 sm:p-6 md:p-8 pl-8 pr-8">
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                transition={{ duration: 0.25, ease: 'easeOut' }}
                                className="overflow-hidden"
                              >
                                <div className="bg-card dark:bg-slate-900/40 rounded-3xl border border-border/40 dark:border-border/10 p-5 sm:p-6 md:p-8 space-y-6 text-foreground shadow-xl">
                                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-border/30 dark:border-border/10 pb-4 gap-3">
                                    <div>
                                      <span className={cn(
                                        "text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full",
                                        t.type === 'mensaje' ? "bg-blue-500/10 text-blue-500 dark:bg-blue-500/20" : "bg-rose-500/10 text-rose-500 dark:bg-rose-500/20"
                                      )}>
                                        {t.type === 'mensaje' ? '📞 Transferencia de Llamada' : '💰 Link de Pago'}
                                      </span>
                                      <h3 className="text-lg font-black tracking-tight mt-1 ml-1">Historial Detallado de Gestión</h3>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-muted/40 dark:bg-muted/20 px-3 py-1.5 rounded-xl border border-border/20">
                                      <span className="truncate max-w-[150px] sm:max-w-none">ID: {t.id}</span>
                                      <button 
                                        onClick={() => handleCopy(t.id || '', `id-${t.id}`)}
                                        className="hover:text-primary transition-colors cursor-pointer shrink-0"
                                        title="Copiar ID de Registro"
                                      >
                                        {copiedId === `id-${t.id}` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                      </button>
                                    </div>
                                  </div>

                                  {/* GRID INFO */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                                    
                                    {/* COLUMN 1: DATOS DEL CLIENTE */}
                                    <div className="space-y-4">
                                      <h4 className="text-[11px] font-black uppercase tracking-[0.1em] text-red-500 dark:text-red-400 flex items-center gap-1.5 border-b border-border/30 dark:border-border/10 pb-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                        Información del Cliente
                                      </h4>
                                      <div className="bg-slate-50 dark:bg-slate-900/60 p-4 sm:p-5 rounded-2xl border border-border/45 dark:border-border/20 space-y-4">
                                        {/* Name */}
                                        <div className="space-y-0.5">
                                          <label className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider block">👤 Cliente</label>
                                          <p className="text-base font-black text-secondary dark:text-foreground">{t.customerName || '-'}</p>
                                        </div>
                                        
                                        {/* Request Number */}
                                        <div className="space-y-0.5">
                                          <label className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider block">📄 Solicitud / Radicado</label>
                                          <div className="flex items-center gap-2">
                                            <p className="text-sm font-mono font-black text-secondary dark:text-foreground">#{t.requestNumber || '-'}</p>
                                            {t.requestNumber && (
                                              <button 
                                                onClick={() => handleCopy(t.requestNumber, `req-${t.id}`)}
                                                className="text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                                                title="Copiar Solicitud"
                                              >
                                                {copiedId === `req-${t.id}` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                              </button>
                                            )}
                                          </div>
                                        </div>

                                        {/* DYNAMIC TELEPHONE NUMBER HIGHLIGHTED */}
                                        <div className="p-3 bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl space-y-1">
                                          <label className="text-[10px] font-black uppercase text-primary tracking-wider flex items-center gap-1">
                                            📞 TELÉFONO DE CONTACTO
                                          </label>
                                          <div className="flex items-center justify-between gap-2">
                                            <p className="text-base font-black text-secondary dark:text-foreground tracking-tight">{getClientPhone(t)}</p>
                                            {getClientPhone(t) !== 'No especificado' && (
                                              <button 
                                                onClick={() => handleCopy(getClientPhone(t), `phone-${t.id}`)}
                                                className="px-2 py-1 bg-primary text-white font-extrabold rounded-lg text-[10px] uppercase hover:bg-primary/95 transition-all text-xs flex items-center gap-1 active:scale-95"
                                                title="Copiar Teléfono"
                                              >
                                                {copiedId === `phone-${t.id}` ? (
                                                  <>
                                                    <Check className="w-3 h-3" />
                                                    <span>Copiado</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <Copy className="w-3 h-3" />
                                                    <span>Copiar</span>
                                                  </>
                                                )}
                                              </button>
                                            )}
                                          </div>
                                        </div>

                                        {/* Canal de gestión */}
                                        <div className="space-y-0.5">
                                          <label className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider block">💬 Canal de Contacto</label>
                                          <span className={cn(
                                            "inline-block mt-0.5 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider",
                                            getRecordChannel(t) === 'WhatsApp' 
                                              ? "bg-green-100 text-green-700 dark:bg-green-950/45 dark:text-green-300" 
                                              : "bg-blue-100 text-blue-700 dark:bg-blue-950/45 dark:text-blue-300"
                                          )}>
                                            {getRecordChannel(t) === 'WhatsApp' ? '💬 WhatsApp' : '📞 Llamada'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* COLUMN 2: ASESORES & EQUIPO */}
                                    <div className="space-y-4">
                                      <h4 className="text-[11px] font-black uppercase tracking-[0.1em] text-blue-500 dark:text-blue-400 flex items-center gap-1.5 border-b border-border/30 dark:border-border/10 pb-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                        Asesores y Equipos
                                      </h4>
                                      <div className="space-y-4 block">
                                        <div>
                                          <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">Asesor Emisor (Quien Registra)</label>
                                          <p className="text-sm font-extrabold text-secondary dark:text-foreground">{registradoPorName}</p>
                                          <p className="text-[10px] font-semibold text-muted-foreground">{registradoPorEmail}</p>
                                        </div>
                                        <div>
                                          <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">Asesor Responsable / Destino</label>
                                          <p className="text-sm font-extrabold text-secondary dark:text-foreground">{responsableName}</p>
                                          <p className="text-[10px] font-semibold text-muted-foreground">{responsableEmail}</p>
                                        </div>
                                        <div>
                                          <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">Supervisor & Cartera</label>
                                          <p className="text-sm font-extrabold text-secondary dark:text-foreground">{t.supervisorName || 'No asignado'}</p>
                                          <p className="text-[10px] font-black uppercase text-primary tracking-tight">{t.cartera || 'Sin Cartera'}</p>
                                        </div>
                                      </div>
                                    </div>

                                    {/* COLUMN 3: DETALLES DE LA GESTION */}
                                    <div className="space-y-4">
                                      <h4 className="text-[11px] font-black uppercase tracking-[0.1em] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 border-b border-border/30 dark:border-border/10 pb-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        Canales y Métricas
                                      </h4>
                                      <div className="space-y-3 block">
                                        <div>
                                          <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">Tipo de Gestión Exacto</label>
                                          <p className="text-sm font-extrabold text-secondary dark:text-foreground">{t.managementType || 'Contacto Directo'}</p>
                                        </div>
                                        <div>
                                          <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">Canal Utilizado</label>
                                          <span className={cn(
                                            "inline-block mt-1 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider",
                                            getRecordChannel(t) === 'WhatsApp' 
                                              ? "bg-green-100 text-green-700 dark:bg-green-950/45 dark:text-green-300" 
                                              : "bg-blue-100 text-blue-700 dark:bg-blue-950/45 dark:text-blue-300"
                                          )}>
                                            {getRecordChannel(t) === 'WhatsApp' ? '💬 WhatsApp' : '📞 Llamada'}
                                          </span>
                                        </div>
                                        {t.paymentLinkValue > 0 && (
                                          <div>
                                            <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">Valor de Link Generado</label>
                                            <p className="text-base font-black text-emerald-600 dark:text-emerald-400">${t.paymentLinkValue.toLocaleString('es-CO')} COP</p>
                                          </div>
                                        )}
                                        <div>
                                          <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">Estado Actual & Trazabilidad</label>
                                          <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <span className={cn(
                                              "px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm",
                                              t.status === 'gestionado' ? "bg-green-100 text-green-700 dark:bg-green-950/45 dark:text-green-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/45 dark:text-yellow-400"
                                            )}>
                                              {t.status}
                                            </span>
                                            {t.notified && (
                                              <span className="bg-teal-500/10 text-teal-600 border border-teal-500/20 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
                                                Enviado por Mail
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    
                                  </div>

                                  {/* FULL-WIDTH OBSERVATIONS SECTION */}
                                  <div className="bg-muted/40 dark:bg-muted/10 p-5 sm:p-6 rounded-2xl border border-border/50 text-left space-y-2">
                                    <h5 className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">Observaciones de la Gestión</h5>
                                    <p className="text-sm font-semibold text-secondary dark:text-foreground leading-relaxed whitespace-pre-line">
                                      {t.observations?.trim() || 'No se registraron observaciones adicionales para esta gestión.'}
                                    </p>
                                  </div>

                                  {/* FOOTER METRICS AND STAMPS */}
                                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-[10px] font-semibold text-muted-foreground border-t border-border/40 dark:border-border/10 pt-4 gap-2">
                                    <div>
                                      <span>Registrado el: </span>
                                      <span className="font-extrabold text-secondary dark:text-foreground">
                                        {safeFormatDate(t.createdAt)}
                                      </span>
                                    </div>
                                    {t.updatedAt && (
                                      <div>
                                        <span>Última actualización: </span>
                                        <span className="font-extrabold text-secondary dark:text-foreground">
                                          {safeFormatDate(t.updatedAt)}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                </div>
                              </motion.div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
            </TableBody>
          </Table>
        </div>

        {/* PAGINATION CONTROLS */}
        {totalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-8 pt-4 gap-4 bg-card">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Mostrar</span>
              <select 
                value={pageSize} 
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-muted border-none rounded-lg text-xs font-bold p-1 px-2 text-secondary dark:text-foreground focus:ring-1 focus:ring-primary"
              >
                {[5, 10, 15, 20, 50].map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground font-medium">por página</span>
            </div>

            <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
              Mostrando {Math.min(totalItems, (currentPage - 1) * pageSize + 1)}-{Math.min(totalItems, currentPage * pageSize)} de {totalItems} registros
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 rounded-lg font-bold border-border/80 text-xs px-3" 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              >
                Anterior
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                // Showing around the current page
                if (totalPages > 5 && Math.abs(currentPage - page) > 1 && page !== 1 && page !== totalPages) {
                  if (page === 2 || page === totalPages - 1) return <span key={page} className="text-muted-foreground text-xs font-bold px-1 select-none">...</span>;
                  return null;
                }
                return (
                  <Button 
                    key={page}
                    variant={currentPage === page ? "default" : "outline"} 
                    size="sm" 
                    className={cn(
                      "h-8 w-8 p-0 rounded-lg font-bold text-xs",
                      currentPage === page ? "bg-primary text-white" : "border-border/80"
                    )}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                );
              })}
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 rounded-lg font-bold border-border/80 text-xs px-3" 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
