import React, { useMemo, useState } from 'react';
import { Transfer, User, Advisor } from '../types';
import { 
  Users, 
  MessageSquare, 
  Gift, 
  TrendingUp, 
  Download, 
  Filter as FilterIcon,
  ChevronDown,
  ChevronUp,
  User as UserIcon,
  Search,
  Calendar,
  DollarSign,
  Send,
  FileText,
  Briefcase,
  Layers,
  Award,
  ArrowUpRight,
  TrendingDown,
  Phone
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
  Cell,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, subDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Helper to normalize and match official carteras
function getOfficialCarteraKey(raw: string): string {
  const normalized = (raw || '').toLowerCase().trim();
  if (normalized.includes('ngso')) {
    return 'ngso';
  }
  if (normalized.includes('copropiedad')) {
    return 'copropiedades';
  }
  if (normalized.includes('desocupado')) {
    return 'desocupados';
  }
  if (normalized.includes('pre') && normalized.includes('jur')) {
    return 'pre jurídico';
  }
  if (normalized.includes('jur')) {
    return 'jurídico';
  }
  if (normalized.includes('cuota') || normalized.includes('al d') || normalized.includes('dia') || normalized.includes('día')) {
    return 'cuotas al día';
  }
  return '';
}

// Map key to official formatted name
function getOfficialCarteraName(key: string): string {
  switch (key) {
    case 'ngso': return 'NGSO';
    case 'pre jurídico': return 'Pre Jurídico';
    case 'jurídico': return 'Jurídico';
    case 'desocupados': return 'Desocupados';
    case 'cuotas al día': return 'Cuotas al Día';
    case 'copropiedades': return 'Copropiedades';
    default: return '';
  }
}

function resolveTransferCarteraKey(t: Transfer, advisors: Advisor[], currentUserCartera?: string): string {
  // If the transfer is explicitly for NGSO (acting as recipient) or any field indicates NGSO, count as ngso brand
  const isNgso = (t.cartera || '').toUpperCase().trim() === 'NGSO' ||
                 (t.toAdvisorName || '').toUpperCase().includes('NGSO') ||
                 (t.toAdvisorEmail || '').toLowerCase().trim() === 'lidercartera2@ngsoabogados.com' ||
                 (t.supervisorName || '').toUpperCase().includes('NGSO') ||
                 (t.supervisorEmail || '').toLowerCase().trim() === 'lidercartera2@ngsoabogados.com';

  if (isNgso) {
    return 'ngso';
  }

  const creatorEmail = (t.createdByEmail || t.fromAdvisorEmail || '').toLowerCase().trim();
  
  // Find creator in advisors
  const creator = advisors.find(a => a.email.toLowerCase().trim() === creatorEmail);
  if (creator && creator.cartera) {
    const key = getOfficialCarteraKey(creator.cartera);
    if (key) return key;
  }
  
  // If registered by current logged in user
  if (currentUserCartera && creatorEmail) {
    const key = getOfficialCarteraKey(currentUserCartera);
    if (key) return key;
  }

  // Find by name matching
  const nameToMatch = (t.fromAdvisorName || '').toLowerCase().trim();
  if (nameToMatch) {
    const creatorByName = advisors.find(a => (a.name || '').toLowerCase().trim() === nameToMatch);
    if (creatorByName && creatorByName.cartera) {
      const key = getOfficialCarteraKey(creatorByName.cartera);
      if (key) return key;
    }
  }

  // Fallback to the transfer's recipient cartera
  if (t.cartera) {
    const key = getOfficialCarteraKey(t.cartera);
    if (key) return key;
  }

  return '';
}

interface DashboardAdminProps {
  transfers: Transfer[];
  user: User;
  advisors: Advisor[];
}

export function DashboardAdmin({ transfers, user, advisors }: DashboardAdminProps) {
  const [filterCartera, setFilterCartera] = useState<string>('todos');
  const [filterAdvisor, setFilterAdvisor] = useState<string>('todos');
  const [filterSupervisor, setFilterSupervisor] = useState<string>('todos');
  const [filterChannel, setFilterChannel] = useState<string>('todos');
  const [filterManagementType, setFilterManagementType] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  
  // Custom states for interactive dashboard elements
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);
  const [activeChartTab, setActiveChartTab] = useState<'evolution' | 'comparison'>('evolution');

  // 📊 COMPUTED DATA WITH STRICT COHERENCE
  const filteredTransfers = useMemo(() => {
    return transfers.filter(t => {
      const key = resolveTransferCarteraKey(t, advisors, user.cartera);
      const matchesCartera = filterCartera === 'todos' || 
        key === getOfficialCarteraKey(filterCartera) ||
        (t.cartera || '').toLowerCase().trim() === filterCartera.toLowerCase().trim();
      
      const creatorEmail = (t.createdByEmail || t.fromAdvisorEmail || '').toLowerCase().trim();
      // Matches either fromAdvisor or toAdvisor
      const matchesAdvisor = filterAdvisor === 'todos' || 
        creatorEmail === filterAdvisor.toLowerCase().trim() || 
        (t.toAdvisorEmail || '').toLowerCase().trim() === filterAdvisor.toLowerCase().trim();
        
      const creator = advisors.find(a => a.email.toLowerCase().trim() === creatorEmail);
      const creatorSupervisorEmail = (creator?.supervisorEmail || '').toLowerCase().trim();
      const matchesSupervisor = filterSupervisor === 'todos' || 
        creatorSupervisorEmail === filterSupervisor.toLowerCase().trim() ||
        (t.supervisorEmail || '').toLowerCase().trim() === filterSupervisor.toLowerCase().trim();
      
      // Date filtering
      let matchesDate = true;
      if (dateFrom || dateTo) {
        const tDate = startOfDay(new Date(t.createdAt)).getTime();
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
      
      const getChan = (rec: any) => {
        const raw = rec.canalGestion || rec.channel || rec.canal || 'Llamada';
        return raw.toLowerCase().trim() === 'whatsapp' ? 'whatsapp' : 'llamada';
      };
      
      const matchesChannel = filterChannel === 'todos' || 
        getChan(t) === filterChannel.toLowerCase().trim();
      
      const matchesManagementType = filterManagementType === 'todos' ||
        (filterManagementType.toLowerCase() === 'mensaje' && t.type === 'mensaje') ||
        (filterManagementType.toLowerCase() === 'regalo' && t.type === 'regalo');
      
      return matchesCartera && matchesAdvisor && matchesSupervisor && matchesSearch && matchesDate && matchesChannel && matchesManagementType;
    });
  }, [transfers, filterCartera, filterAdvisor, filterSupervisor, searchQuery, dateFrom, dateTo, filterChannel, filterManagementType, advisors, user.cartera]);

  // CARTERA STATED GROUPINGS
  const carterasStats = useMemo(() => {
    const listMap = new Map<string, { name: string; total: number; transferencias: number; links: number; value: number; supervisor: string }>();

    // Mapping of official carteras and their supervisors
    const officialSupervisors: Record<string, string> = {
      'pre jurídico': 'Luis Alejandro González Piñeros / Yulieth Moreno',
      'jurídico': 'Ana María Gutiérrez',
      'desocupados': 'Mabel Andrade',
      'cuotas al día': 'Lizeth Osma',
      'copropiedades': 'Lizeth Osma Copropiedades',
      'ngso': 'NGSO'
    };

    const officialCarterasKeys = ['pre jurídico', 'jurídico', 'desocupados', 'cuotas al día', 'copropiedades', 'ngso'];
    officialCarterasKeys.forEach(k => {
      listMap.set(k, { 
        name: getOfficialCarteraName(k), 
        total: 0, 
        transferencias: 0, 
        links: 0, 
        value: 0,
        supervisor: officialSupervisors[k] || 'Por definir'
      });
    });

    filteredTransfers.forEach(t => {
      const key = resolveTransferCarteraKey(t, advisors, user.cartera);
      if (!key) return;

      const current = listMap.get(key);
      if (current) {
        current.total++;
        if (t.type === 'mensaje') {
          current.transferencias++;
        } else {
          current.links++;
          current.value += t.paymentLinkValue || 0;
        }
        listMap.set(key, current);
      }
    });

    const totalGestionesGlobal = filteredTransfers.length || 1;
    return Array.from(listMap.values()).map(item => ({
      ...item,
      percentage: Math.round((item.total / totalGestionesGlobal) * 100)
    }));
  }, [filteredTransfers, advisors, user.cartera]);

  const topCartera = useMemo(() => {
    if (carterasStats.length === 0) return { name: 'Ninguna', total: 0 };
    const sorted = [...carterasStats].sort((a, b) => b.total - a.total);
    return sorted[0] || { name: 'Ninguna', total: 0 };
  }, [carterasStats]);

  const activeAdvisorsInPeriod = useMemo(() => {
    const uniqueEmails = new Set<string>();
    filteredTransfers.forEach(t => {
      const creatorEmail = (t.createdByEmail || t.fromAdvisorEmail || '').toLowerCase().trim();
      if (creatorEmail) uniqueEmails.add(creatorEmail);
    });
    return uniqueEmails.size;
  }, [filteredTransfers]);

  const stats = useMemo(() => {
    const total = filteredTransfers.length;
    const callTransfers = filteredTransfers.filter(t => t.type === 'mensaje').length;
    const paymentLinks = filteredTransfers.filter(t => t.type === 'regalo').length;
    const totalValue = filteredTransfers.reduce((acc, t) => acc + (t.paymentLinkValue || 0), 0);
    
    const successRate = total > 0 ? Math.round((callTransfers / total) * 100) : 0;
    const linksSuccessRate = total > 0 ? Math.round((paymentLinks / total) * 100) : 0;

    return { total, callTransfers, paymentLinks, totalValue, successRate, linksSuccessRate, activeAdvisorsInPeriod, topCartera };
  }, [filteredTransfers, activeAdvisorsInPeriod, topCartera]);

  // 📈 ANALYTICS FOR CHANNELS (CANALES)
  const channelStats = useMemo(() => {
    const total = filteredTransfers.length;
    
    const getChan = (t: any) => {
      const raw = t.canalGestion || t.channel || t.canal || 'Llamada';
      return raw.toLowerCase().trim() === 'whatsapp' ? 'whatsapp' : 'llamada';
    };

    const whatsapp = filteredTransfers.filter(t => getChan(t) === 'whatsapp').length;
    const llamadas = filteredTransfers.filter(t => getChan(t) === 'llamada').length;
    const noEspecificado = 0;

    const pctWhatsapp = total > 0 ? Math.round((whatsapp / total) * 100) : 0;
    const pctLlamadas = total > 0 ? Math.round((llamadas / total) * 100) : 0;

    let canalMasUtilizado = 'Ninguno';
    if (whatsapp > llamadas) {
      canalMasUtilizado = 'WhatsApp';
    } else if (llamadas > whatsapp) {
      canalMasUtilizado = 'Llamada';
    } else if (whatsapp > 0 && whatsapp === llamadas) {
      canalMasUtilizado = 'Empate (Ambos)';
    }

    // Links generados por canal
    const linksWhatsapp = filteredTransfers.filter(t => t.type === 'regalo' && getChan(t) === 'whatsapp').length;
    const linksLlamadas = filteredTransfers.filter(t => t.type === 'regalo' && getChan(t) === 'llamada').length;

    // Transferencias por canal
    const transWhatsapp = filteredTransfers.filter(t => t.type === 'mensaje' && getChan(t) === 'whatsapp').length;
    const transLlamadas = filteredTransfers.filter(t => t.type === 'mensaje' && getChan(t) === 'llamada').length;

    return {
      total,
      whatsapp,
      llamadas,
      noEspecificado,
      pctWhatsapp,
      pctLlamadas,
      canalMasUtilizado,
      linksWhatsapp,
      linksLlamadas,
      transWhatsapp,
      transLlamadas
    };
  }, [filteredTransfers]);

  // Chart Data: Last 7 Days Evolution
  const evolutionData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = startOfDay(subDays(new Date(), 6 - i));
      return {
        date: format(d, 'dd MMM', { locale: es }),
        dateObj: d,
        transferencias: 0,
        links: 0,
        monto: 0
      };
    });

    filteredTransfers.forEach(t => {
      const tDate = startOfDay(new Date(t.createdAt));
      const day = days.find(d => d.dateObj.getTime() === tDate.getTime());
      if (day) {
        if (t.type === 'mensaje') {
          day.transferencias++;
        } else {
          day.links++;
          day.monto += (t.paymentLinkValue || 0);
        }
      }
    });

    return days;
  }, [filteredTransfers]);

  // Top list: Asesores que MÁS generan links de pago (using generatedBy / fromAdvisorEmail)
  const topValueAdvisors = useMemo(() => {
    const map = new Map<string, { email: string; name: string; count: number; value: number }>();
    filteredTransfers.forEach(t => {
      if (t.type === 'regalo') {
        const email = (t.createdByEmail || t.fromAdvisorEmail || '').toLowerCase().trim();
        if (!email || email === 'lidercartera2@ngsoabogados.com') return;
        const name = t.createdByName || t.fromAdvisorName || 'Desconocido';
        const val = t.paymentLinkValue || 0;
        const current = map.get(email) || { email, name, count: 0, value: 0 };
        current.count++;
        current.value += val;
        map.set(email, current);
      }
    });
    return Array.from(map.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredTransfers]);

  // Top list: Asesores que más reciben transferencias / casos (using toAdvisorEmail)
  const topReceivers = useMemo(() => {
    const map = new Map<string, { email: string; name: string; count: number }>();
    filteredTransfers.forEach(t => {
      const email = (t.toAdvisorEmail || '').toLowerCase().trim();
      if (!email || email === 'lidercartera2@ngsoabogados.com') return;
      const name = t.toAdvisorName || 'Pendiente';
      const current = map.get(email) || { email, name, count: 0 };
      current.count++;
      map.set(email, current);
    });
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredTransfers]);

  // Top list: Asesores que más transfieren llamadas (only type === 'mensaje' / 'Mensaje')
  const topSenders = useMemo(() => {
    const map = new Map<string, { email: string; name: string; count: number }>();
    filteredTransfers.forEach(t => {
      if (t.type === 'mensaje') {
        const email = (t.createdByEmail || t.fromAdvisorEmail || '').toLowerCase().trim();
        if (!email || email === 'lidercartera2@ngsoabogados.com') return;
        const name = t.createdByName || t.fromAdvisorName || 'Desconocido';
        const current = map.get(email) || { email, name, count: 0 };
        current.count++;
        map.set(email, current);
      }
    });
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredTransfers]);

  // Advisor performance charts (Total combining messages and links, grouped by maker / creator)
  const topAdvisorsByVolume = useMemo(() => {
    const map = new Map<string, { email: string; name: string; value: number }>();
    filteredTransfers.forEach(t => {
      const email = (t.createdByEmail || t.fromAdvisorEmail || '').toLowerCase().trim();
      if (!email || email === 'lidercartera2@ngsoabogados.com') return;
      const name = t.createdByName || t.fromAdvisorName || 'Desconocido';
      const current = map.get(email) || { email, name, value: 0 };
      current.value++;
      map.set(email, current);
    });
    return Array.from(map.values())
      .map(item => ({
        name: item.name.split(' ')[0] + ' ' + (item.name.split(' ')[1] || ''),
        fullName: item.name,
        email: item.email,
        value: item.value
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredTransfers]);

  const carteras = useMemo(() => {
    return ['Pre Jurídico', 'Jurídico', 'Desocupados', 'Cuotas al Día', 'Copropiedades', 'NGSO'];
  }, []);

  const uniqueAdvisors = useMemo(() => {
    const map = new Map();
    advisors.forEach(a => {
      map.set(a.email.toLowerCase(), a.name);
    });
    transfers.forEach(t => {
      if (!map.has(t.fromAdvisorEmail.toLowerCase())) {
        map.set(t.fromAdvisorEmail.toLowerCase(), t.fromAdvisorName);
      }
      if (!map.has(t.toAdvisorEmail.toLowerCase())) {
        map.set(t.toAdvisorEmail.toLowerCase(), t.toAdvisorName);
      }
    });
    // Ensure the central email maps to "NGSO" name
    map.set('lidercartera2@ngsoabogados.com', 'NGSO');
    return Array.from(map.entries());
  }, [transfers, advisors]);

  const uniqueSupervisors = useMemo(() => {
    const map = new Map();
    advisors.forEach(a => {
      if (a.supervisorEmail) {
        map.set(a.supervisorEmail.toLowerCase(), a.supervisor);
      }
    });
    transfers.forEach(t => {
      if (t.supervisorEmail && !map.has(t.supervisorEmail.toLowerCase())) {
        map.set(t.supervisorEmail.toLowerCase(), t.supervisorName);
      }
    });
    // Ensure the central email maps to "NGSO" name
    map.set('lidercartera2@ngsoabogados.com', 'NGSO');
    return Array.from(map.entries());
  }, [transfers, advisors]);

  const exportCSV = () => {
    try {
      const formatDateValue = (val: any): string => {
        if (!val) return '';
        try {
          let dateObj: Date;
          if (val instanceof Date) {
            dateObj = val;
          } else if (typeof val === 'object' && val.seconds !== undefined) {
            dateObj = new Date(val.seconds * 1000);
          } else if (typeof val === 'object' && typeof val.toDate === 'function') {
            dateObj = val.toDate();
          } else {
            dateObj = new Date(val);
          }
          if (isNaN(dateObj.getTime())) {
            return String(val);
          }
          return format(dateObj, 'dd/MM/yyyy HH:mm:ss');
        } catch {
          return String(val);
        }
      };

      const columns = [
        { label: 'Fecha y Hora', getValue: (t: Transfer, supervisor: string, cartera: string) => formatDateValue(t.createdAt) },
        { label: 'Cliente', getValue: (t: Transfer) => t.customerName || (t as any).cliente || (t as any).nombreCliente || '' },
        { label: 'Solicitud / Radicado', getValue: (t: Transfer) => t.requestNumber || (t as any).solicitud || (t as any).radicado || '' },
        { label: 'Teléfono de Contacto', getValue: (t: Transfer) => t.phone || (t as any).contactPhones || (t as any).phoneNumber || (t as any).customerPhone || (t as any).telefono || (t as any).telefonoCliente || (t as any).contactPhone || (t as any).mobile || (t as any).celular || '' },
        { label: 'Tipo de Gestión', getValue: (t: Transfer) => t.managementType || (t as any).tipoGestion || '' },
        { label: 'Canal', getValue: (t: Transfer) => t.canalGestion || (t as any).channel || (t as any).canal || 'Llamada' },
        { label: 'Valor del Link', getValue: (t: Transfer) => t.type === 'regalo' ? `$${(t.paymentLinkValue || 0).toLocaleString('es-CO')}` : '' },
        { label: 'Asesor que Registró la Gestión', getValue: (t: Transfer) => t.fromAdvisorName || '' },
        { label: 'Correo Asesor Emisor', getValue: (t: Transfer) => t.fromAdvisorEmail || '' },
        { label: 'Asesor Responsable', getValue: (t: Transfer) => t.toAdvisorName || '' },
        { label: 'Correo Asesor Responsable', getValue: (t: Transfer) => t.toAdvisorEmail || '' },
        { label: 'Supervisor', getValue: (t: Transfer, supervisor: string) => supervisor },
        { label: 'Cartera', getValue: (t: Transfer, supervisor: string, cartera: string) => cartera }
      ];

      const headers = columns.map(col => col.label);
      const csvRows = [headers.join(';')];

      filteredTransfers.forEach(t => {
        const creatorEmail = (t.createdByEmail || t.fromAdvisorEmail || '').toLowerCase().trim();
        const advisorObj = advisors.find(a => a.email.toLowerCase().trim() === creatorEmail);
        const supervisor = advisorObj?.supervisor || t.supervisorName || 'NGSO';
        const rawCartera = resolveTransferCarteraKey(t, advisors, user.cartera);
        const cartera = getOfficialCarteraName(rawCartera) || rawCartera || t.cartera || 'NGSO';

        const row = columns.map(col => col.getValue(t, supervisor, cartera));

        const escapedRow = row.map(val => {
          const str = val.replace(/"/g, '""');
          return `"${str}"`;
        });

        csvRows.push(escapedRow.join(';'));
      });

      const csvContent = "\uFEFF" + csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Reporte_Seguros_Bolivar_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("CSV descargado exitosamente");
    } catch (e) {
      console.error(e);
      toast.error("Error al exportar archivo CSV");
    }
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-[#041430] to-[#14233c] p-8 rounded-[2rem] text-white card-shadow border border-[#14233c]/40 dark:border-border/10">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
            Hola, {user.name} 👋
          </h1>
          <h2 className="text-base text-slate-200 font-bold mt-1">
            Bienvenido al Sistema de Transferencia de Llamadas de Seguros Bolívar
          </h2>
          <p className="text-slate-400 text-xs mt-1.5 font-medium">
            Monitoreo en tiempo real de transferencias, links de pago and productividad operativa.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            className="bg-[#EF0D0D] hover:bg-[#d80c0c] text-white font-extrabold rounded-xl text-xs px-6 h-12 shadow-lg shadow-rose-600/30 transition-all hover:scale-[1.03] active:scale-[0.98] border border-rose-500/10"
            onClick={exportCSV}
            disabled={filteredTransfers.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            EXPORTAR CSV CORPORATIVO
          </Button>
        </div>
      </div>

      {/* FILTROS AVANZADOS - COLLAPSIBLE FOR MODERN VIEW */}
      <Card className="rounded-[2rem] border border-border/40 dark:border-border/10 card-shadow overflow-hidden bg-card transition-all">
        <CardHeader 
          className="py-5 px-8 border-b border-border/40 dark:border-border/10 cursor-pointer select-none bg-muted/10 hover:bg-muted/20 transition-colors flex flex-row items-center justify-between"
          onClick={() => setIsFiltersOpen(!isFiltersOpen)}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 dark:text-rose-400 flex items-center justify-center">
              <FilterIcon className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-black text-secondary dark:text-foreground uppercase tracking-wider">
                Filtros
              </CardTitle>
              <CardDescription className="text-xs font-semibold">
                {isFiltersOpen ? "Haz clic para colapsar y optimizar el espacio visual" : "Haz clic para desplegar filtros de búsqueda y fechas"}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isFiltersOpen ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </CardHeader>

        <AnimatePresence initial={true}>
          {isFiltersOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <CardContent className="p-8 space-y-6">
                {/* Global Search Bar */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <Search className="w-5 h-5 text-muted-foreground group-focus-within:text-[#EF0D0D] transition-colors" />
                  </div>
                  <Input 
                    placeholder="Búsqueda rápida: Cliente, número de solicitud, teléfono o nombre del asesor..." 
                    className="h-14 pl-12 bg-muted/40 border border-slate-100 dark:border-slate-800 rounded-2xl font-bold transition-all focus-visible:ring-2 focus-visible:ring-rose-500 shadow-inner text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                {/* Dropdowns Filters Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-500 dark:text-slate-300 flex items-center gap-1.5 ml-1 uppercase tracking-widest">
                      <Calendar className="w-4 h-4 text-[#EF0D0D]" /> Fecha Desde
                    </Label>
                    <Input 
                      type="date" 
                      className="h-12 bg-muted/40 border border-slate-100 dark:border-slate-800 rounded-2xl font-bold focus-visible:ring-2 focus-visible:ring-rose-500 text-xs" 
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-500 dark:text-slate-300 flex items-center gap-1.5 ml-1 uppercase tracking-widest">
                      <Calendar className="w-4 h-4 text-[#EF0D0D]" /> Fecha Hasta
                    </Label>
                    <Input 
                      type="date" 
                      className="h-12 bg-muted/40 border border-slate-100 dark:border-slate-800 rounded-2xl font-bold focus-visible:ring-2 focus-visible:ring-rose-500 text-xs" 
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-500 dark:text-slate-300 flex items-center gap-1.5 ml-1 uppercase tracking-widest">
                      <Users className="w-4 h-4 text-[#EF0D0D]" /> Supervisor
                    </Label>
                    <Select value={filterSupervisor} onValueChange={setFilterSupervisor}>
                      <SelectTrigger className="h-12 bg-muted/40 border border-slate-100 dark:border-slate-800 rounded-2xl font-bold focus:ring-[#EF0D0D] text-xs">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-2xl">
                        <SelectItem value="todos" className="font-extrabold uppercase text-[10px] text-rose-600">Ver Todos</SelectItem>
                        {uniqueSupervisors.map(([email, name]) => (
                          <SelectItem key={email} value={email} className="font-bold text-xs">{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-500 dark:text-slate-300 flex items-center gap-1.5 ml-1 uppercase tracking-widest">
                      <UserIcon className="w-4 h-4 text-[#EF0D0D]" /> Asesor
                    </Label>
                    <Select value={filterAdvisor} onValueChange={setFilterAdvisor}>
                      <SelectTrigger className="h-12 bg-muted/40 border border-slate-100 dark:border-slate-800 rounded-2xl font-bold focus:ring-[#EF0D0D] text-xs">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-2xl">
                        <SelectItem value="todos" className="font-extrabold uppercase text-[10px] text-rose-600">Ver Todos</SelectItem>
                        {uniqueAdvisors.map(([email, name]) => (
                          <SelectItem key={email} value={email} className="font-bold text-xs">{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-500 dark:text-slate-300 flex items-center gap-1.5 ml-1 uppercase tracking-widest">
                      <Briefcase className="w-4 h-4 text-[#EF0D0D]" /> Cartera
                    </Label>
                    <Select value={filterCartera} onValueChange={setFilterCartera}>
                      <SelectTrigger className="h-12 bg-muted/40 border border-slate-100 dark:border-slate-800 rounded-2xl font-bold focus:ring-[#EF0D0D] text-xs">
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-2xl">
                        <SelectItem value="todos" className="font-extrabold uppercase text-[10px] text-rose-600">Ver Todas</SelectItem>
                        {carteras.map(c => (
                          <SelectItem key={c} value={c} className="font-bold text-xs">{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-500 dark:text-slate-300 flex items-center gap-1.5 ml-1 uppercase tracking-widest">
                      <Phone className="w-4 h-4 text-[#EF0D0D]" /> Canal de Gestión
                    </Label>
                    <Select value={filterChannel} onValueChange={setFilterChannel}>
                      <SelectTrigger className="h-12 bg-muted/40 border border-slate-100 dark:border-slate-800 rounded-2xl font-bold focus:ring-[#EF0D0D] text-xs">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-2xl">
                        <SelectItem value="todos" className="font-extrabold uppercase text-[10px] text-rose-600">Ver Todos</SelectItem>
                        <SelectItem value="Llamada" className="font-bold text-xs">📞 Llamada</SelectItem>
                        <SelectItem value="WhatsApp" className="font-bold text-xs">💬 WhatsApp</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-500 dark:text-slate-300 flex items-center gap-1.5 ml-1 uppercase tracking-widest">
                      <FileText className="w-4 h-4 text-[#EF0D0D]" /> Tipo de Gestión
                    </Label>
                    <Select value={filterManagementType} onValueChange={setFilterManagementType}>
                      <SelectTrigger className="h-12 bg-muted/40 border border-slate-100 dark:border-slate-800 rounded-2xl font-bold focus:ring-[#EF0D0D] text-xs">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-2xl">
                        <SelectItem value="todos" className="font-extrabold uppercase text-[10px] text-rose-600">Ver Todos</SelectItem>
                        <SelectItem value="mensaje" className="font-bold text-xs">✉️ Mensaje</SelectItem>
                        <SelectItem value="regalo" className="font-bold text-xs">💳 Regalo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end items-center pt-2 border-t border-border/40 dark:border-border/10">
                  <Button 
                    variant="link" 
                    className="text-rose-600 hover:text-rose-700 font-extrabold text-xs uppercase tracking-wider p-0 h-auto"
                    onClick={() => {
                      setFilterCartera('todos');
                      setFilterAdvisor('todos');
                      setFilterSupervisor('todos');
                      setFilterChannel('todos');
                      setFilterManagementType('todos');
                      setSearchQuery('');
                      setDateFrom('');
                      setDateTo('');
                      toast.success("Filtros restablecidos");
                    }}
                  >
                    Restablecer Todo
                  </Button>
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* HIGH-FIDELITY KPI CARDS - 6 CARDS FOR EXECUTIVE REVIEW */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {[
          { 
            label: 'Total Gestiones', 
            value: stats.total, 
            description: 'Mensajes & Links',
            icon: TrendingUp, 
            iconBg: 'bg-rose-500/10 text-[#EF0D0D] dark:bg-rose-500/20 dark:text-rose-400',
            trend: `Eficiencia ${stats.successRate}%`,
            border: 'border-l-[5px] border-l-[#EF0D0D]' 
          },
          { 
            label: 'Total Transferencias', 
            value: stats.callTransfers, 
            description: 'Llamadas redirigidas',
            icon: MessageSquare, 
            iconBg: 'bg-slate-500/10 text-[#041430] dark:bg-slate-500/20 dark:text-slate-300',
            trend: 'Mensajes de Voz/Chat',
            border: 'border-l-[5px] border-l-[#041430]' 
          },
          { 
            label: 'Links de Pago', 
            value: stats.paymentLinks, 
            description: 'Enlaces emitidos',
            icon: Send, 
            iconBg: 'bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20 dark:text-indigo-400',
            trend: `${stats.linksSuccessRate}% Participación`,
            border: 'border-l-[5px] border-l-[#6366F1]' 
          },
          { 
            label: '💳 Links Acordados', 
            value: `$${stats.totalValue.toLocaleString('es-CO')}`, 
            description: 'Pesos Colombianos ($)',
            icon: DollarSign, 
            iconBg: 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-400',
            trend: 'Valor total de links registrados',
            border: 'border-l-[5px] border-l-[#10B981]' 
          },
          { 
            label: 'Asesores Activos', 
            value: stats.activeAdvisorsInPeriod, 
            description: 'Productores del periodo',
            icon: Users, 
            iconBg: 'bg-[#06b6d4]/10 text-[#06b6d4] dark:bg-[#06b6d4]/20 dark:text-[#06b6d4]',
            trend: `${advisors.filter(a => a.active).length} registrados`,
            border: 'border-l-[5px] border-l-[#06B6D4]' 
          },
          { 
            label: 'Cartera Líder', 
            value: stats.topCartera.name, 
            description: 'Mayor volumen de casos',
            icon: Award, 
            iconBg: 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20 dark:text-amber-400',
            trend: `${stats.topCartera.total || 0} gestiones`,
            border: 'border-l-[5px] border-l-[#F59E0B]' 
          },
        ].map((stat, i) => (
          <motion.div 
            key={stat.label} 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: i * 0.05 }}
            whileHover={{ y: -3 }}
            className="h-full"
          >
            <Card className={cn("border border-border/45 dark:border-border/10 card-shadow rounded-2xl overflow-hidden py-3 h-full bg-card min-w-0 flex flex-col justify-between relative", stat.border)}>
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest truncate">{stat.label}</p>
                    <p className="text-xl md:text-2xl font-black text-slate-800 dark:text-foreground tracking-tight mt-1 truncate">{stat.value}</p>
                  </div>
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", stat.iconBg)}>
                    <stat.icon className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-muted flex flex-col gap-0.5 text-[11px]">
                  <span className="text-muted-foreground font-bold truncate">{stat.description}</span>
                  <span className="text-slate-800 dark:text-slate-200 font-extrabold mt-1 tracking-tight truncate">
                    {stat.trend}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ADVANCED RECHARTS COMPONENT */}
      <Card className="rounded-[2.5rem] border border-border/40 dark:border-border/10 card-shadow overflow-hidden bg-card">
        <CardHeader className="py-6 px-10 border-b border-border/40 dark:border-border/10 bg-muted/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-sm font-black text-[#041430] dark:text-foreground uppercase tracking-widest flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#EF0D0D]" />
              Evolución Temporal de Gestión
            </CardTitle>
            <CardDescription className="text-xs font-semibold">
              Comparativo de los últimos 7 días entre transferencias de llamadas y emisión de links de pago
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 bg-muted p-1 rounded-xl">
            <Button
              size="sm"
              variant={activeChartTab === 'evolution' ? 'default' : 'ghost'}
              className={cn("text-xs font-bold rounded-lg px-4 h-8", activeChartTab === 'evolution' ? "bg-[#041430] text-white" : "")}
              onClick={() => setActiveChartTab('evolution')}
            >
              Vista de Áreas
            </Button>
            <Button
              size="sm"
              variant={activeChartTab === 'comparison' ? 'default' : 'ghost'}
              className={cn("text-xs font-bold rounded-lg px-4 h-8", activeChartTab === 'comparison' ? "bg-[#041430] text-white" : "")}
              onClick={() => setActiveChartTab('comparison')}
            >
              Comparativo Barras
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-8 h-auto min-w-0">
          <div className="w-full h-[300px] min-h-0 min-w-0 font-sans">
            <ResponsiveContainer width="100%" height={300}>
              {activeChartTab === 'evolution' ? (
                <AreaChart data={evolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTransferencias" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorLinks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#CBD5E1" opacity={0.3} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }} />
                  <ReTooltip 
                    contentStyle={{ borderRadius: '16px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    itemStyle={{ fontWeight: 'black', fontSize: '12px' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                  <Area name="Transferencias de Llamada" type="monotone" dataKey="transferencias" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorTransferencias)" />
                  <Area name="Links de Pago" type="monotone" dataKey="links" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorLinks)" />
                </AreaChart>
              ) : (
                <BarChart data={evolutionData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#CBD5E1" opacity={0.3} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }} />
                  <ReTooltip 
                    cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
                    contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: 'var(--card)' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="rect" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                  <Bar name="Transferencias" dataKey="transferencias" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Bar name="Links Emitidos" dataKey="links" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* SECCIÓN CANAL DE GESTIÓN (NUEVOS METRICS EXPLICIT) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* PANEL PRINCIPAL CANALES */}
        <Card className="rounded-[2.5rem] border border-border/40 dark:border-border/10 card-shadow overflow-hidden bg-card">
          <CardHeader className="py-6 px-10 border-b border-border/40 dark:border-border/10 bg-muted/5 flex flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 dark:bg-violet-500/20 text-violet-500 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-[14px] font-black text-[#041430] dark:text-foreground uppercase tracking-wider">
                Resumen de Canales
              </CardTitle>
              <CardDescription className="text-xs font-semibold">
                Análisis general de distribución
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-8 flex flex-col justify-between h-[250px]">
            <div className="space-y-4 w-full">
              <div className="flex justify-between items-center bg-muted/50 p-4 rounded-2xl">
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Canal Más Utilizado</p>
                  <p className="text-sm font-black text-[#041430] dark:text-foreground mt-1">
                    {channelStats.canalMasUtilizado === 'WhatsApp' ? '💬 WhatsApp' : channelStats.canalMasUtilizado === 'Llamada' ? '📞 Llamada' : channelStats.canalMasUtilizado}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-violet-500/10 text-violet-500 flex items-center justify-center font-bold text-lg">
                  🏆
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-500/5 dark:bg-green-500/10 p-3.5 rounded-2xl border border-green-500/10">
                  <span className="text-[9px] font-black uppercase tracking-wider text-green-600 block">WhatsApp</span>
                  <span className="text-xl font-black text-green-700 dark:text-green-400 block mt-1">{channelStats.pctWhatsapp}%</span>
                  <span className="text-[10px] text-muted-foreground block font-bold mt-0.5">{channelStats.whatsapp} casos</span>
                </div>
                <div className="bg-blue-500/5 dark:bg-blue-500/10 p-3.5 rounded-2xl border border-blue-500/10">
                  <span className="text-[9px] font-black uppercase tracking-wider text-blue-600 block">Llamadas</span>
                  <span className="text-xl font-black text-blue-700 dark:text-blue-400 block mt-1">{channelStats.pctLlamadas}%</span>
                  <span className="text-[10px] text-muted-foreground block font-bold mt-0.5">{channelStats.llamadas} casos</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* DETALLE WHATSAPP */}
        <Card className="rounded-[2.5rem] border border-border/40 dark:border-border/10 card-shadow overflow-hidden bg-card">
          <CardHeader className="py-6 px-10 border-b border-border/40 dark:border-border/10 bg-muted/5 flex flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 dark:bg-green-500/20 text-green-500 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-[14px] font-black text-secondary dark:text-foreground uppercase tracking-wider">
                Desempeño WhatsApp
              </CardTitle>
              <CardDescription className="text-xs font-semibold">
                Gestión comercial por chat digital
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-8 flex flex-col justify-between h-[250px]">
            <div className="space-y-4 w-full">
              <div className="flex justify-between items-center border-b border-muted pb-3">
                <span className="text-xs font-bold text-muted-foreground">Links de Pago Generados</span>
                <span className="text-xs font-black text-green-600 bg-green-500/10 px-2.5 py-1 rounded-lg">
                  {channelStats.linksWhatsapp} links
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-muted pb-3">
                <span className="text-xs font-bold text-muted-foreground">Transferencias de Llamada</span>
                <span className="text-xs font-black text-green-600 bg-green-500/10 px-2.5 py-1 rounded-lg">
                  {channelStats.transWhatsapp} transferencias
                </span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs font-black text-secondary dark:text-foreground uppercase tracking-wide">Total Canal</span>
                <span className="text-lg font-black text-slate-800 dark:text-foreground">
                  {channelStats.whatsapp} gestiones
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* DETALLE LLAMADAS */}
        <Card className="rounded-[2.5rem] border border-border/40 dark:border-border/10 card-shadow overflow-hidden bg-card">
          <CardHeader className="py-6 px-10 border-b border-border/40 dark:border-border/10 bg-muted/5 flex flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-500 flex items-center justify-center">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-[14px] font-black text-secondary dark:text-foreground uppercase tracking-wider">
                Desempeño Llamadas
              </CardTitle>
              <CardDescription className="text-xs font-semibold">
                Gestión comercial por canal telefónico
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-8 flex flex-col justify-between h-[250px]">
            <div className="space-y-4 w-full">
              <div className="flex justify-between items-center border-b border-muted pb-3">
                <span className="text-xs font-bold text-muted-foreground">Links de Pago Generados</span>
                <span className="text-xs font-black text-blue-600 bg-blue-500/10 px-2.5 py-1 rounded-lg">
                  {channelStats.linksLlamadas} links
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-muted pb-3">
                <span className="text-xs font-bold text-muted-foreground">Transferencias de Llamada</span>
                <span className="text-xs font-black text-blue-600 bg-blue-500/10 px-2.5 py-1 rounded-lg">
                  {channelStats.transLlamadas} transferencias
                </span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs font-black text-secondary dark:text-foreground uppercase tracking-wide">Total Canal</span>
                <span className="text-lg font-black text-slate-800 dark:text-foreground">
                  {channelStats.llamadas} gestiones
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RANKINGS GRID SECTION - CORRECTED LOGIC OF ASSIGNMENTS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* TOP VALUE ADVISORS CARD - CORRECTED TO TAKE GENERATOR (CREATEDBY) OF LIKNS */}
        <Card className="rounded-[2.5rem] border border-border/40 dark:border-border/10 card-shadow overflow-hidden bg-card">
          <CardHeader className="py-6 px-10 border-b border-border/40 dark:border-border/10 bg-muted/5 flex flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-[#EF0D0D] flex items-center justify-center">
              <Award className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <CardTitle className="text-[14px] font-black text-secondary dark:text-foreground uppercase tracking-wider">
                Productividad en Generación de Links
              </CardTitle>
              <CardDescription className="text-xs font-semibold">
                Asesores que MÁS generan links de pago (ordenados por valor financiero colocado)
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-5">
            {topValueAdvisors.map((adv, i) => {
              const maxVal = topValueAdvisors[0]?.value || 1;
              const percentage = Math.round((adv.value / maxVal) * 100);
              return (
                <div key={adv.email} className="flex flex-col gap-2 group p-3.5 rounded-2xl bg-muted/5 hover:bg-muted/30 border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-all">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black",
                        i === 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50" :
                        i === 1 ? "bg-slate-150 text-slate-700 dark:bg-slate-900/50" :
                        "bg-orange-100 text-orange-700 dark:bg-orange-950/50"
                      )}>
                        #{i+1}
                      </span>
                      <div>
                        <p className="font-extrabold text-sm text-secondary dark:text-foreground group-hover:text-rose-600 transition-colors">
                          {adv.name}
                        </p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          {adv.count} links generados • {adv.email}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-black text-rose-500 dark:text-rose-400">${adv.value.toLocaleString('es-CO')}</p>
                    </div>
                  </div>
                  {/* Progress bar to represent comparative volume */}
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        i === 0 ? "bg-rose-500" : "bg-blue-500"
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {topValueAdvisors.length === 0 && (
              <div className="text-center py-20 text-slate-400 italic font-semibold text-sm">
                No se registran links de pago en el período seleccionado.
              </div>
            )}
          </CardContent>
        </Card>

        {/* TOP RECEIVERS PERFORMANCE - CORRECTED TO TAKE ASSIGNED RESPONSABLE (RECEIVER) */}
        <Card className="rounded-[2.5rem] border border-border/40 dark:border-border/10 card-shadow overflow-hidden bg-card">
          <CardHeader className="py-6 px-10 border-b border-border/40 dark:border-border/10 bg-muted/5 flex flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-[#041430] dark:text-slate-200 flex items-center justify-center">
              <Users className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <CardTitle className="text-[14px] font-black text-secondary dark:text-foreground uppercase tracking-wider">
                Asesores que más Reciben Llamadas
              </CardTitle>
              <CardDescription className="text-xs font-semibold">
                Gestores responsables con mayor volumen de casos y transferencias atendidas
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-5">
            {topReceivers.map((adv, i) => {
              const maxCount = topReceivers[0]?.count || 1;
              const percentage = Math.round((adv.count / maxCount) * 100);
              return (
                <div key={adv.email} className="flex flex-col gap-2 group p-3.5 rounded-2xl bg-muted/5 hover:bg-muted/30 border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-all">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-black">
                        #{i+1}
                      </span>
                      <div>
                        <p className="font-extrabold text-sm text-secondary dark:text-foreground group-hover:text-rose-600 transition-colors">
                          {adv.name}
                        </p>
                        <p className="text-[10px] font-semibold text-muted-foreground truncate max-w-[220px]">
                          {adv.email}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-secondary dark:text-foreground">{adv.count}</p>
                      <p className="text-[9px] font-black uppercase text-secondary/40 tracking-widest">Casos Recibidos</p>
                    </div>
                  </div>
                  {/* Progress indicator */}
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-1000"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {topReceivers.length === 0 && (
              <div className="text-center py-20 text-slate-400 italic font-semibold text-sm">
                No se registran casos recibidos en el período seleccionado.
              </div>
            )}
          </CardContent>
        </Card>

        {/* ASESORES QUE MAS TRANSFIEREN LLAMADAS (NEW CARD IN THE SYSTEM) */}
        <Card className="rounded-[2.5rem] border border-border/40 dark:border-border/10 card-shadow overflow-hidden bg-card">
          <CardHeader className="py-6 px-10 border-b border-border/40 dark:border-border/10 bg-muted/5 flex flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-[#EF0D0D] flex items-center justify-center">
              <Phone className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-[14px] font-black text-secondary dark:text-foreground uppercase tracking-wider">
                Asesores que más Transfieren
              </CardTitle>
              <CardDescription className="text-xs font-semibold">
                TOP 5 de asesores emisores ordenados por cantidad de llamadas transferidas (sin links de pago)
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-5">
            {topSenders.map((adv, i) => {
              const maxCount = topSenders[0]?.count || 1;
              const percentage = Math.round((adv.count / maxCount) * 100);
              return (
                <div key={adv.email} className="flex flex-col gap-2 group p-3.5 rounded-2xl bg-muted/5 hover:bg-muted/30 border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-all">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black",
                        i === 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50" :
                        i === 1 ? "bg-slate-150 text-slate-700 dark:bg-slate-900/50" :
                        "bg-[#3b82f6]/10 text-blue-500"
                      )}>
                        #{i+1}
                      </span>
                      <div>
                        <p className="font-extrabold text-sm text-secondary dark:text-foreground group-hover:text-blue-500 transition-colors">
                          {adv.name}
                        </p>
                        <p className="text-[10px] font-semibold text-muted-foreground truncate max-w-[220px]">
                          {adv.email}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-secondary dark:text-foreground">{adv.count}</p>
                      <p className="text-[9px] font-black uppercase text-secondary/40 tracking-widest">Transferencias</p>
                    </div>
                  </div>
                  {/* Progress indicator */}
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-blue-500 h-full rounded-full transition-all duration-1000"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {topSenders.length === 0 && (
              <div className="text-center py-20 text-slate-400 italic font-semibold text-sm">
                No se registran transferencias en el período seleccionado.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* LOWER ROW CHARTS FOR CARTERA DE-AGGREGATION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* PRODUCTIVITY BY ADVISOR */}
        <Card className="rounded-[2.5rem] border border-border/40 dark:border-border/10 card-shadow overflow-hidden bg-card">
          <CardHeader className="py-6 px-10 border-b border-border/40 dark:border-border/10 bg-muted/5 flex flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 text-orange-500 dark:text-orange-400 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-black text-secondary dark:text-foreground uppercase tracking-wider">
                Productividad Total por Asesor Emisor
              </CardTitle>
              <CardDescription className="text-xs font-semibold">
                Volumen total de llamadas y links iniciados en el lapso vigente
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-8 h-auto min-w-0">
            <div className="w-full h-[220px] min-h-0 min-w-0 font-sans">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topAdvisorsByVolume} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.4} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#64748B' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#64748B' }} />
                  <ReTooltip cursor={{ fill: 'var(--muted)', opacity: 0.15 }} contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: 'var(--card)' }} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={25} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* DISTRIBUCIÓN POR CARTERA (AGRUPADO CORRECTAMENTE SIN ADVISORS) */}
        <Card className="rounded-[2.5rem] border border-border/40 dark:border-border/10 card-shadow overflow-hidden bg-card">
          <CardHeader className="py-6 px-10 border-b border-border/40 dark:border-border/10 bg-muted/5 flex flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 dark:text-rose-400 flex items-center justify-center">
                <SparklesIcon className="w-4 h-4 text-rose-500" />
              </div>
              <div>
                <CardTitle className="text-sm font-black text-secondary dark:text-foreground uppercase tracking-wider">
                  Volumen y Distribución de Carteras
                </CardTitle>
                <CardDescription className="text-xs font-semibold">
                  Participación e interacciones consolidadas agrupadas por cartera oficial
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-8 flex flex-col md:flex-row gap-6 items-center justify-between h-auto">
            {/* Visual Chart */}
            <div className="w-full md:w-1/2 h-[200px] min-h-0 min-w-0 font-sans">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={carterasStats} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" opacity={0.4} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: 'var(--foreground)' }} width={90} />
                  <ReTooltip cursor={{ fill: 'var(--muted)', opacity: 0.15 }} contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: 'var(--card)', fontSize: '11px' }} />
                  <Bar dataKey="total" name="Total Gestiones" fill="#EF0D0D" radius={[0, 6, 6, 0]} barSize={14}>
                    {carterasStats.map((entry, index) => {
                      const colors = ['#EF0D0D', '#3b82f6', '#6366F1', '#10B981', '#F59E0B', '#0891B2'];
                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* List with detailed official numbers */}
            <div className="w-full md:w-1/2 flex flex-col gap-2.5 overflow-y-auto max-h-[220px] pr-2 scrollbar-thin">
              {carterasStats.map((c, i) => {
                const colors = ['bg-[#EF0D0D]', 'bg-[#3b82f6]', 'bg-[#6366F1]', 'bg-[#10B981]', 'bg-[#F59E0B]', 'bg-[#0891B2]'];
                return (
                  <div key={c.name} className="flex items-center justify-between text-xs p-1.5 rounded-lg border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn("w-2 h-2 rounded-full shrink-0", colors[i % colors.length])} />
                      <div className="truncate">
                        <p className="font-extrabold text-slate-800 dark:text-slate-100 truncate">{c.name}</p>
                        <p className="text-[9px] text-muted-foreground truncate font-semibold">Sup: {c.supervisor}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-slate-800 dark:text-slate-100">
                        {c.total} <span className="text-muted-foreground font-semibold text-[10px] ml-0.5">({c.percentage}%)</span>
                      </p>
                      <p className="text-[8px] font-bold text-muted-foreground">
                        {c.transferencias} T • {c.links} L
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

      </div>

    </div>
  );
}

// Simple Helper Component
function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}
