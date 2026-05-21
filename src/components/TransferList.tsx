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
import { TRANSFER_STATUSES, MANAGEMENT_TYPES, UserRole } from '@/constants';
import { Transfer, Advisor } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, Search, Filter, Calendar, MessageSquare, Gift, MoreHorizontal, Mail, Check, Trash2 } from 'lucide-react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [typeFilter, setTypeFilter] = useState('todos');
  const [supervisorFilter, setSupervisorFilter] = useState('todos');
  const [channelFilter, setChannelFilter] = useState('todos');

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
      const matchesStatus = statusFilter === 'todos' || t.status === statusFilter;
      const matchesType = typeFilter === 'todos' || t.managementType === typeFilter;
      const matchesSupervisor = supervisorFilter === 'todos' || t.supervisorName === supervisorFilter;
      const matchesChannel = channelFilter === 'todos' || 
        getRecordChannel(t).toLowerCase().trim() === channelFilter.toLowerCase().trim();
      return matchesSearch && matchesStatus && matchesType && matchesSupervisor && matchesChannel;
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
  }, [transfers, searchTerm, statusFilter, typeFilter, supervisorFilter, sortField, sortDirection]);

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
        t.phone,
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
          <p className="text-muted-foreground text-sm font-medium">
            {title === "Mis Gestiones" 
              ? "Revisa y administra el progreso de tus registros personales" 
              : "Visualiza y gestiona todos los registros con paginación y ordenamiento"}
          </p>
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
              setStatusFilter('todos');
              setTypeFilter('todos');
              setSupervisorFilter('todos');
              setCurrentPage(1);
            }}
          >
            Limpiar Filtros
          </Button>
        </div>
        
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${userRole !== 'asesor' ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-6 w-full`}>
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
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Estado</Label>
            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}>
              <SelectTrigger className="w-full h-12 bg-muted/50 border-none rounded-2xl focus:ring-primary shadow-none font-bold text-xs">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="todos">Todos</SelectItem>
                {TRANSFER_STATUSES.map(status => (
                  <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
              <AnimatePresence mode="popLayout">
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
                  paginatedTransfers.map((t, idx) => (
                    <motion.tr 
                      key={t.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="group border-b border-border/30 hover:bg-primary/[0.02] dark:hover:bg-primary/[0.05] transition-colors relative"
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
                               <span className="text-[10px] font-bold text-muted-foreground">{t.phone}</span>
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
                              <p className="text-xs font-black">{format(new Date(t.createdAt), 'dd MMM', { locale: es })}</p>
                           </div>
                           <p className="text-[9px] font-bold text-muted-foreground uppercase">{format(new Date(t.createdAt), 'h:mm a')}</p>
                        </div>
                      </TableCell>

                      <TableCell className="pr-8 text-right">
                        <div className="flex items-center justify-end gap-2">
                           {t.status === 'pendiente' && (userRole !== 'asesor' || t.toAdvisorEmail.toLowerCase() === (advisors.find(a => a.email.toLowerCase() === t.toAdvisorEmail.toLowerCase())?.email?.toLowerCase() || t.toAdvisorEmail.toLowerCase())) && (
                            <Button 
                              onClick={() => {
                                onStatusChange?.(t.id!, 'gestionado');
                              }}
                              size="sm" 
                              className="bg-primary hover:bg-primary/90 text-white font-black rounded-2xl text-[10px] h-9 px-4 shadow-md shadow-primary/20 transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              Gestionar
                            </Button>
                           )}
                          
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
                  ))
                )}
              </AnimatePresence>
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
