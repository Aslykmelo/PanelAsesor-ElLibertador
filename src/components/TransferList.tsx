import React, { useState } from 'react';
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
import { TRANSFER_STATUSES, MANAGEMENT_TYPES, ADVISORS, UserRole } from '@/constants';
import { Transfer } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, Search, Filter, Calendar, MessageSquare, Gift, MoreHorizontal, Mail, Check, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TransferListProps {
  transfers: Transfer[];
  onStatusChange?: (id: string, status: string) => void;
  onDelete?: (id: string) => void;
  userRole: UserRole;
}

export const TransferList: React.FC<TransferListProps> = ({ transfers, onStatusChange, onDelete, userRole }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [typeFilter, setTypeFilter] = useState('todos');
  const [supervisorFilter, setSupervisorFilter] = useState('todos');

  const supervisors = Array.from(new Set(ADVISORS.map(a => a.supervisor)));

  const filteredTransfers = transfers.filter(t => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      t.customerName.toLowerCase().includes(searchLower) ||
      t.requestNumber.toLowerCase().includes(searchLower) ||
      t.fromAdvisorName.toLowerCase().includes(searchLower) ||
      t.toAdvisorName.toLowerCase().includes(searchLower) ||
      t.cartera?.toLowerCase().includes(searchLower) ||
      t.observations?.toLowerCase().includes(searchLower);
    const matchesStatus = statusFilter === 'todos' || t.status === statusFilter;
    const matchesType = typeFilter === 'todos' || t.managementType === typeFilter;
    const matchesSupervisor = supervisorFilter === 'todos' || t.supervisorName === supervisorFilter;
    return matchesSearch && matchesStatus && matchesType && matchesSupervisor;
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* HEADER & FILTERS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-secondary">Historial de Gestiones</h2>
          <p className="text-muted-foreground text-sm font-medium">Visualiza y gestiona todos los registros del sistema</p>
        </div>
      </div>

      <div className="p-4 md:p-6 bg-card rounded-[2rem] card-shadow border-none flex flex-col gap-6 items-center">
        <div className="flex flex-col md:flex-row w-full gap-4 items-end">
          <div className="relative flex-1 w-full space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Búsqueda General</Label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar cliente, ID, asesor, cartera u observaciones..." 
                className="pl-12 h-12 bg-muted/50 border-none rounded-2xl focus-visible:ring-primary shadow-none font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
            }}
          >
            Limpiar Filtros
          </Button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Tipo de Gestión</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full h-12 bg-muted/50 border-none rounded-2xl focus:ring-primary shadow-none font-bold text-xs">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="todos">Todos los tipos</SelectItem>
                {MANAGEMENT_TYPES.map(type => (
                  <SelectItem key={type} value={type}>{type.split(' ')[0]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {userRole !== 'asesor' && (
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Supervisor</Label>
              <Select value={supervisorFilter} onValueChange={setSupervisorFilter}>
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
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
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-card rounded-[2.5rem] card-shadow overflow-hidden border-none pb-8 text-secondary">
        <div className="overflow-x-auto custom-scrollbar">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border/50 hover:bg-transparent bg-muted/20">
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] h-16 pl-8 text-primary">CLIENTE / SOLICITUD</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] h-16 text-primary">TIPO & CARTERA</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] h-16 text-center text-primary">ESTADO</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] h-16 text-primary">EQUIPO (DE/PARA)</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] h-16 text-right pr-8 text-primary">FECHA</TableHead>
                <TableHead className="h-16 w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {filteredTransfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-32">
                      <div className="flex flex-col items-center gap-4 opacity-40">
                        <Search className="w-12 h-12" />
                        <p className="font-black text-lg">Sin resultados que coincidan</p>
                        <p className="text-sm">Intenta ajustar tus filtros de búsqueda</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransfers.map((t, idx) => (
                    <motion.tr 
                      key={t.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="group border-b border-border/30 hover:bg-primary/[0.02] transition-colors relative"
                    >
                      <TableCell className="pl-8 py-8 relative">
                        <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-primary rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex items-center gap-5">
                          <div className={cn(
                            "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-black/5 transition-transform group-hover:scale-110",
                            t.type === 'mensaje' ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"
                          )}>
                            {t.type === 'mensaje' ? <MessageSquare className="w-7 h-7" /> : <Gift className="w-7 h-7" />}
                          </div>
                          <div className="space-y-1">
                            <p className="font-black text-lg text-secondary group-hover:text-primary transition-colors leading-tight">{t.customerName}</p>
                            <div className="flex items-center gap-2">
                               <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted px-2 py-0.5 rounded">ID: {t.requestNumber}</span>
                               <span className="text-[10px] font-bold text-muted-foreground">{t.phone}</span>
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
                        <div className="space-y-1.5">
                           <p className="text-xs font-black text-secondary uppercase leading-none">{t.managementType.split(' ')[0]}</p>
                           <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-primary" />
                              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter">
                                {t.cartera || 'Sin Cartera'}
                              </p>
                           </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <span className={cn(
                            "px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm",
                            t.status === 'gestionado' ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                          )}>
                            {t.status}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-4">
                           <div className="flex -space-x-3">
                              <div className="w-8 h-8 rounded-full bg-secondary border-2 border-card flex items-center justify-center text-[10px] font-bold text-white shadow-sm" title={`De: ${t.fromAdvisorName}`}>
                                 {t.fromAdvisorName.charAt(0)}
                              </div>
                              <div className="w-8 h-8 rounded-full bg-primary border-2 border-card flex items-center justify-center text-[10px] font-bold text-white shadow-sm" title={`Para: ${t.toAdvisorName}`}>
                                 {t.toAdvisorName.charAt(0)}
                              </div>
                           </div>
                           <div className="hidden sm:block">
                              <p className="text-[10px] font-black text-primary uppercase leading-tight">{t.toAdvisorName.split(' ')[0]}</p>
                              <p className="text-[9px] font-bold text-muted-foreground uppercase">{t.supervisorName.split(' ')[0]}</ p>
                           </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-right pr-8">
                        <div className="flex flex-col items-end gap-1">
                           <div className="flex items-center gap-2 text-secondary">
                              <Calendar className="w-3 h-3 opacity-40" />
                              <p className="text-xs font-black">{format(t.createdAt, 'dd MMM', { locale: es })}</p>
                           </div>
                           <p className="text-[10px] font-bold text-muted-foreground uppercase">{format(t.createdAt, 'p')}</p>
                        </div>
                      </TableCell>

                      <TableCell className="pr-8 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {t.status === 'pendiente' && (userRole !== 'asesor' || t.toAdvisorEmail === ADVISORS.find(a => a.correo === t.toAdvisorEmail)?.correo) && (
                            <Button 
                              onClick={() => onStatusChange?.(t.id!, 'gestionado')}
                              size="sm" 
                              className="bg-primary hover:bg-primary/90 text-white font-black rounded-2xl text-[10px] h-10 px-6 shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              GESTIONAR
                            </Button>
                          )}
                          
                          {userRole === 'admin' && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-10 w-10 rounded-xl hover:bg-destructive/10 text-destructive border border-transparent hover:border-destructive/20 transition-all"
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
                              <Trash2 className="w-5 h-5" />
                            </Button>
                          )}
                          
                          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-secondary/5 transition-all">
                             <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};
