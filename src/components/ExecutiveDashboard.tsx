import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  BarChart3, 
  PieChart as PieIcon, 
  Calendar, 
  Filter, 
  Users, 
  Award, 
  Download, 
  Search, 
  FileSpreadsheet, 
  FileText, 
  RefreshCw, 
  Briefcase, 
  AlertTriangle,
  RotateCcw, 
  DollarSign, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ArrowUpRight, 
  HelpCircle, 
  HeartHandshake,
  MessageSquare,
  Phone,
  Undo2,
  Percent,
  Send
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Transfer, User, Advisor } from '@/types';
import { supabase, runWithRetry } from '@/supabase';
import { toast } from 'sonner';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExecutiveDashboardProps {
  transfers: Transfer[];
  user: User;
  advisors: Advisor[];
}

interface RecaudoHistoricoDB {
  id?: string;
  id_registro_crm: string;
  solicitud: string;
  cliente: string;
  estado_recibo: string;
  valor_link_crm: number;
  valor_liquidacion: number;
  funcionario: string;
  fecha_generacion_link: string;
  fecha_vencimiento_link: string;
  fecha_pago: string;
  fecha_importacion?: string;
  archivo_origen: string;
  usuario_importacion: string;
  tipo_recaudo?: string;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({ transfers, user, advisors }) => {
  const [bankRecords, setBankRecords] = useState<RecaudoHistoricoDB[]>(() => {
    try {
      const cached = localStorage.getItem('recaudo_historico_local_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [isLoadingDb, setIsLoadingDb] = useState(false);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'operativos' | 'links' | 'apoyos' | 'transferencias' | 'graficas' | 'embudo'>('operativos');
  const [advisorSortKey, setAdvisorSortKey] = useState<'casos' | 'linksGen' | 'linksPagados' | 'valorGen' | 'valorRec' | 'conversion' | 'tiempoPago'>('valorRec');

  // Filters State
  const [filterStartDate, setFilterStartDate] = useState<string>(() => {
    // Default to the first day of the current month for cleaner initial visualization
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  });
  const [filterEndDate, setFilterEndDate] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [filterSupervisor, setFilterSupervisor] = useState<string>('todos');
  const [filterResponsable, setFilterResponsable] = useState<string>('todos');
  const [filterEmisor, setFilterEmisor] = useState<string>('todos');
  const [filterCartera, setFilterCartera] = useState<string>('todos');
  const [filterCanal, setFilterCanal] = useState<string>('todos');
  const [filterAsesor, setFilterAsesor] = useState<string>('todos');

  // Load from Supabase on mount and keep sync
  const fetchFromSupabase = async () => {
    setIsLoadingDb(true);
    setSupabaseError(null);
    let success = false;
    let records: any[] = [];

    // 1. Try Supabase with retry if available
    if (supabase) {
      try {
        const { data, error } = await runWithRetry<any[]>(async () => {
          const res = await supabase.from('recaudo_historico').select('*');
          return { data: res.data, error: res.error };
        });
        if (!error && data) {
          records = data;
          success = true;
          setSupabaseError(null);
          console.log("Dashboard Ejecutivo: Cargado de recaudo desde Supabase.");
        } else if (error) {
          console.error("Error fetching recaudo_historico:", error);
          setSupabaseError(error?.message || "Error al conectar con Supabase");
        }
      } catch (sErr: any) {
        console.error("Supabase exception:", sErr);
        setSupabaseError(sErr?.message || "Excepción de red al conectar con Supabase");
      }
    } else {
      setSupabaseError("Supabase no está configurado o no está disponible.");
    }

    if (success && records.length > 0) {
      const filteredRecords = records.filter(r => r.id_registro_crm !== 'METADATA_RECORD');
      setBankRecords(filteredRecords);
      try {
        localStorage.setItem('recaudo_historico_local_cache', JSON.stringify(filteredRecords));
      } catch (e) {
        console.error("Local storage sync error:", e);
      }
    } else {
      // Fallback to local cache if no online source is available
      try {
        const cached = localStorage.getItem('recaudo_historico_local_cache');
        if (cached) {
          setBankRecords(JSON.parse(cached));
        }
      } catch {}
    }
    setIsLoadingDb(false);
  };

  useEffect(() => {
    fetchFromSupabase();

    if (!supabase) return;
    // Set up real-time listener for live updates
    const channel = supabase
      .channel('recaudo-exec-dashboard-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recaudo_historico' }, () => {
        fetchFromSupabase();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Safe date parses
  const parseToDate = (val: any): Date | null => {
    if (!val || val === '-') return null;
    try {
      if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
      const valStr = String(val).trim();
      if (valStr === '' || valStr === '-') return null;

      if (valStr.includes('-')) {
        const parts = valStr.split('T')[0].split('-');
        if (parts.length === 3) {
          return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        }
      }
      if (valStr.includes('/')) {
        const parts = valStr.split('/');
        if (parts.length === 3) {
          return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        }
      }
      const fallback = new Date(valStr);
      return isNaN(fallback.getTime()) ? null : fallback;
    } catch {
      return null;
    }
  };

  // Date formatting helpers
  const formatGenerateDateString = (createdAt: any): string => {
    if (!createdAt) return '-';
    try {
      let date: Date;
      if (createdAt.seconds && typeof createdAt.toDate === 'function') {
        date = createdAt.toDate();
      } else if (createdAt instanceof Date) {
        date = createdAt;
      } else {
        date = new Date(createdAt);
      }
      if (isNaN(date.getTime())) return '-';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${year}-${month}-${day}`;
    } catch {
      return '-';
    }
  };

  // Reconciled rows construction linked to transfers
  const reconciledLinks = useMemo(() => {
    const dbMap = new Map<string, RecaudoHistoricoDB>();
    bankRecords.forEach(r => {
      dbMap.set(r.id_registro_crm, r);
    });

    const activeLinks = transfers.filter(t => t.type === 'regalo');

    return activeLinks.map(t => {
      const match = dbMap.get(t.id || '');
      let estadoCRM: 'PAGADO' | 'NO PAGADO' | 'PENDIENTE' = 'PENDIENTE';
      let funcionario = '-';
      let fecha_pago = '-';
      let valor_liquidacion = 0;
      let fecha_generacion_link = formatGenerateDateString(t.createdAt);
      let fecha_vencimiento_link = '-';
      let archivo_origen = '-';
      let usuario_importacion = '-';
      let tipo_recaudo = '';

      if (match) {
        funcionario = match.funcionario || '-';
        fecha_pago = match.estado_recibo === 'RECIBO' ? match.fecha_pago : '-';
        valor_liquidacion = match.estado_recibo === 'RECIBO' ? (match.valor_liquidacion || 0) : 0;
        fecha_generacion_link = match.fecha_generacion_link || fecha_generacion_link;
        fecha_vencimiento_link = match.fecha_vencimiento_link || '-';
        archivo_origen = match.archivo_origen || '-';
        usuario_importacion = match.usuario_importacion || '-';
        tipo_recaudo = match.tipo_recaudo || '';

        if (match.estado_recibo === 'RECIBO') {
          estadoCRM = 'PAGADO';
        } else if (match.estado_recibo === 'ANULADO') {
          estadoCRM = 'NO PAGADO';
        } else {
          estadoCRM = 'PENDIENTE';
        }
      }

      return {
        id_registro_crm: t.id,
        cliente: t.customerName,
        solicitud: t.requestNumber,
        emisor: t.fromAdvisorName,
        responsable: t.toAdvisorName,
        supervisor: t.supervisorName,
        cartera: t.cartera,
        valor_link_crm: t.paymentLinkValue || 0,
        valor_liquidacion,
        estadoCRM,
        funcionario,
        fecha_generacion_link,
        fecha_vencimiento_link,
        fecha_pago,
        archivo_origen,
        usuario_importacion,
        tipo_recaudo,
        originalTransfer: t
      };
    });
  }, [transfers, bankRecords]);

  // Helper to resolve portfolio of any advisor
  const getAdvisorCartera = (name: string): string => {
    if (!name) return 'Sin Cartera';
    const match = advisors.find(a => a.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (match) return match.cartera;
    const firstTransfer = transfers.find(t => 
      t.fromAdvisorName.trim().toLowerCase() === name.trim().toLowerCase() ||
      t.toAdvisorName.trim().toLowerCase() === name.trim().toLowerCase()
    );
    return firstTransfer ? firstTransfer.cartera : 'Sin Cartera';
  };

  // Safe days difference helper for average payment time
  const getDaysDiff = (date1Str: string, date2Str: string): number | null => {
    const d1 = parseToDate(date1Str);
    const d2 = parseToDate(date2Str);
    if (!d1 || !d2) return null;
    const diffTime = d1.getTime() - d2.getTime();
    return Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
  };

  // 1. CARTERAS - MASTER FILTER OPTIONS (Pre Jurídico, Jurídico, Desocupados, etc)
  const carterasOptions = useMemo(() => {
    const set = new Set<string>(['Pre Jurídico', 'Jurídico', 'Desocupados']);
    transfers.forEach(t => {
      if (t.cartera) set.add(t.cartera.trim());
    });
    return Array.from(set).filter(Boolean).sort();
  }, [transfers]);

  // 2. SUPERVISORES Options: filtered by selected Cartera
  const supervisorsOptions = useMemo(() => {
    const set = new Set<string>();
    transfers.forEach(t => {
      if (filterCartera !== 'todos' && t.cartera !== filterCartera) return;
      if (t.supervisorName) set.add(t.supervisorName.trim());
    });
    return Array.from(set).filter(Boolean).sort();
  }, [transfers, filterCartera]);

  // 3. RESPONSABLES Options: filtered by Cartera and Supervisor
  const responsablesOptions = useMemo(() => {
    const set = new Set<string>();
    transfers.forEach(t => {
      if (filterCartera !== 'todos' && t.cartera !== filterCartera) return;
      if (filterSupervisor !== 'todos' && t.supervisorName !== filterSupervisor) return;
      if (t.toAdvisorName) set.add(t.toAdvisorName.trim());
    });
    return Array.from(set).filter(Boolean).sort();
  }, [transfers, filterCartera, filterSupervisor]);

  // 4. EMISORES Options: filtered by Cartera, Supervisor, and Responsable
  const emisoresOptions = useMemo(() => {
    const set = new Set<string>();
    transfers.forEach(t => {
      if (filterCartera !== 'todos' && t.cartera !== filterCartera) return;
      if (filterSupervisor !== 'todos' && t.supervisorName !== filterSupervisor) return;
      if (filterResponsable !== 'todos' && t.toAdvisorName !== filterResponsable) return;
      if (t.fromAdvisorName) set.add(t.fromAdvisorName.trim());
    });
    return Array.from(set).filter(Boolean).sort();
  }, [transfers, filterCartera, filterSupervisor, filterResponsable]);

  // 5. ASESORES Options (Filtrar Asesor): filtered by Cartera, Supervisor, Responsable, and Emisor
  const asesoresOptions = useMemo(() => {
    const set = new Set<string>();
    transfers.forEach(t => {
      if (filterCartera !== 'todos' && t.cartera !== filterCartera) return;
      if (filterSupervisor !== 'todos' && t.supervisorName !== filterSupervisor) return;
      if (filterResponsable !== 'todos' && t.toAdvisorName !== filterResponsable) return;
      if (filterEmisor !== 'todos' && t.fromAdvisorName !== filterEmisor) return;

      if (t.fromAdvisorName) set.add(t.fromAdvisorName.trim());
      if (t.toAdvisorName) set.add(t.toAdvisorName.trim());
    });
    return Array.from(set).filter(Boolean).sort();
  }, [transfers, filterCartera, filterSupervisor, filterResponsable, filterEmisor]);

  // Dynamic filter cascading validation to avoid orphaned selections
  useEffect(() => {
    if (filterSupervisor !== 'todos' && !supervisorsOptions.includes(filterSupervisor)) {
      setFilterSupervisor('todos');
    }
  }, [filterCartera, supervisorsOptions, filterSupervisor]);

  useEffect(() => {
    if (filterResponsable !== 'todos' && !responsablesOptions.includes(filterResponsable)) {
      setFilterResponsable('todos');
    }
  }, [filterSupervisor, responsablesOptions, filterResponsable]);

  useEffect(() => {
    if (filterEmisor !== 'todos' && !emisoresOptions.includes(filterEmisor)) {
      setFilterEmisor('todos');
    }
  }, [filterResponsable, emisoresOptions, filterEmisor]);

  useEffect(() => {
    if (filterAsesor !== 'todos' && !asesoresOptions.includes(filterAsesor)) {
      setFilterAsesor('todos');
    }
  }, [filterEmisor, asesoresOptions, filterAsesor]);

  // Combine into filterDropdownOptions object for backward compatibility with UI rendering
  const filterDropdownOptions = useMemo(() => {
    return {
      supervisors: supervisorsOptions,
      responsables: responsablesOptions,
      emisores: emisoresOptions,
      carteras: carterasOptions,
      asesores: asesoresOptions
    };
  }, [supervisorsOptions, responsablesOptions, emisoresOptions, carterasOptions, asesoresOptions]);

  // Filter actual items according to the active filters
  const filteredData = useMemo(() => {
    // 1. Filter CRM transfers
    const filteredCRM = transfers.filter(t => {
      // Date Filter (on t.createdAt)
      const dGen = parseToDate(formatGenerateDateString(t.createdAt));
      if (filterStartDate) {
        const start = new Date(filterStartDate + 'T00:00:00');
        if (!dGen || dGen < start) return false;
      }
      if (filterEndDate) {
        const end = new Date(filterEndDate + 'T23:59:59');
        if (!dGen || dGen > end) return false;
      }

      // Dropdowns
      if (filterSupervisor !== 'todos' && t.supervisorName !== filterSupervisor) return false;
      if (filterResponsable !== 'todos' && t.toAdvisorName !== filterResponsable) return false;
      if (filterEmisor !== 'todos' && t.fromAdvisorName !== filterEmisor) return false;
      if (filterCartera !== 'todos' && t.cartera !== filterCartera) return false;
      if (filterCanal !== 'todos' && t.canalGestion !== filterCanal) return false;
      if (filterAsesor !== 'todos' && t.fromAdvisorName !== filterAsesor && t.toAdvisorName !== filterAsesor) return false;

      return true;
    });

    // 2. Filter Reconciled Links
    const filteredReconciled = reconciledLinks.filter(item => {
      // Dropdown filters on metadata
      if (filterSupervisor !== 'todos' && item.supervisor !== filterSupervisor) return false;
      if (filterResponsable !== 'todos' && item.responsable !== filterResponsable) return false;
      if (filterEmisor !== 'todos' && item.emisor !== filterEmisor) return false;
      if (filterCartera !== 'todos' && item.cartera !== filterCartera) return false;
      if (filterCanal !== 'todos' && item.originalTransfer.canalGestion !== filterCanal) return false;
      if (filterAsesor !== 'todos' && item.emisor !== filterAsesor && item.responsable !== filterAsesor) return false;

      // Generación date filter (checked against filters)
      const dGen = parseToDate(item.fecha_generacion_link);
      if (filterStartDate) {
        const start = new Date(filterStartDate + 'T00:00:00');
        if (!dGen || dGen < start) return false;
      }
      if (filterEndDate) {
        const end = new Date(filterEndDate + 'T23:59:59');
        if (!dGen || dGen > end) return false;
      }

      return true;
    });

    return {
      crm: filteredCRM,
      reconciled: filteredReconciled
    };
  }, [transfers, reconciledLinks, filterStartDate, filterEndDate, filterSupervisor, filterResponsable, filterEmisor, filterCartera, filterCanal, filterAsesor]);

  // Main metrics computation
  const metrics = useMemo(() => {
    const totalCasos = filteredData.crm.length;
    
    // Casos por Canal
    let llamadas = 0;
    let whatsapp = 0;
    filteredData.crm.forEach(t => {
      const canal = String(t.canalGestion || '').toLowerCase().trim();
      if (canal.includes('whatsapp')) {
        whatsapp++;
      } else {
        llamadas++; // Default is Llamada as per specification
      }
    });

    const llamadasPct = totalCasos > 0 ? Math.round((llamadas / totalCasos) * 100) : 0;
    const whatsappPct = totalCasos > 0 ? Math.round((whatsapp / totalCasos) * 100) : 0;

    // Toma de mensajes (tipo mensaje or observations)
    const tomaMensajes = filteredData.crm.filter(t => 
      t.type === 'mensaje' || 
      t.managementType === 'Mensaje (Transferencia de llamada)' ||
      String(t.observations || '').toLowerCase().includes('toma de mensaje')
    ).length;

    // Links KPI (CRM where type = 'regalo')
    const linksCRM = filteredData.reconciled;
    const linksGenerados = linksCRM.length;
    const valorRegistradoCRM = linksCRM.reduce((sum, item) => sum + (item.valor_link_crm || 0), 0);
    
    let linksPagados = 0;
    let linksPendientes = 0;
    let linksAnulados = 0;

    linksCRM.forEach(item => {
      if (item.estadoCRM === 'PAGADO') {
        linksPagados++;
      } else if (item.estadoCRM === 'NO PAGADO') {
        linksAnulados++;
      } else {
        linksPendientes++;
      }
    });

    // RECAUDO EFECTIVO (EXCLUSIVAMENTE DESDE CONCILIACIÓN CON ESTADO RECIBO = RECIBO Y TIPO RECAUDO = S)
    // Filtered by the selected period (checked in filteredData.reconciled)
    const recaudoEfectivo = linksCRM.reduce((sum, item) => {
      if (item.estadoCRM === 'PAGADO' && String(item.tipo_recaudo || '').trim().toUpperCase() === 'S') {
        return sum + (item.valor_liquidacion || 0);
      }
      return sum;
    }, 0);

    const conversionPago = valorRegistradoCRM > 0 ? Number(((recaudoEfectivo / valorRegistradoCRM) * 100).toFixed(1)) : 0;

    // Apoyos computations
    let brindaronApoyoSet = new Set<string>();
    let recibieronApoyoSet = new Set<string>();
    let casosApoyados = 0;

    filteredData.crm.forEach(t => {
      const emisorEmail = (t.fromAdvisorEmail || '').toLowerCase().trim();
      const responsableEmail = (t.toAdvisorEmail || '').toLowerCase().trim();
      const emisorName = t.fromAdvisorName;
      const responsableName = t.toAdvisorName;

      if (
        emisorEmail && 
        responsableEmail && 
        emisorEmail !== responsableEmail && 
        emisorEmail !== 'lidercartera2@ngsoabogados.com' && 
        responsableEmail !== 'lidercartera2@ngsoabogados.com'
      ) {
        casosApoyados++;
        brindaronApoyoSet.add(emisorName);
        recibieronApoyoSet.add(responsableName);
      }
    });

    const activeSet = new Set<string>();
    filteredData.crm.forEach(t => { if (t.fromAdvisorEmail) activeSet.add(t.fromAdvisorEmail.toLowerCase().trim()); });
    filteredData.reconciled.forEach(item => { if (item.originalTransfer.fromAdvisorEmail) activeSet.add(item.originalTransfer.fromAdvisorEmail.toLowerCase().trim()); });
    const activeAdvisorsCount = Math.max(1, activeSet.size);

    const ticketPromedio = linksPagados > 0 ? Math.round(recaudoEfectivo / linksPagados) : 0;
    const promedioPorAsesor = Math.round(recaudoEfectivo / activeAdvisorsCount);
    const clientesContactados = new Set(filteredData.crm.map(t => (t.customerName || '').trim().toLowerCase())).size;

    return {
      totalCasos,
      llamadas,
      whatsapp,
      llamadasPct,
      whatsappPct,
      tomaMensajes,
      linksGenerados,
      linksPagados,
      linksPendientes,
      linksAnulados,
      conversionPago,
      valorRegistradoCRM,
      recaudoEfectivo,
      casosApoyados,
      brindaronApoyo: brindaronApoyoSet.size,
      recibieronApoyo: recibieronApoyoSet.size,
      clientesContactados,
      ticketPromedio,
      promedioPorAsesor
    };
  }, [filteredData]);

  const toTitleCase = (str: string): string => {
    if (!str) return '';
    return str
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Rankings and Groupings data
  const groupings = useMemo(() => {
    // 1. Casos por Cartera
    const carteraMap: Record<string, number> = {};
    filteredData.crm.forEach(t => {
      const c = t.cartera || 'Sin Cartera';
      carteraMap[c] = (carteraMap[c] || 0) + 1;
    });
    const casosPorCartera = Object.entries(carteraMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // 2. Casos por Supervisor
    const supervisorMap: Record<string, number> = {};
    filteredData.crm.forEach(t => {
      const s = toTitleCase(t.supervisorName) || 'Sin Supervisor';
      supervisorMap[s] = (supervisorMap[s] || 0) + 1;
    });
    const casosPorSupervisor = Object.entries(supervisorMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // 3. Casos por Asesor (Emisor)
    const asesorMap: Record<string, number> = {};
    filteredData.crm.forEach(t => {
      const a = toTitleCase(t.fromAdvisorName) || 'Sin Asesor';
      asesorMap[a] = (asesorMap[a] || 0) + 1;
    });
    const casosPorAsesor = Object.entries(asesorMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // 4. TOP ASESORES (Grouped by institutional email to fully resolve advisor duplicates)
    const uniqueAdvisorEmails = new Set<string>();
    advisors.forEach(a => { if (a.email) uniqueAdvisorEmails.add(a.email.trim().toLowerCase()); });
    transfers.forEach(t => {
      if (t.fromAdvisorEmail) uniqueAdvisorEmails.add(t.fromAdvisorEmail.trim().toLowerCase());
      if (t.toAdvisorEmail) uniqueAdvisorEmails.add(t.toAdvisorEmail.trim().toLowerCase());
    });

    const topAsesores = Array.from(uniqueAdvisorEmails).map(email => {
      let rawName = '';
      let supervisorName = '';
      let supervisorEmail = '';
      let cartera = 'Sin Cartera';

      const matchFirestore = advisors.find(a => (a.email || '').trim().toLowerCase() === email);
      const matchTransferFrom = transfers.find(t => (t.fromAdvisorEmail || '').trim().toLowerCase() === email);
      const matchTransferTo = transfers.find(t => (t.toAdvisorEmail || '').trim().toLowerCase() === email);

      if (matchFirestore) {
        rawName = matchFirestore.name;
        supervisorName = matchFirestore.supervisor || '';
        supervisorEmail = (matchFirestore.supervisorEmail || '').trim().toLowerCase();
        cartera = matchFirestore.cartera || 'Sin Cartera';
      } else if (matchTransferFrom) {
        rawName = matchTransferFrom.fromAdvisorName;
        supervisorName = matchTransferFrom.supervisorName || '';
        supervisorEmail = (matchTransferFrom.supervisorEmail || '').trim().toLowerCase();
        cartera = matchTransferFrom.cartera || 'Sin Cartera';
      } else if (matchTransferTo) {
        rawName = matchTransferTo.toAdvisorName;
        supervisorName = matchTransferTo.supervisorName || '';
        supervisorEmail = (matchTransferTo.supervisorEmail || '').trim().toLowerCase();
        cartera = matchTransferTo.cartera || 'Sin Cartera';
      }

      if (!rawName) {
        rawName = email.split('@')[0];
      }

      const name = toTitleCase(rawName);

      // Casos gestionados (as Emisor) in filtered CRM
      const crmAsEmisor = filteredData.crm.filter(t => (t.fromAdvisorEmail || '').trim().toLowerCase() === email);
      const casos = crmAsEmisor.length;

      // Reconciled links in filtered reconciled list
      const advisorLinks = filteredData.reconciled.filter(item => 
        (item.originalTransfer.fromAdvisorEmail || '').trim().toLowerCase() === email
      );
      
      const linksGen = advisorLinks.length;
      let linksPagados = 0;
      let linksPendientes = 0;
      let linksAnulados = 0;
      let valorGen = 0;
      let valorRec = 0;
      let totalDays = 0;
      let paidWithDate = 0;

      advisorLinks.forEach(item => {
        valorGen += (item.valor_link_crm || 0);
        if (item.estadoCRM === 'PAGADO') {
          linksPagados++;
          if (String(item.tipo_recaudo || '').trim().toUpperCase() === 'S') {
            valorRec += (item.valor_liquidacion || 0);
          }
          if (item.fecha_pago !== '-' && item.fecha_generacion_link !== '-') {
            const diff = getDaysDiff(item.fecha_pago, item.fecha_generacion_link);
            if (diff !== null) {
              totalDays += diff;
              paidWithDate++;
            }
          }
        } else if (item.estadoCRM === 'NO PAGADO') {
          linksAnulados++;
        } else {
          linksPendientes++;
        }
      });

      const conversion = valorGen > 0 ? Number(((valorRec / valorGen) * 100).toFixed(1)) : 0;
      const avgPaymentTime = paidWithDate > 0 ? Number((totalDays / paidWithDate).toFixed(1)) : 0;
      const ticketPromedio = linksPagados > 0 ? Math.round(valorRec / linksPagados) : 0;

      // Productivity indicator (0-100 score)
      const recaudoWeight = Math.min(50, (valorRec / 15000000) * 50);
      const conversionWeight = conversion * 0.5;
      const productivityScore = Math.round(recaudoWeight + conversionWeight);

      return {
        email,
        name,
        supervisor: toTitleCase(supervisorName) || 'Sin Supervisor',
        cartera,
        casos,
        linksGen,
        linksPagados,
        linksPendientes,
        linksAnulados,
        valorGen,
        valorRec,
        conversion,
        avgPaymentTime,
        ticketPromedio,
        productivityScore
      };
    }).filter(item => {
      if (filterCartera !== 'todos') {
        return item.cartera.trim().toLowerCase() === filterCartera.trim().toLowerCase();
      }
      return true;
    }).sort((a, b) => {
      if (advisorSortKey === 'casos') return b.casos - a.casos;
      if (advisorSortKey === 'linksGen') return b.linksGen - a.linksGen;
      if (advisorSortKey === 'linksPagados') return b.linksPagados - a.linksPagados;
      if (advisorSortKey === 'valorGen') return b.valorGen - a.valorGen;
      if (advisorSortKey === 'valorRec') return b.valorRec - a.valorRec;
      if (advisorSortKey === 'conversion') return b.conversion - a.conversion;
      if (advisorSortKey === 'tiempoPago') return b.avgPaymentTime - a.avgPaymentTime;
      return b.valorRec - a.valorRec; // Default: Recaudo
    });

    // 5. TOP SUPERVISORES (cases, links, collected, conversion)
    const rankingSupervisoresMap: Record<string, {
      name: string;
      casos: number;
      linksGen: number;
      linksPagados: number;
      valorGen: number;
      valorRec: number;
    }> = {};

    filteredData.crm.forEach(t => {
      const sup = toTitleCase(t.supervisorName) || 'Sin Supervisor';
      if (!rankingSupervisoresMap[sup]) {
        rankingSupervisoresMap[sup] = { name: sup, casos: 0, linksGen: 0, linksPagados: 0, valorGen: 0, valorRec: 0 };
      }
      rankingSupervisoresMap[sup].casos++;
    });

    filteredData.reconciled.forEach(item => {
      const sup = toTitleCase(item.supervisor) || 'Sin Supervisor';
      if (!rankingSupervisoresMap[sup]) {
        rankingSupervisoresMap[sup] = { name: sup, casos: 0, linksGen: 0, linksPagados: 0, valorGen: 0, valorRec: 0 };
      }
      const entry = rankingSupervisoresMap[sup];
      entry.linksGen++;
      entry.valorGen += (item.valor_link_crm || 0);
      if (item.estadoCRM === 'PAGADO') {
        entry.linksPagados++;
        if (String(item.tipo_recaudo || '').trim().toUpperCase() === 'S') {
          entry.valorRec += (item.valor_liquidacion || 0);
        }
      }
    });

    const topSupervisores = Object.values(rankingSupervisoresMap)
      .map(entry => {
        const conversion = entry.valorGen > 0 ? Number(((entry.valorRec / entry.valorGen) * 100).toFixed(1)) : 0;
        return { ...entry, conversion };
      })
      .sort((a, b) => b.valorRec - a.valorRec || b.casos - a.casos);

    // 6. TOP CARTERAS (cases, links, collected, conversion)
    const rankingCarterasMap: Record<string, {
      name: string;
      casos: number;
      linksGen: number;
      linksPagados: number;
      valorGen: number;
      valorRec: number;
    }> = {};

    filteredData.crm.forEach(t => {
      const cart = t.cartera || 'Sin Cartera';
      if (!rankingCarterasMap[cart]) {
        rankingCarterasMap[cart] = { name: cart, casos: 0, linksGen: 0, linksPagados: 0, valorGen: 0, valorRec: 0 };
      }
      rankingCarterasMap[cart].casos++;
    });

    filteredData.reconciled.forEach(item => {
      const cart = item.cartera || 'Sin Cartera';
      if (!rankingCarterasMap[cart]) {
        rankingCarterasMap[cart] = { name: cart, casos: 0, linksGen: 0, linksPagados: 0, valorGen: 0, valorRec: 0 };
      }
      const entry = rankingCarterasMap[cart];
      entry.linksGen++;
      entry.valorGen += (item.valor_link_crm || 0);
      if (item.estadoCRM === 'PAGADO') {
        entry.linksPagados++;
        if (String(item.tipo_recaudo || '').trim().toUpperCase() === 'S') {
          entry.valorRec += (item.valor_liquidacion || 0);
        }
      }
    });

    const topCarteras = Object.values(rankingCarterasMap)
      .map(entry => {
        const conversion = entry.valorGen > 0 ? Number(((entry.valorRec / entry.valorGen) * 100).toFixed(1)) : 0;
        return { ...entry, conversion };
      })
      .sort((a, b) => b.valorRec - a.valorRec || b.casos - a.casos);

    // 7. TOP RESPONSABLES (Responsable, Casos, Links, Recaudo, Conversión)
    const rankingResponsablesMap: Record<string, {
      name: string;
      casos: number;
      linksGen: number;
      linksPagados: number;
      valorGen: number;
      valorRec: number;
    }> = {};

    filteredData.crm.forEach(t => {
      const resp = toTitleCase(t.toAdvisorName) || 'Sin Responsable';
      if (!rankingResponsablesMap[resp]) {
        rankingResponsablesMap[resp] = { name: resp, casos: 0, linksGen: 0, linksPagados: 0, valorGen: 0, valorRec: 0 };
      }
      rankingResponsablesMap[resp].casos++;
    });

    filteredData.reconciled.forEach(item => {
      const resp = toTitleCase(item.responsable) || 'Sin Responsable';
      if (!rankingResponsablesMap[resp]) {
        rankingResponsablesMap[resp] = { name: resp, casos: 0, linksGen: 0, linksPagados: 0, valorGen: 0, valorRec: 0 };
      }
      const entry = rankingResponsablesMap[resp];
      entry.linksGen++;
      entry.valorGen += (item.valor_link_crm || 0);
      if (item.estadoCRM === 'PAGADO') {
        entry.linksPagados++;
        if (String(item.tipo_recaudo || '').trim().toUpperCase() === 'S') {
          entry.valorRec += (item.valor_liquidacion || 0);
        }
      }
    });

    const topResponsables = Object.values(rankingResponsablesMap)
      .map(entry => {
        const conversion = entry.valorGen > 0 ? Number(((entry.valorRec / entry.valorGen) * 100).toFixed(1)) : 0;
        return { ...entry, conversion };
      })
      .sort((a, b) => b.valorRec - a.valorRec || b.casos - a.casos);

    // 8. TOP EMISORES (Emisor, Links generados, Valor generado, Valor recaudado, Conversión)
    const rankingEmisoresMap: Record<string, {
      name: string;
      linksGen: number;
      linksPagados: number;
      valorGen: number;
      valorRec: number;
    }> = {};

    filteredData.reconciled.forEach(item => {
      const emisor = toTitleCase(item.emisor) || 'Sin Emisor';
      if (!rankingEmisoresMap[emisor]) {
        rankingEmisoresMap[emisor] = { name: emisor, linksGen: 0, linksPagados: 0, valorGen: 0, valorRec: 0 };
      }
      const entry = rankingEmisoresMap[emisor];
      entry.linksGen++;
      entry.valorGen += (item.valor_link_crm || 0);
      if (item.estadoCRM === 'PAGADO') {
        entry.linksPagados++;
        if (String(item.tipo_recaudo || '').trim().toUpperCase() === 'S') {
          entry.valorRec += (item.valor_liquidacion || 0);
        }
      }
    });

    const topEmisores = Object.values(rankingEmisoresMap)
      .map(entry => {
        const conversion = entry.valorGen > 0 ? Number(((entry.valorRec / entry.valorGen) * 100).toFixed(1)) : 0;
        return { ...entry, conversion };
      })
      .sort((a, b) => b.valorRec - a.valorRec || b.valorGen - a.valorGen);

    // 9. REPORTE UNIFICADO DE APOYOS Y TRANSFERENCIAS POR ASESOR
    const apoyosYTransfersMap = new Map<string, {
      name: string;
      email: string;
      apoyosBrindados: number;
      apoyosRecibidos: number;
      transfersEnviadas: number;
      transfersRecibidas: number;
    }>();

    const addAdvisorToApoyos = (advName: string, advEmail: string) => {
      const cleanEmail = (advEmail || '').trim().toLowerCase();
      if (!cleanEmail) return;
      if (!apoyosYTransfersMap.has(cleanEmail)) {
        apoyosYTransfersMap.set(cleanEmail, {
          name: toTitleCase(advName || cleanEmail.split('@')[0]),
          email: cleanEmail,
          apoyosBrindados: 0,
          apoyosRecibidos: 0,
          transfersEnviadas: 0,
          transfersRecibidas: 0
        });
      }
    };

    filteredData.crm.forEach(t => {
      const emisorEmail = (t.fromAdvisorEmail || '').trim().toLowerCase();
      const receptorEmail = (t.toAdvisorEmail || '').trim().toLowerCase();
      const emisorName = t.fromAdvisorName;
      const receptorName = t.toAdvisorName;

      if (emisorEmail) addAdvisorToApoyos(emisorName, emisorEmail);
      if (receptorEmail) addAdvisorToApoyos(receptorName, receptorEmail);

      if (emisorEmail && receptorEmail && emisorEmail !== receptorEmail) {
        if (apoyosYTransfersMap.has(emisorEmail)) {
          apoyosYTransfersMap.get(emisorEmail)!.transfersEnviadas++;
        }
        if (apoyosYTransfersMap.has(receptorEmail)) {
          apoyosYTransfersMap.get(receptorEmail)!.transfersRecibidas++;
        }

        if (emisorEmail !== 'lidercartera2@ngsoabogados.com' && receptorEmail !== 'lidercartera2@ngsoabogados.com') {
          if (apoyosYTransfersMap.has(emisorEmail)) {
            apoyosYTransfersMap.get(emisorEmail)!.apoyosBrindados++;
          }
          if (apoyosYTransfersMap.has(receptorEmail)) {
            apoyosYTransfersMap.get(receptorEmail)!.apoyosRecibidos++;
          }
        }
      }
    });

    const topApoyosYTransfers = Array.from(apoyosYTransfersMap.values()).sort(
      (a, b) => (b.apoyosBrindados + b.transfersEnviadas) - (a.apoyosBrindados + a.transfersEnviadas)
    );

    // Keeping backward compatible legacy maps to avoid breaking details list
    const apoyosMap: Record<string, {
      brinda: string;
      recibe: string;
      casos: number;
      linksGen: number;
      valorRec: number;
    }> = {};

    filteredData.crm.forEach(t => {
      const emisor = toTitleCase(t.fromAdvisorName);
      const receptor = toTitleCase(t.toAdvisorName);
      const emisorEmail = (t.fromAdvisorEmail || '').toLowerCase().trim();
      const receptorEmail = (t.toAdvisorEmail || '').toLowerCase().trim();

      if (
        emisorEmail && 
        receptorEmail && 
        emisorEmail !== receptorEmail && 
        emisorEmail !== 'lidercartera2@ngsoabogados.com' && 
        receptorEmail !== 'lidercartera2@ngsoabogados.com'
      ) {
        const key = `${emisor} -> ${receptor}`;
        if (!apoyosMap[key]) {
          apoyosMap[key] = { brinda: emisor, recibe: receptor, casos: 0, linksGen: 0, valorRec: 0 };
        }
        apoyosMap[key].casos++;
      }
    });

    filteredData.reconciled.forEach(item => {
      const emisor = toTitleCase(item.emisor);
      const receptor = toTitleCase(item.responsable);
      const emisorEmail = (item.originalTransfer.fromAdvisorEmail || '').toLowerCase().trim();
      const receptorEmail = (item.originalTransfer.toAdvisorEmail || '').toLowerCase().trim();

      if (
        emisorEmail && 
        receptorEmail && 
        emisorEmail !== receptorEmail && 
        emisorEmail !== 'lidercartera2@ngsoabogados.com' && 
        receptorEmail !== 'lidercartera2@ngsoabogados.com'
      ) {
        const key = `${emisor} -> ${receptor}`;
        if (apoyosMap[key]) {
          apoyosMap[key].linksGen++;
          if (item.estadoCRM === 'PAGADO' && String(item.tipo_recaudo || '').trim().toUpperCase() === 'S') {
            apoyosMap[key].valorRec += (item.valor_liquidacion || 0);
          }
        }
      }
    });

    const topApoyos = Object.values(apoyosMap).sort((a, b) => b.casos - a.casos);

    const transferenciasMap: Record<string, {
      name: string;
      enviadas: number;
      recibidas: number;
    }> = {};

    filteredData.crm.forEach(t => {
      const emisor = toTitleCase(t.fromAdvisorName);
      const receptor = toTitleCase(t.toAdvisorName);
      if (emisor && receptor && emisor.trim().toLowerCase() !== receptor.trim().toLowerCase()) {
        if (!transferenciasMap[emisor]) transferenciasMap[emisor] = { name: emisor, enviadas: 0, recibidas: 0 };
        if (!transferenciasMap[receptor]) transferenciasMap[receptor] = { name: receptor, enviadas: 0, recibidas: 0 };
        transferenciasMap[emisor].enviadas++;
        transferenciasMap[receptor].recibidas++;
      }
    });

    const transferenciasList = Object.values(transferenciasMap);
    let topTransferer = { name: '-', count: 0 };
    let topReceiver = { name: '-', count: 0 };

    transferenciasList.forEach(item => {
      if (item.enviadas > topTransferer.count) {
        topTransferer = { name: item.name, count: item.enviadas };
      }
      if (item.recibidas > topReceiver.count) {
        topReceiver = { name: item.name, count: item.recibidas };
      }
    });

    const topTransferencias = {
      list: transferenciasList.sort((a, b) => (b.enviadas + b.recibidas) - (a.enviadas + a.recibidas)),
      topTransferer,
      topReceiver
    };

    return {
      casosPorCartera,
      casosPorSupervisor,
      casosPorAsesor,
      topAsesores,
      topSupervisores,
      topCarteras,
      topResponsables,
      topEmisores,
      topApoyos,
      topTransferencias,
      topApoyosYTransfers
    };
  }, [filteredData, advisorSortKey, advisors, filterCartera, transfers]);

  // Daily trends for recharts (dynamic timelines)
  const trendsData = useMemo(() => {
    const daysMap: Record<string, {
      date: string;
      casos: number;
      links: number;
      recaudo: number;
      linksPagados: number;
      valorGen: number;
    }> = {};

    // Base date list from selection range to make sure chart is contiguous
    if (filterStartDate && filterEndDate) {
      const start = new Date(filterStartDate + 'T00:00:00');
      const end = new Date(filterEndDate + 'T23:59:59');
      let curr = new Date(start);
      while (curr <= end) {
        const dateStr = curr.toISOString().split('T')[0];
        daysMap[dateStr] = { date: dateStr, casos: 0, links: 0, recaudo: 0, linksPagados: 0, valorGen: 0 };
        curr.setDate(curr.getDate() + 1);
      }
    }

    // Populate Cases
    filteredData.crm.forEach(t => {
      const dateStr = formatGenerateDateString(t.createdAt);
      if (dateStr !== '-' && daysMap[dateStr]) {
        daysMap[dateStr].casos++;
      } else if (dateStr !== '-') {
        daysMap[dateStr] = { date: dateStr, casos: 1, links: 0, recaudo: 0, linksPagados: 0, valorGen: 0 };
      }
    });

    // Populate Links & Recaudo
    filteredData.reconciled.forEach(item => {
      const genDateStr = item.fecha_generacion_link;
      const pagoDateStr = item.fecha_pago;

      // Add as link generated on generation date
      if (genDateStr !== '-' && daysMap[genDateStr]) {
        daysMap[genDateStr].links++;
        daysMap[genDateStr].valorGen += (item.valor_link_crm || 0);
        if (item.estadoCRM === 'PAGADO') {
          daysMap[genDateStr].linksPagados++;
        }
      }

      // Add as recaudo on payment date
      if (pagoDateStr !== '-' && item.estadoCRM === 'PAGADO' && String(item.tipo_recaudo || '').trim().toUpperCase() === 'S') {
        if (daysMap[pagoDateStr]) {
          daysMap[pagoDateStr].recaudo += (item.valor_liquidacion || 0);
        } else {
          daysMap[pagoDateStr] = { date: pagoDateStr, casos: 0, links: 0, recaudo: item.valor_liquidacion, linksPagados: 0, valorGen: 0 };
        }
      }
    });

    return Object.values(daysMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(day => {
        const conversion = day.valorGen > 0 ? Number(((day.recaudo / day.valorGen) * 100).toFixed(1)) : 0;
        // Format date beautifully for charts (e.g. DD/MM)
        const parts = day.date.split('-');
        const shortDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : day.date;
        return {
          ...day,
          shortDate,
          conversion
        };
      });
  }, [filteredData, filterStartDate, filterEndDate]);

  // Pre-defined ranges
  const handleRangeSelect = (rangeType: 'month' | 'last30' | 'year' | 'all') => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    if (rangeType === 'month') {
      setFilterStartDate(`${year}-${month}-01`);
      setFilterEndDate(`${year}-${month}-${day}`);
    } else if (rangeType === 'last30') {
      const prior = new Date();
      prior.setDate(now.getDate() - 30);
      const py = prior.getFullYear();
      const pm = String(prior.getMonth() + 1).padStart(2, '0');
      const pd = String(prior.getDate()).padStart(2, '0');
      setFilterStartDate(`${py}-${pm}-${pd}`);
      setFilterEndDate(`${year}-${month}-${day}`);
    } else if (rangeType === 'year') {
      setFilterStartDate(`${year}-01-01`);
      setFilterEndDate(`${year}-${month}-${day}`);
    } else if (rangeType === 'all') {
      setFilterStartDate('');
      setFilterEndDate('');
    }
    toast.success('Rango de fechas ajustado.');
  };

  // Reset Filters
  const handleResetAllFilters = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    setFilterStartDate(`${year}-${month}-01`);
    setFilterEndDate(`${year}-${month}-${String(now.getDate()).padStart(2, '0')}`);
    setFilterSupervisor('todos');
    setFilterResponsable('todos');
    setFilterEmisor('todos');
    setFilterCartera('todos');
    setFilterCanal('todos');
    setFilterAsesor('todos');
    toast.success('Filtros restaurados con éxito.');
  };

  // CSV Exporter
  const exportCSV = () => {
    const headers = [
      'Indicador', 'Valor', 'Descripción'
    ];
    const kpis = [
      ['Total Casos Gestionados', metrics.totalCasos, 'Gestiones totales registradas en el período'],
      ['Casos en Llamada', metrics.llamadas, `${metrics.llamadasPct}% del total`],
      ['Casos en WhatsApp', metrics.whatsapp, `${metrics.whatsappPct}% del total`],
      ['Gestiones de Toma de Mensaje', metrics.tomaMensajes, 'Toma de mensaje efectuada'],
      ['Links Generados', metrics.linksGenerados, 'Total enlaces generados'],
      ['Links Pagados', metrics.linksPagados, 'Total enlaces conciliados como RECIBO'],
      ['Links Pendientes', metrics.linksPendientes, 'Total enlaces en estado LIQUIDACION'],
      ['Links Anulados', metrics.linksAnulados, 'Total enlaces en estado ANULADO'],
      ['Conversión de Pago', `${metrics.conversionPago}%`, 'Porcentaje de conversión'],
      ['Valor Registrado CRM', `$${metrics.valorRegistradoCRM.toLocaleString('es-CO')}`, 'Monto total en links creados'],
      ['Recaudo Efectivo', `$${metrics.recaudoEfectivo.toLocaleString('es-CO')}`, 'Monto real cobrado conciliado tipo S'],
      ['Casos de Apoyo', metrics.casosApoyados, 'Gestiones cruzadas entre asesores'],
      ['Asesores brindaron apoyo', brindaronApoyoCount(), 'Asesores emisores de apoyo'],
      ['Asesores recibieron apoyo', recibieronApoyoCount(), 'Asesores receptores de apoyo']
    ];

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...kpis.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_Ejecutivo_${filterStartDate || 'historico'}_a_${filterEndDate || 'hoy'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV descargado correctamente.');
  };

  // Excel Exporter with multiple sheets
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // 0. Metadata, Filtros y Disclaimer
    const metadata = [
      { Campo: 'Reporte', Valor: 'Reporte Ejecutivo de Gestión y Recaudo' },
      { Campo: 'Período', Valor: `${filterStartDate || 'Inicio'} al ${filterEndDate || 'Hoy'}` },
      { Campo: 'Cartera', Valor: filterCartera !== 'todos' ? filterCartera : 'Todas las Carteras' },
      { Campo: 'Supervisor', Valor: filterSupervisor !== 'todos' ? toTitleCase(filterSupervisor) : 'Todos los Supervisores' },
      { Campo: 'Responsable', Valor: filterResponsable !== 'todos' ? toTitleCase(filterResponsable) : 'Todos los Responsables' },
      { Campo: 'Canal', Valor: filterCanal !== 'todos' ? filterCanal : 'Todos los Canales' },
      { Campo: 'Emisor', Valor: filterEmisor !== 'todos' ? toTitleCase(filterEmisor) : 'Todos los Emisores' },
      { Campo: 'Generado por', Valor: `${user.name} (${user.email})` },
      { Campo: 'Fecha de Generación', Valor: new Date().toLocaleString('es-CO') },
      { Campo: 'Nota Importante', Valor: 'Este reporte contiene únicamente información correspondiente a los filtros seleccionados.' }
    ];
    const wsMeta = XLSX.utils.json_to_sheet(metadata);
    XLSX.utils.book_append_sheet(wb, wsMeta, 'Filtros y Disclaimer');

    // 1. Resumen Ejecutivo
    const kpis = [
      { Indicador: 'Total Casos Gestionados', Cantidad: metrics.totalCasos, Detalle: 'Gestiones totales' },
      { Indicador: 'Gestiones por Llamada', Cantidad: metrics.llamadas, Detalle: `${metrics.llamadasPct}% del total` },
      { Indicador: 'Gestiones por WhatsApp', Cantidad: metrics.whatsapp, Detalle: `${metrics.whatsappPct}% del total` },
      { Indicador: 'Toma de Mensajes', Cantidad: metrics.tomaMensajes, Detalle: 'Toma de mensaje registrada' },
      { Indicador: 'Links Generados', Cantidad: metrics.linksGenerados, Detalle: 'Total enlaces de pago creados' },
      { Indicador: 'Links Pagados', Cantidad: metrics.linksPagados, Detalle: 'Conciliados estado RECIBO' },
      { Indicador: 'Links Pendientes', Cantidad: metrics.linksPendientes, Detalle: 'Estado LIQUIDACION' },
      { Indicador: 'Links Anulados', Cantidad: metrics.linksAnulados, Detalle: 'Estado ANULADO' },
      { Indicador: 'Conversión de Pago', Cantidad: `${metrics.conversionPago}%`, Detalle: 'Links Pagados / Links Generados' },
      { Indicador: 'Valor Registrado CRM', Cantidad: metrics.valorRegistradoCRM, Detalle: 'Pesos Colombianos ($)' },
      { Indicador: 'Recaudo Efectivo', Cantidad: metrics.recaudoEfectivo, Detalle: 'Pesos Colombianos ($) conciliados tipo S' },
      { Indicador: 'Casos Apoyados', Cantidad: metrics.casosApoyados, Detalle: 'Gestiones de apoyo entre asesores' }
    ];
    const wsKpi = XLSX.utils.json_to_sheet(kpis);
    XLSX.utils.book_append_sheet(wb, wsKpi, 'Resumen Ejecutivo');

    // 2. Top Asesores
    const wsAsesores = XLSX.utils.json_to_sheet(groupings.topAsesores.map((a, idx) => ({
      Ranking: idx + 1,
      Asesor: a.name,
      Correo: a.email,
      'Casos Gestionados': a.casos,
      'Links Generados': a.linksGen,
      'Links Pagados': a.linksPagados,
      'Valor Generado ($)': a.valorGen,
      'Valor Recaudado ($)': a.valorRec,
      'Conversión (%)': a.conversion,
      'Tiempo Promedio Pago (días)': a.avgPaymentTime
    })));
    XLSX.utils.book_append_sheet(wb, wsAsesores, 'Ranking Asesores');

    // 3. Top Supervisores
    const wsSupervisores = XLSX.utils.json_to_sheet(groupings.topSupervisores.map((s, idx) => ({
      Ranking: idx + 1,
      Supervisor: s.name,
      Casos: s.casos,
      Links: s.linksGen,
      'Valor Recaudado ($)': s.valorRec,
      'Conversión (%)': s.conversion
    })));
    XLSX.utils.book_append_sheet(wb, wsSupervisores, 'Ranking Supervisores');

    // 4. Top Carteras
    const wsCarteras = XLSX.utils.json_to_sheet(groupings.topCarteras.map((c, idx) => ({
      Ranking: idx + 1,
      Cartera: c.name,
      Casos: c.casos,
      Links: c.linksGen,
      'Valor Recaudado ($)': c.valorRec,
      'Conversión (%)': c.conversion
    })));
    XLSX.utils.book_append_sheet(wb, wsCarteras, 'Ranking Carteras');

    // 5. Top Responsables
    const wsResponsables = XLSX.utils.json_to_sheet(groupings.topResponsables.map((r, idx) => ({
      Ranking: idx + 1,
      Responsable: r.name,
      Casos: r.casos,
      'Links Generados': r.linksGen,
      'Valor Recaudado ($)': r.valorRec,
      'Conversión (%)': r.conversion
    })));
    XLSX.utils.book_append_sheet(wb, wsResponsables, 'Ranking Responsables');

    // 6. Top Emisores
    const wsEmisores = XLSX.utils.json_to_sheet(groupings.topEmisores.map((e, idx) => ({
      Ranking: idx + 1,
      Emisor: e.name,
      'Links Generados': e.linksGen,
      'Valor Generado ($)': e.valorGen,
      'Valor Recaudado ($)': e.valorRec,
      'Conversión (%)': e.conversion
    })));
    XLSX.utils.book_append_sheet(wb, wsEmisores, 'Ranking Emisores');

    // 7. Colaboración y Apoyos
    const wsApoyos = XLSX.utils.json_to_sheet(groupings.topApoyos.map((ap, idx) => ({
      Ranking: idx + 1,
      'Asesor Brindó Apoyo': ap.brinda,
      'Asesor Recibió Apoyo': ap.recibe,
      'Casos Apoyados': ap.casos,
      'Links Generados': ap.linksGen,
      'Recaudo Obtenido ($)': ap.valorRec
    })));
    XLSX.utils.book_append_sheet(wb, wsApoyos, 'Colaboración y Apoyos');

    // 8. Transferencias de Casos
    const wsTransferencias = XLSX.utils.json_to_sheet(groupings.topTransferencias.list.map((t, idx) => ({
      Ranking: idx + 1,
      Asesor: t.name,
      'Transferencias Enviadas': t.enviadas,
      'Transferencias Recibidas': t.recibidas,
      'Total Movimientos': t.enviadas + t.recibidas
    })));
    XLSX.utils.book_append_sheet(wb, wsTransferencias, 'Transferencias de Casos');

    XLSX.writeFile(wb, `Dashboard_Ejecutivo_Conciliacion_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Libro de Excel descargado con éxito.');
  };

  // PDF Exporter using jsPDF and jspdf-autotable
  const exportPDF = () => {
    const doc = new jsPDF();
    const primaryColor: [number, number, number] = [161, 22, 27]; // Seguros Bolivar Red

    // 🎨 CANVAS CHART RENDERING LIBRARY (HIGH RESOLUTION CLIENT-SIDE DRAWING)
    const createChartImage = (width: number, height: number, drawFn: (ctx: CanvasRenderingContext2D) => void): string => {
      const canvas = document.createElement('canvas');
      canvas.width = width * 2; // high-definition scale
      canvas.height = height * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      ctx.scale(2, 2);
      
      // Crisp white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      
      drawFn(ctx);
      return canvas.toDataURL('image/png');
    };

    // Chart Draw 1: Canal Donut Chart (Donut Chart)
    const drawDonutChart = (ctx: CanvasRenderingContext2D, width: number, height: number, data: { label: string; value: number; color: string }[]) => {
      const total = data.reduce((sum, d) => sum + d.value, 0);
      const centerX = width * 0.40;
      const centerY = height * 0.50;
      const radius = Math.min(width, height) * 0.36;
      
      if (total === 0) {
        ctx.fillStyle = '#6B7280';
        ctx.font = '13px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('No hay datos disponibles', width / 2, height / 2);
        return;
      }
      
      let startAngle = -Math.PI / 2;
      data.forEach((slice) => {
        if (slice.value === 0) return;
        const sliceAngle = (slice.value / total) * 2 * Math.PI;
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = slice.color;
        ctx.fill();
        
        startAngle += sliceAngle;
      });
      
      // Draw donut cutout hole
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.58, 0, 2 * Math.PI);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      
      // Legend column on the right
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      let legendY = height * 0.22;
      
      data.forEach((slice) => {
        const pct = total > 0 ? ((slice.value / total) * 100).toFixed(1) : '0';
        
        // Color block
        ctx.fillStyle = slice.color;
        ctx.fillRect(width * 0.68, legendY - 6, 12, 12);
        
        // Label
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 10px Arial';
        ctx.fillText(slice.label, width * 0.73, legendY);
        
        // Value & Percentage
        ctx.fillStyle = '#6B7280';
        ctx.font = '9px Arial';
        ctx.fillText(`${slice.value.toLocaleString('es-CO')} (${pct}%)`, width * 0.73, legendY + 13);
        
        legendY += 34;
      });
    };

    // Chart Draw 2: Links de Pago (Vertical Bar Chart)
    const drawVerticalBarChart = (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      data: { label: string; value: number; color: string }[]
    ) => {
      const chartHeight = height * 0.64;
      const chartWidth = width * 0.85;
      const startX = width * 0.10;
      const startY = height * 0.14;
      
      const maxVal = Math.max(...data.map(d => d.value), 1);
      
      // Axes and Grid lines
      ctx.strokeStyle = '#F3F4F6';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 4; i++) {
        const y = startY + chartHeight - (i / 4) * chartHeight;
        ctx.moveTo(startX, y);
        ctx.lineTo(startX + chartWidth, y);
        
        ctx.fillStyle = '#6B7280';
        ctx.font = '8px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(Math.round((i / 4) * maxVal).toLocaleString('es-CO'), startX - 8, y + 2.5);
      }
      ctx.stroke();
      
      const barSpacing = chartWidth / data.length;
      const barWidth = barSpacing * 0.46;
      
      data.forEach((item, idx) => {
        const barX = startX + idx * barSpacing + (barSpacing - barWidth) / 2;
        const barValHeight = (item.value / maxVal) * chartHeight;
        const barY = startY + chartHeight - barValHeight;
        
        // Draw vertical bar rectangle
        ctx.fillStyle = item.color;
        ctx.fillRect(barX, barY, barWidth, barValHeight);
        
        // Value displayed on top of bar
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(item.value.toLocaleString('es-CO'), barX + barWidth / 2, barY - 4);
        
        // Label displayed under bar
        ctx.fillStyle = '#374151';
        ctx.font = 'bold 8.5px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(item.label, barX + barWidth / 2, startY + chartHeight + 13);
      });
    };

    // Chart Draw 3: Conversión de Pago (Gauge / Progress Arc Chart)
    const drawGaugeChart = (ctx: CanvasRenderingContext2D, width: number, height: number, percent: number) => {
      const centerX = width * 0.50;
      const centerY = height * 0.65;
      const radius = Math.min(width, height) * 0.44;
      
      // Background base track (semi-circle)
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, Math.PI, 2 * Math.PI);
      ctx.lineWidth = radius * 0.22;
      ctx.strokeStyle = '#E5E7EB';
      ctx.stroke();
      
      // Dynamic color arc based on percent
      const activeAngle = Math.PI + (percent / 100) * Math.PI;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, Math.PI, activeAngle);
      ctx.lineWidth = radius * 0.22;
      
      const arcColor = percent >= 70 ? '#10B981' : percent >= 40 ? '#F59E0B' : '#A1161B';
      ctx.strokeStyle = arcColor;
      ctx.stroke();
      
      // Center percent big text
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${percent}%`, centerX, centerY - 4);
      
      // Little sublabel below percent
      ctx.fillStyle = '#4B5563';
      ctx.font = 'bold 9px Arial';
      ctx.fillText('EFECTIVIDAD COBRO', centerX, centerY + 14);
    };

    // Chart Draw 4: Tendencia del Recaudo (Precise Area Line Chart)
    const drawLineChart = (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      data: { shortDate: string; recaudo: number }[]
    ) => {
      const chartHeight = height * 0.65;
      const chartWidth = width * 0.86;
      const startX = width * 0.11;
      const startY = height * 0.12;
      
      if (data.length === 0) {
        ctx.fillStyle = '#6B7280';
        ctx.font = '13px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('No hay datos de recaudos para representar', width / 2, height / 2);
        return;
      }
      
      const maxVal = Math.max(...data.map(d => d.recaudo), 100000);
      
      // Gridlines and Y axis labeling
      ctx.strokeStyle = '#F3F4F6';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 4; i++) {
        const y = startY + chartHeight - (i / 4) * chartHeight;
        ctx.moveTo(startX, y);
        ctx.lineTo(startX + chartWidth, y);
        
        ctx.fillStyle = '#6B7280';
        ctx.font = '7.5px Arial';
        ctx.textAlign = 'right';
        
        const labelVal = Math.round((i / 4) * maxVal);
        let labelText = `$${(labelVal / 1000000).toFixed(1)}M`;
        if (maxVal < 1000000) {
          labelText = `$${Math.round(labelVal / 1000)}K`;
        }
        ctx.fillText(labelText, startX - 6, y + 2.5);
      }
      ctx.stroke();
      
      // Compute line points
      const points: { x: number; y: number }[] = [];
      const spacing = chartWidth / (data.length > 1 ? data.length - 1 : 1);
      
      data.forEach((item, idx) => {
        const ptX = startX + idx * spacing;
        const ptY = startY + chartHeight - (item.recaudo / maxVal) * chartHeight;
        points.push({ x: ptX, y: ptY });
      });
      
      // Draw colored background area gradient under the line
      if (points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, startY + chartHeight);
        points.forEach(pt => {
          ctx.lineTo(pt.x, pt.y);
        });
        ctx.lineTo(points[points.length - 1].x, startY + chartHeight);
        ctx.closePath();
        ctx.fillStyle = 'rgba(161, 22, 27, 0.08)'; // Light red tint area
        ctx.fill();
      }
      
      // Draw connection line
      if (points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.strokeStyle = '#A1161B'; // Corporate Red
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }
      
      // Render dot markers and X dates labels
      const labelInterval = Math.max(1, Math.ceil(data.length / 14));
      
      points.forEach((pt, idx) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3, 0, 2 * Math.PI);
        ctx.fillStyle = '#A1161B';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1, 0, 2 * Math.PI);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        
        // Date labeling
        if (idx % labelInterval === 0) {
          ctx.fillStyle = '#4B5563';
          ctx.font = '7px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(data[idx].shortDate, pt.x, startY + chartHeight + 12);
        }
      });
    };

    // Chart Draw 5: Horizontal Bar Chart (Ranking / Categories)
    const drawHorizontalBarChart = (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      data: { label: string; value: number; color: string }[]
    ) => {
      const chartHeight = height * 0.74;
      const chartWidth = width * 0.63;
      const startX = width * 0.25;
      const startY = height * 0.12;
      
      if (data.length === 0) {
        ctx.fillStyle = '#6B7280';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Sin datos registrados para mostrar', width / 2, height / 2);
        return;
      }
      
      const maxVal = Math.max(...data.map(d => d.value), 1);
      const rowSpacing = chartHeight / data.length;
      const barHeight = rowSpacing * 0.52;
      
      data.forEach((item, idx) => {
        const rowY = startY + idx * rowSpacing + (rowSpacing - barHeight) / 2;
        const barValWidth = (item.value / maxVal) * chartWidth;
        
        // Horizontal bar
        ctx.fillStyle = item.color;
        ctx.fillRect(startX, rowY, barValWidth, barHeight);
        
        // Name on left
        ctx.fillStyle = '#1F2937';
        ctx.font = 'bold 8.5px Arial';
        ctx.textAlign = 'right';
        const truncatedLabel = item.label.length > 20 ? item.label.substring(0, 18) + '..' : item.label;
        ctx.fillText(truncatedLabel, startX - 8, rowY + barHeight / 2 + 3);
        
        // Value representation on right
        ctx.fillStyle = '#374151';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'left';
        const formattedVal = item.value >= 1000 ? `$${Math.round(item.value).toLocaleString('es-CO')}` : String(item.value);
        ctx.fillText(formattedVal, startX + barValWidth + 5, rowY + barHeight / 2 + 3);
      });
    };

    // PAGE 1: PORTADA (COVER PAGE)
    // Fondo completamente blanco (por defecto en jsPDF)
    
    // Franja vertical azul oscuro en el lado izquierdo (15mm de ancho, todo el alto de la página)
    doc.setFillColor(21, 49, 87);
    doc.rect(0, 0, 15, 297, 'F');

    // Encabezado
    doc.setTextColor(21, 49, 87);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('EL LIBERTADOR', 30, 35);

    // Título principal
    doc.setFontSize(26);
    doc.text('REPORTE EJECUTIVO', 30, 70);
    doc.text('DE GESTIÓN Y RECAUDO', 30, 81);

    // Línea horizontal roja delgada debajo del título
    doc.setDrawColor(161, 22, 27); // Rojo institucional
    doc.setLineWidth(0.8);
    doc.line(30, 88, 185, 88);

    // Información del reporte
    // PERÍODO ANALIZADO
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110); // Gris claro / medio elegante para etiquetas
    doc.text('PERÍODO ANALIZADO', 30, 105);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(21, 49, 87);
    doc.text(`${filterStartDate || '2026-07-01'} al ${filterEndDate || '2026-07-31'}`, 30, 111);

    // FECHA DE GENERACIÓN
    const pad = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    let hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const currentFormattedDate = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(hours)}:${pad(now.getMinutes())} ${ampm}`;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text('FECHA DE GENERACIÓN', 30, 123);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(21, 49, 87);
    doc.text(currentFormattedDate, 30, 129);

    // USUARIO GENERADOR
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text('USUARIO GENERADOR', 30, 141);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(21, 49, 87);
    doc.text('TALIANA MORENO GUZMAN', 30, 147);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(110, 110, 110);
    doc.text('taliana.moreno@segurosbolivar.com', 30, 153);

    // FILTROS APLICADOS
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text('FILTROS APLICADOS', 30, 165);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(21, 49, 87);

    const valCartera = filterCartera !== 'todos' ? filterCartera : 'Todas';
    const valSupervisor = filterSupervisor !== 'todos' ? toTitleCase(filterSupervisor) : 'Todos';
    const valResponsable = filterResponsable !== 'todos' ? toTitleCase(filterResponsable) : 'Todos';
    const valCanal = filterCanal !== 'todos' ? filterCanal : 'Todos';

    doc.text(`• Cartera: ${valCartera}`, 30, 172);
    doc.text(`• Supervisor: ${valSupervisor}`, 30, 178);
    doc.text(`• Responsable: ${valResponsable}`, 30, 184);
    doc.text(`• Canal: ${valCanal}`, 30, 190);

    // Nota inferior
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(130, 130, 130);
    const noteLines = doc.splitTextToSize(
      'Este documento contiene información confidencial y corresponde únicamente a los filtros seleccionados durante la generación del reporte.', 
      155
    );
    doc.text(noteLines, 30, 245);

    // Pie de página
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text('Sistema Ejecutivo de Gestión y Recaudo', 112.5, 275, { align: 'center' });
    doc.text('EL LIBERTADOR', 112.5, 281, { align: 'center' });

    // PAGE 2: RESUMEN EJECUTIVO (KPIs as a clean table)
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(21, 49, 87);
    doc.text('Resumen Ejecutivo', 15, 22);

    const kpisTableData = [
      ['Casos Gestionados', metrics.totalCasos.toLocaleString('es-CO')],
      ['Llamadas', metrics.llamadas.toLocaleString('es-CO')],
      ['WhatsApp', metrics.whatsapp.toLocaleString('es-CO')],
      ['Toma de Mensajes', metrics.tomaMensajes.toLocaleString('es-CO')],
      ['Links Generados', metrics.linksGenerados.toLocaleString('es-CO')],
      ['Links Pagados', metrics.linksPagados.toLocaleString('es-CO')],
      ['Links Pendientes', metrics.linksPendientes.toLocaleString('es-CO')],
      ['Links Anulados', metrics.linksAnulados.toLocaleString('es-CO')],
      ['Conversión', `${metrics.conversionPago}%`],
      ['Valor CRM', `$${Math.round(metrics.valorRegistradoCRM).toLocaleString('es-CO')}`],
      ['Recaudo Efectivo', `$${Math.round(metrics.recaudoEfectivo).toLocaleString('es-CO')}`],
      ['Apoyos entre Asesores', metrics.casosApoyados.toLocaleString('es-CO')]
    ];

    autoTable(doc, {
      startY: 30,
      head: [['Indicador', 'Valor']],
      body: kpisTableData,
      theme: 'striped',
      headStyles: { fillColor: [21, 49, 87] },
      styles: { fontSize: 9.5, cellPadding: 3, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 80, halign: 'right' }
      }
    });

    // PAGE 3: Gestión General
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(21, 49, 87);
    doc.text('Gestión General', 15, 22);

    // Donut chart de canales
    const canalSlices = [
      { label: 'Llamadas', value: metrics.llamadas, color: '#153157' },
      { label: 'WhatsApp', value: metrics.whatsapp, color: '#10B981' },
      { label: 'Mensajes', value: metrics.tomaMensajes, color: '#E5A93C' }
    ];
    const imgCanal = createChartImage(380, 220, (ctx) => {
      drawDonutChart(ctx, 380, 220, canalSlices);
    });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('Casos por Canal', 15, 33);
    if (imgCanal) doc.addImage(imgCanal, 'PNG', 15, 36, 85, 54);

    // Gauge de Conversión
    const imgGauge = createChartImage(380, 220, (ctx) => {
      drawGaugeChart(ctx, 380, 220, metrics.conversionPago);
    });

    doc.text('Conversión de Pago', 110, 33);
    if (imgGauge) doc.addImage(imgGauge, 'PNG', 110, 36, 85, 54);

    // Bar chart de conciliación
    const reconciliationBarData = [
      { label: 'Generados', value: metrics.linksGenerados, color: '#3B82F6' },
      { label: 'Pagados', value: metrics.linksPagados, color: '#10B981' },
      { label: 'Pendientes', value: metrics.linksPendientes, color: '#F59E0B' },
      { label: 'Anulados', value: metrics.linksAnulados, color: '#EF4444' }
    ];
    const imgReconciliation = createChartImage(760, 260, (ctx) => {
      drawVerticalBarChart(ctx, 760, 260, reconciliationBarData);
    });

    doc.text('Conciliación', 15, 104);
    if (imgReconciliation) doc.addImage(imgReconciliation, 'PNG', 15, 107, 180, 68);

    // PAGE 4: Recaudo Diario
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(21, 49, 87);
    doc.text('Recaudo Diario', 15, 22);

    const imgTrend = createChartImage(760, 320, (ctx) => {
      drawLineChart(ctx, 760, 320, trendsData);
    });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('Recaudo Diario', 15, 33);
    if (imgTrend) doc.addImage(imgTrend, 'PNG', 15, 37, 180, 80);

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(21, 49, 87);
    doc.text('Resumen Financiero', 15, 131);

    const recaudoKpiTable = [
      ['Total Recaudado', `$${Math.round(metrics.recaudoEfectivo).toLocaleString('es-CO')}`],
      ['Valor CRM', `$${Math.round(metrics.valorRegistradoCRM).toLocaleString('es-CO')}`],
      ['Conversión', `${metrics.conversionPago}%`],
      ['Ticket Promedio', `$${Math.round(metrics.ticketPromedio).toLocaleString('es-CO')}`]
    ];

    autoTable(doc, {
      startY: 136,
      head: [['Concepto', 'Monto']],
      body: recaudoKpiTable,
      theme: 'striped',
      headStyles: { fillColor: [21, 49, 87] },
      styles: { fontSize: 9, cellPadding: 3, fontStyle: 'bold' }
    });

    // PAGE 5: Ranking de Asesores
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(21, 49, 87);
    doc.text('Ranking de Asesores', 15, 22);

    const advisorBarData = groupings.topAsesores.slice(0, 10).map(a => ({
      label: a.name,
      value: a.valorRec,
      color: '#153157'
    }));
    const imgAdvisors = createChartImage(760, 320, (ctx) => {
      drawHorizontalBarChart(ctx, 760, 320, advisorBarData);
    });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('Top Asesores', 15, 33);
    if (imgAdvisors) doc.addImage(imgAdvisors, 'PNG', 15, 37, 180, 80);

    const rankingRowsToPrint = groupings.topAsesores.slice(0, 12);
    const tableAsesorRows = rankingRowsToPrint.map((a, index) => [
      String(index + 1),
      a.name,
      String(a.casos),
      String(a.linksGen),
      `$${Math.round(a.valorGen).toLocaleString('es-CO')}`,
      `$${Math.round(a.valorRec).toLocaleString('es-CO')}`,
      `${a.conversion}%`,
      `${a.avgPaymentTime}d`
    ]);

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(21, 49, 87);
    doc.text('Tabla Desglose de Desempeño Asesores', 15, 128);

    autoTable(doc, {
      startY: 133,
      head: [['#', 'Asesor Responsable', 'Casos', 'Links', 'Valor CRM', 'Valor Recaudado', 'Conv.', 'T.Pago']],
      body: tableAsesorRows,
      theme: 'striped',
      headStyles: { fillColor: [161, 22, 27] },
      styles: { fontSize: 8.5, cellPadding: 2 }
    });

    // PAGE 6: Supervisores
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(21, 49, 87);
    doc.text('Supervisores', 15, 22);

    const tableSupervisorRows = groupings.topSupervisores.map(s => [
      s.name,
      String(s.casos),
      String(s.linksGen),
      `$${Math.round(s.valorRec).toLocaleString('es-CO')}`,
      `${s.conversion}%`
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['Supervisor', 'Total Casos', 'Links Generados', 'Monto Recaudado', 'Conversión']],
      body: tableSupervisorRows,
      theme: 'striped',
      headStyles: { fillColor: [21, 49, 87] },
      styles: { fontSize: 8.5, cellPadding: 2.5 }
    });

    const nextYSup = (doc as any).lastAutoTable.finalY + 12;

    const supervisorBarData = groupings.topSupervisores.map(s => ({
      label: s.name,
      value: s.valorRec,
      color: '#A1161B'
    }));
    const imgSupervisors = createChartImage(760, 300, (ctx) => {
      drawHorizontalBarChart(ctx, 760, 300, supervisorBarData);
    });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('Recaudo por Supervisor', 15, nextYSup);
    if (imgSupervisors) doc.addImage(imgSupervisors, 'PNG', 15, nextYSup + 4, 180, 75);

    // PAGE 7: Carteras
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(21, 49, 87);
    doc.text('Carteras', 15, 22);

    const tableCarteraRows = groupings.topCarteras.map(c => [
      c.name,
      String(c.casos),
      String(c.linksGen),
      `$${Math.round(c.valorRec).toLocaleString('es-CO')}`,
      `${c.conversion}%`
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['Cartera', 'Total Casos', 'Links Generados', 'Monto Recaudado', 'Conversión']],
      body: tableCarteraRows,
      theme: 'striped',
      headStyles: { fillColor: [161, 22, 27] },
      styles: { fontSize: 8.5, cellPadding: 2.5 }
    });

    const nextYCarteras = (doc as any).lastAutoTable.finalY + 12;

    const carteraBarData = groupings.topCarteras.map(c => ({
      label: c.name,
      value: c.valorRec,
      color: '#153157'
    }));
    const imgCarteras = createChartImage(760, 300, (ctx) => {
      drawHorizontalBarChart(ctx, 760, 300, carteraBarData);
    });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('Recaudo por Cartera', 15, nextYCarteras);
    if (imgCarteras) doc.addImage(imgCarteras, 'PNG', 15, nextYCarteras + 4, 180, 75);

    // PAGE 8: Apoyos entre Asesores
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(21, 49, 87);
    doc.text('Apoyos entre Asesores', 15, 22);

    const totalApoyos = groupings.topApoyosYTransfers.reduce((acc, current) => acc + (current.apoyosBrindados || 0), 0);
    const tableApoyosRows = groupings.topApoyosYTransfers.slice(0, 12).map(a => {
      const participationPct = totalApoyos > 0 ? ((a.apoyosBrindados / totalApoyos) * 100).toFixed(1) : '0';
      return [
        a.name,
        String(a.apoyosBrindados),
        String(a.apoyosRecibidos),
        `${participationPct}%`
      ];
    });

    autoTable(doc, {
      startY: 30,
      head: [['Asesor Responsable', 'Apoyos Brindados (Realizados)', 'Casos Recibidos (Apoyado)', '% Participación Brindada']],
      body: tableApoyosRows,
      theme: 'striped',
      headStyles: { fillColor: [229, 169, 60] },
      styles: { fontSize: 8.5, cellPadding: 2.5 }
    });

    const nextYApoyos = (doc as any).lastAutoTable.finalY + 12;

    const apoyosBarData = groupings.topApoyosYTransfers.slice(0, 10).map(ap => ({
      label: ap.name,
      value: ap.apoyosBrindados,
      color: '#E5A93C'
    }));
    const imgApoyos = createChartImage(760, 300, (ctx) => {
      drawHorizontalBarChart(ctx, 760, 300, apoyosBarData);
    });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('Ranking de Apoyos', 15, nextYApoyos);
    if (imgApoyos) doc.addImage(imgApoyos, 'PNG', 15, nextYApoyos + 4, 180, 75);

    // PAGE 9: Transferencias
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(21, 49, 87);
    doc.text('Transferencias', 15, 22);

    const tableTransferRows = groupings.topTransferencias.list.slice(0, 12).map(t => [
      t.name,
      String(t.enviadas),
      String(t.recibidas),
      String(t.enviadas + t.recibidas)
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['Asesor Responsable', 'Transferencias Enviadas', 'Transferencias Recibidas', 'Total Movimientos']],
      body: tableTransferRows,
      theme: 'striped',
      headStyles: { fillColor: [21, 49, 87] },
      styles: { fontSize: 8.5, cellPadding: 2.5 }
    });

    const nextYTransf = (doc as any).lastAutoTable.finalY + 12;

    const transferBarData = groupings.topTransferencias.list.slice(0, 10).map(t => ({
      label: t.name,
      value: t.enviadas + t.recibidas,
      color: '#153157'
    }));
    const imgTransfers = createChartImage(760, 300, (ctx) => {
      drawHorizontalBarChart(ctx, 760, 300, transferBarData);
    });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('Movimientos de Casos', 15, nextYTransf);
    if (imgTransfers) doc.addImage(imgTransfers, 'PNG', 15, nextYTransf + 4, 180, 75);

    // PAGE 10: Resumen Financiero
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(21, 49, 87);
    doc.text('Resumen Financiero', 15, 22);

    const financialComparisonData = [
      { label: 'Valor Registrado CRM', value: metrics.valorRegistradoCRM, color: '#3B82F6' },
      { label: 'Recaudo Efectivo', value: metrics.recaudoEfectivo, color: '#10B981' }
    ];
    const imgFinancialCompare = createChartImage(760, 300, (ctx) => {
      drawVerticalBarChart(ctx, 760, 300, financialComparisonData);
    });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('CRM vs Recaudo', 15, 33);
    if (imgFinancialCompare) doc.addImage(imgFinancialCompare, 'PNG', 15, 37, 180, 85);

    // PAGE 11: Detalle de Links
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(21, 49, 87);
    doc.text('Detalle de Links', 15, 22);

    const detailedTableRows = filteredData.reconciled.slice(0, 100).map(item => [
      item.referencia_pago,
      item.fecha_generacion_link,
      item.emisor.length > 15 ? item.emisor.substring(0, 13) + '..' : item.emisor,
      item.responsable.length > 15 ? item.responsable.substring(0, 13) + '..' : item.responsable,
      item.cartera.length > 15 ? item.cartera.substring(0, 13) + '..' : item.cartera,
      `$${(item.valor_link_crm || 0).toLocaleString('es-CO')}`,
      `$${(item.valor_liquidacion || 0).toLocaleString('es-CO')}`,
      item.estadoCRM
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['Referencia', 'Generado', 'Emisor', 'Asesor', 'Cartera', 'Valor CRM', 'Recaudo', 'Resultado']],
      body: detailedTableRows,
      theme: 'striped',
      headStyles: { fillColor: [161, 22, 27] },
      styles: { fontSize: 7.5, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [248, 249, 250] }
    });

    // 🎓 AUTOMATED STAMP LOOP FOR PAGES HEADERS, FOOTERS & PAGE NUMBERS (EXCEPT COVER PAGE 1)
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      
      if (i === 1) continue; // Skip cover page
      
      // Top colored accent bar
      doc.setFillColor(161, 22, 27);
      doc.rect(0, 0, 210, 3, 'F');
      
      // Top running header
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 120);
      doc.text('Reporte Ejecutivo de Gestión y Recaudo', 15, 10);
      doc.text(new Date().toLocaleDateString('es-CO'), 195, 10, { align: 'right' });
      
      // Bottom running footer divider
      doc.setDrawColor(225, 225, 225);
      doc.setLineWidth(0.3);
      doc.line(15, 282, 195, 282);
      
      // Bottom running footer labels
      doc.text('CONFIDENCIAL • REPORTES GERENCIALES', 15, 288);
      doc.text(`Página ${i} de ${totalPages}`, 195, 288, { align: 'right' });
    }

    doc.save(`Reporte_Dashboard_Ejecutivo_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('Reporte en PDF generado y descargado.');
  };

  // Support count helpers
  function brindaronApoyoCount() {
    return metrics.brindaronApoyo;
  }

  function recibieronApoyoCount() {
    return metrics.recibieronApoyo;
  }

  // Support detail lists
  const apoyosDetails = useMemo(() => {
    const detailList: Array<{
      id: string;
      requestNumber: string;
      cliente: string;
      emisor: string;
      receptor: string;
      cartera: string;
      fecha: string;
    }> = [];

    filteredData.crm.forEach(t => {
      const emisorEmail = (t.fromAdvisorEmail || '').toLowerCase().trim();
      const responsableEmail = (t.toAdvisorEmail || '').toLowerCase().trim();

      if (
        emisorEmail && 
        responsableEmail && 
        emisorEmail !== responsableEmail && 
        emisorEmail !== 'lidercartera2@ngsoabogados.com' && 
        responsableEmail !== 'lidercartera2@ngsoabogados.com'
      ) {
        detailList.push({
          id: t.id || Math.random().toString(),
          requestNumber: t.requestNumber,
          cliente: t.customerName,
          emisor: t.fromAdvisorName,
          receptor: t.toAdvisorName,
          cartera: t.cartera || 'Sin Cartera',
          fecha: formatGenerateDateString(t.createdAt)
        });
      }
    });

    return detailList;
  }, [filteredData]);

  const getDynamicTitle = () => {
    let title = 'Dashboard Ejecutivo';
    const filtersUsed: string[] = [];
    
    if (filterCartera !== 'todos') {
      filtersUsed.push(`Cartera ${filterCartera}`);
    }
    if (filterSupervisor !== 'todos') {
      filtersUsed.push(`Supervisor ${toTitleCase(filterSupervisor)}`);
    }
    if (filterResponsable !== 'todos') {
      filtersUsed.push(`Responsable ${toTitleCase(filterResponsable)}`);
    }
    if (filterAsesor !== 'todos') {
      filtersUsed.push(`Asesor ${toTitleCase(filterAsesor)}`);
    }
    if (filterCanal !== 'todos') {
      filtersUsed.push(`Canal ${filterCanal}`);
    }
    if (filterEmisor !== 'todos') {
      filtersUsed.push(`Emisor ${toTitleCase(filterEmisor)}`);
    }
    
    if (filtersUsed.length > 0) {
      return `${title} – ${filtersUsed.join(' | ')}`;
    }
    return `${title} – Consolidado`;
  };

  return (
    <div className="space-y-6 pt-1 text-slate-800 dark:text-slate-150 text-left">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
            <span className="p-2.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl border border-rose-500/20 shadow-sm">
              <TrendingUp className="w-5.5 h-5.5" />
            </span>
            {getDynamicTitle()}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
            Módulo estratégico que consolida e indexa información operativa de CRM y de Seguimiento de Recaudo en tiempo real.
          </p>
        </div>

        {/* Action Export Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchFromSupabase}
            disabled={isLoadingDb}
            className="rounded-xl border-border/50 text-xs font-bold gap-1 bg-card hover:bg-muted"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDb ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportCSV}
            className="rounded-xl border-emerald-500/20 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 text-xs font-bold gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportExcel}
            className="rounded-xl border-teal-500/20 text-teal-600 dark:text-teal-400 bg-teal-500/5 hover:bg-teal-500/10 text-xs font-bold gap-1"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportPDF}
            className="rounded-xl border-rose-500/20 text-rose-600 dark:text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 text-xs font-bold gap-1"
          >
            <FileText className="w-3.5 h-3.5" />
            PDF Reporte
          </Button>
        </div>
      </div>

      {/* SUPABASE ERROR / WARNING BANNER */}
      {supabaseError && (
        <div className="p-4 rounded-[1.5rem] border border-amber-500/20 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold uppercase tracking-wider text-amber-900 dark:text-amber-100 mb-0.5">⚠️ Error de conexión con Supabase</p>
              <p className="text-amber-700 dark:text-amber-300">
                {supabaseError}. Los datos mostrados provienen de la caché local y podrían no estar actualizados. Si está en Google AI Studio, intente abrir la aplicación en una pestaña nueva o verifique las variables de entorno.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={fetchFromSupabase}
            disabled={isLoadingDb}
            className="rounded-lg border border-amber-500/30 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-100 font-bold px-3 py-1.5 shrink-0 self-end sm:self-center gap-1.5"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoadingDb ? 'animate-spin' : ''}`} /> Reintentar Conexión
          </Button>
        </div>
      )}

      {/* FILTER PANEL */}
      <Card className="border-none rounded-[1.8rem] card-shadow bg-card overflow-hidden">
        <CardHeader className="bg-muted/20 border-b border-border/10 py-4 px-6">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" />
            Filtros del Dashboard de Control (Recalculado automático)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            
            {/* Start Date */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-bold">Fecha Inicial</label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input 
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="w-full bg-muted/30 border border-transparent hover:border-border rounded-xl h-9 pl-8 pr-2.5 text-xs font-semibold focus:outline-none focus:border-primary transition-all"
                />
              </div>
            </div>

            {/* End Date */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-bold">Fecha Final</label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input 
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="w-full bg-muted/30 border border-transparent hover:border-border rounded-xl h-9 pl-8 pr-2.5 text-xs font-semibold focus:outline-none focus:border-primary transition-all"
                />
              </div>
            </div>

            {/* Supervisor Select */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-bold">Supervisor</label>
              <select
                value={filterSupervisor}
                onChange={(e) => setFilterSupervisor(e.target.value)}
                className="w-full bg-muted/30 border border-transparent hover:border-border rounded-xl h-9 px-3 text-xs font-semibold focus:outline-none focus:border-primary transition-all"
              >
                <option value="todos">Todos los Supervisores</option>
                {filterDropdownOptions.supervisors.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* Responsable Select */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-bold">Responsable</label>
              <select
                value={filterResponsable}
                onChange={(e) => setFilterResponsable(e.target.value)}
                className="w-full bg-muted/30 border border-transparent hover:border-border rounded-xl h-9 px-3 text-xs font-semibold focus:outline-none focus:border-primary transition-all"
              >
                <option value="todos">Todos los Responsables</option>
                {filterDropdownOptions.responsables.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* Emisor Select */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-bold">Emisor</label>
              <select
                value={filterEmisor}
                onChange={(e) => setFilterEmisor(e.target.value)}
                className="w-full bg-muted/30 border border-transparent hover:border-border rounded-xl h-9 px-3 text-xs font-semibold focus:outline-none focus:border-primary transition-all"
              >
                <option value="todos">Todos los Emisores</option>
                {filterDropdownOptions.emisores.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* Cartera Select */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-bold">Cartera</label>
              <select
                value={filterCartera}
                onChange={(e) => setFilterCartera(e.target.value)}
                className="w-full bg-muted/30 border border-transparent hover:border-border rounded-xl h-9 px-3 text-xs font-semibold focus:outline-none focus:border-primary transition-all"
              >
                <option value="todos">Todas las Carteras</option>
                {filterDropdownOptions.carteras.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* Canal Select */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-bold">Canal de Gestión</label>
              <select
                value={filterCanal}
                onChange={(e) => setFilterCanal(e.target.value)}
                className="w-full bg-muted/30 border border-transparent hover:border-border rounded-xl h-9 px-3 text-xs font-semibold focus:outline-none focus:border-primary transition-all"
              >
                <option value="todos">Todos los Canales</option>
                <option value="Llamada">Llamada</option>
                <option value="WhatsApp">WhatsApp</option>
              </select>
            </div>

            {/* General Asesor Select */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-bold">Filtrar Asesor</label>
              <select
                value={filterAsesor}
                onChange={(e) => setFilterAsesor(e.target.value)}
                className="w-full bg-muted/30 border border-transparent hover:border-border rounded-xl h-9 px-3 text-xs font-semibold focus:outline-none focus:border-primary transition-all"
              >
                <option value="todos">Cualquier Rol de Asesor</option>
                {filterDropdownOptions.asesores.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* Quick date buttons & Reset */}
            <div className="sm:col-span-2 md:col-span-4 lg:col-span-2 flex items-end gap-1.5">
              <Button 
                variant="ghost" 
                size="xs" 
                onClick={() => handleRangeSelect('month')} 
                className="rounded-lg h-9 bg-muted/40 hover:bg-muted font-bold text-[10px]"
              >
                Este Mes
              </Button>
              <Button 
                variant="ghost" 
                size="xs" 
                onClick={() => handleRangeSelect('last30')} 
                className="rounded-lg h-9 bg-muted/40 hover:bg-muted font-bold text-[10px]"
              >
                30 Días
              </Button>
              <Button 
                variant="ghost" 
                size="xs" 
                onClick={() => handleRangeSelect('year')} 
                className="rounded-lg h-9 bg-muted/40 hover:bg-muted font-bold text-[10px]"
              >
                Este Año
              </Button>
              <Button 
                variant="ghost" 
                size="xs" 
                onClick={() => handleRangeSelect('all')} 
                className="rounded-lg h-9 bg-muted/40 hover:bg-muted font-bold text-[10px]"
              >
                Todo
              </Button>
              <Button 
                variant="destructive" 
                size="xs" 
                onClick={handleResetAllFilters} 
                className="rounded-lg h-9 px-2 font-bold text-[10px]"
              >
                Restablecer
              </Button>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* KPI METRIC CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* CARD 1: CASOS GESTIONADOS */}
        <Card className="border-none rounded-[1.8rem] card-shadow bg-card relative overflow-hidden group hover:scale-[1.02] transition-all">
          <div className="absolute right-0 top-0 translate-x-6 -translate-y-6 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/15 transition-colors" />
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">Casos Gestionados</p>
                <h3 className="text-3xl font-black text-secondary mt-1 tracking-tight">
                  {metrics.totalCasos.toLocaleString()}
                </h3>
              </div>
              <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-500/20">
                <Briefcase className="w-5 h-5" />
              </div>
            </div>
            
            <div className="mt-4 pt-3 border-t border-border/50 flex justify-between items-center text-[10px] font-bold">
              <span className="text-muted-foreground">Mensajes</span>
              <Badge variant="outline" className="bg-muted text-secondary border-none font-black rounded-lg text-[10px]">
                {metrics.tomaMensajes} casos
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* CARD 2: CLIENTES CONTACTADOS */}
        <Card className="border-none rounded-[1.8rem] card-shadow bg-card relative overflow-hidden group hover:scale-[1.02] transition-all">
          <div className="absolute right-0 top-0 translate-x-6 -translate-y-6 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl group-hover:bg-sky-500/15 transition-colors" />
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">Clientes Contactados</p>
                <h3 className="text-3xl font-black text-secondary mt-1 tracking-tight">
                  {metrics.clientesContactados.toLocaleString()}
                </h3>
              </div>
              <div className="p-2.5 bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-xl border border-sky-500/20">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/50 flex justify-between items-center text-[10px] font-bold">
              <span className="text-muted-foreground">Canal Preferido</span>
              <span className="text-sky-600 dark:text-sky-400 font-extrabold">
                W: {metrics.whatsappPct}% | L: {metrics.llamadasPct}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* CARD 3: LINKS ENVIADOS */}
        <Card className="border-none rounded-[1.8rem] card-shadow bg-card relative overflow-hidden group hover:scale-[1.02] transition-all">
          <div className="absolute right-0 top-0 translate-x-6 -translate-y-6 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/15 transition-colors" />
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">Links Enviados</p>
                <h3 className="text-3xl font-black text-secondary mt-1 tracking-tight">
                  {metrics.linksGenerados.toLocaleString()}
                </h3>
              </div>
              <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-500/20">
                <Send className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/50 flex justify-between items-center text-[10px] font-bold">
              <span className="text-muted-foreground">Pendientes / Anulados</span>
              <span className="text-amber-600 dark:text-amber-400 font-extrabold font-mono">
                {metrics.linksPendientes} P | {metrics.linksAnulados} A
              </span>
            </div>
          </CardContent>
        </Card>

        {/* CARD 4: VALOR CRM NEGOCIADO */}
        <Card className="border-none rounded-[1.8rem] card-shadow bg-card relative overflow-hidden group hover:scale-[1.02] transition-all">
          <div className="absolute right-0 top-0 translate-x-6 -translate-y-6 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl group-hover:bg-yellow-500/15 transition-colors" />
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">Valor Negociado (CRM)</p>
                <h3 className="text-xl font-black text-secondary mt-1 tracking-tight font-mono">
                  ${Math.round(metrics.valorRegistradoCRM).toLocaleString('es-CO')}
                </h3>
              </div>
              <div className="p-2.5 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded-xl border border-yellow-500/20">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/50 flex justify-between items-center text-[10px] font-bold">
              <span className="text-muted-foreground">Monto Total Links</span>
              <span className="text-yellow-600 dark:text-yellow-400 font-mono font-extrabold">
                COP
              </span>
            </div>
          </CardContent>
        </Card>

        {/* CARD 5: VALOR RECAUDADO */}
        <Card className="border-none rounded-[1.8rem] card-shadow bg-card relative overflow-hidden group hover:scale-[1.02] transition-all border-l-4 border-emerald-500">
          <div className="absolute right-0 top-0 translate-x-6 -translate-y-6 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/15 transition-colors" />
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest font-mono">Valor Recaudado</p>
                <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tracking-tight font-mono">
                  ${Math.round(metrics.recaudoEfectivo).toLocaleString('es-CO')}
                </h3>
              </div>
              <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/50 flex justify-between items-center text-[10px] font-bold">
              <span className="text-muted-foreground">Enlaces Pagados</span>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-none font-black rounded-lg text-[10px]">
                {metrics.linksPagados} pagados
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* CARD 6: CONVERSIÓN DE PAGO */}
        <Card className="border-none rounded-[1.8rem] card-shadow bg-card relative overflow-hidden group hover:scale-[1.02] transition-all">
          <div className="absolute right-0 top-0 translate-x-6 -translate-y-6 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/15 transition-colors" />
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">Conversión de Pago</p>
                <h3 className="text-3xl font-black text-primary mt-1 tracking-tight">
                  {metrics.conversionPago}%
                </h3>
              </div>
              <div className="p-2.5 bg-rose-500/10 text-primary rounded-xl border border-rose-500/20">
                <Percent className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/50 space-y-1.5">
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div className="bg-primary h-full transition-all duration-1000" style={{ width: `${Math.min(metrics.conversionPago, 100)}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CARD 7: TICKET PROMEDIO */}
        <Card className="border-none rounded-[1.8rem] card-shadow bg-card relative overflow-hidden group hover:scale-[1.02] transition-all">
          <div className="absolute right-0 top-0 translate-x-6 -translate-y-6 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/15 transition-colors" />
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">Ticket Promedio</p>
                <h3 className="text-xl font-black text-secondary mt-1 tracking-tight font-mono">
                  ${Math.round(metrics.ticketPromedio).toLocaleString('es-CO')}
                </h3>
              </div>
              <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-500/20">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/50 flex justify-between items-center text-[10px] font-bold">
              <span className="text-muted-foreground">Monto Promedio Cobrado</span>
              <span className="text-blue-600 dark:text-blue-400 font-extrabold font-mono">
                RECIBO
              </span>
            </div>
          </CardContent>
        </Card>

        {/* CARD 8: PROMEDIO POR ASESOR */}
        <Card className="border-none rounded-[1.8rem] card-shadow bg-card relative overflow-hidden group hover:scale-[1.02] transition-all">
          <div className="absolute right-0 top-0 translate-x-6 -translate-y-6 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/15 transition-colors" />
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">Promedio por Asesor</p>
                <h3 className="text-xl font-black text-secondary mt-1 tracking-tight font-mono">
                  ${Math.round(metrics.promedioPorAsesor).toLocaleString('es-CO')}
                </h3>
              </div>
              <div className="p-2.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-500/20">
                <Award className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/50 flex justify-between items-center text-[10px] font-bold">
              <span className="text-muted-foreground">Productividad Promedio</span>
              <span className="text-purple-600 dark:text-purple-400 font-mono font-extrabold">
                COP
              </span>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* SUB-TABS INTERACTIVE PANEL */}
      <div className="space-y-6">
        
        {/* Navigation bar for subtabs */}
        <div className="flex border-b border-border/60 gap-4 overflow-x-auto pb-px">
          <button
            onClick={() => setActiveSubTab('operativos')}
            className={`pb-3 font-extrabold text-xs uppercase tracking-wider transition-all border-b-2 px-1 ${
              activeSubTab === 'operativos' 
                ? 'border-primary text-secondary' 
                : 'border-transparent text-muted-foreground hover:text-secondary'
            }`}
          >
            Operativos (CRM)
          </button>
          <button
            onClick={() => setActiveSubTab('links')}
            className={`pb-3 font-extrabold text-xs uppercase tracking-wider transition-all border-b-2 px-1 ${
              activeSubTab === 'links' 
                ? 'border-primary text-secondary' 
                : 'border-transparent text-muted-foreground hover:text-secondary'
            }`}
          >
            Enlaces & Rankings
          </button>
          <button
            onClick={() => setActiveSubTab('apoyos')}
            className={`pb-3 font-extrabold text-xs uppercase tracking-wider transition-all border-b-2 px-1 ${
              activeSubTab === 'apoyos' 
                ? 'border-primary text-secondary' 
                : 'border-transparent text-muted-foreground hover:text-secondary'
            }`}
          >
            Apoyos de Asesores
          </button>
          <button
            onClick={() => setActiveSubTab('graficas')}
            className={`pb-3 font-extrabold text-xs uppercase tracking-wider transition-all border-b-2 px-1 ${
              activeSubTab === 'graficas' 
                ? 'border-primary text-secondary' 
                : 'border-transparent text-muted-foreground hover:text-secondary'
            }`}
          >
            Gráficas de Tendencia
          </button>
          <button
            onClick={() => setActiveSubTab('embudo')}
            className={`pb-3 font-extrabold text-xs uppercase tracking-wider transition-all border-b-2 px-1 ${
              activeSubTab === 'embudo' 
                ? 'border-primary text-secondary' 
                : 'border-transparent text-muted-foreground hover:text-secondary'
            }`}
          >
            Embudo de Conversión
          </button>
        </div>

        {/* RENDERING SUBTABS CONTENT */}
        <AnimatePresence mode="wait">
          
          {/* TAB 1: OPERATIVOS */}
          {activeSubTab === 'operativos' && (
            <motion.div 
              key="operativos"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              
              {/* Canal y Cartera */}
              <div className="col-span-12 lg:col-span-6 space-y-6">
                
                {/* Canal Card */}
                <Card className="border-none rounded-[1.8rem] card-shadow bg-card">
                  <CardHeader className="py-4 border-b border-border/10">
                    <CardTitle className="text-sm font-extrabold uppercase tracking-wider text-secondary flex items-center gap-2">
                      <Phone className="w-4 h-4 text-primary" />
                      Casos por Canal de Gestión
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                      
                      {/* Pie chart with Cell values */}
                      <div className="w-40 h-40 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'Llamada', value: metrics.llamadas },
                                { name: 'WhatsApp', value: metrics.whatsapp }
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={60}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              <Cell fill="#E11D48" /> {/* Red/Rose for Llamada */}
                              <Cell fill="#10B981" /> {/* Emerald for WhatsApp */}
                            </Pie>
                            <Tooltip formatter={(value) => `${value} casos`} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Legend detail list */}
                      <div className="flex-1 space-y-4 w-full">
                        <div className="flex items-center justify-between border-b border-border/40 pb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-rose-600 rounded-full" />
                            <span className="text-xs font-bold text-secondary">Llamada Directa</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black text-secondary font-mono">{metrics.llamadas} casos</span>
                            <span className="text-[10px] text-muted-foreground block font-bold">{metrics.llamadasPct}% del total</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                            <span className="text-xs font-bold text-secondary">WhatsApp Chat</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black text-secondary font-mono">{metrics.whatsapp} casos</span>
                            <span className="text-[10px] text-muted-foreground block font-bold">{metrics.whatsappPct}% del total</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  </CardContent>
                </Card>

                {/* Cartera Card */}
                <Card className="border-none rounded-[1.8rem] card-shadow bg-card">
                  <CardHeader className="py-4 border-b border-border/10">
                    <CardTitle className="text-sm font-extrabold uppercase tracking-wider text-secondary flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-primary" />
                      Casos por Cartera
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    {groupings.casosPorCartera.length === 0 ? (
                      <p className="text-xs text-muted-foreground font-semibold text-center py-6">No hay registros calificados.</p>
                    ) : (
                      <div className="space-y-4">
                        {groupings.casosPorCartera.map((item, idx) => {
                          const pct = metrics.totalCasos > 0 ? Math.round((item.value / metrics.totalCasos) * 100) : 0;
                          return (
                            <div key={item.name} className="space-y-1.5">
                              <div className="flex justify-between items-center text-xs font-bold">
                                <span className="text-secondary truncate max-w-[200px]">{item.name}</span>
                                <span className="font-mono text-muted-foreground">{item.value} gestiones ({pct}%)</span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-2">
                                <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${pct}%`, opacity: 1 - idx * 0.15 }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

              </div>

              {/* Supervisor y Asesor */}
              <div className="col-span-12 lg:col-span-6 space-y-6">
                
                {/* Supervisor Card */}
                <Card className="border-none rounded-[1.8rem] card-shadow bg-card">
                  <CardHeader className="py-4 border-b border-border/10">
                    <CardTitle className="text-sm font-extrabold uppercase tracking-wider text-secondary flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      Casos por Supervisor
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    {groupings.casosPorSupervisor.length === 0 ? (
                      <p className="text-xs text-muted-foreground font-semibold text-center py-6">No hay registros calificados.</p>
                    ) : (
                      <div className="space-y-3">
                        {groupings.casosPorSupervisor.slice(0, 6).map((item, idx) => {
                          const pct = metrics.totalCasos > 0 ? Math.round((item.value / metrics.totalCasos) * 100) : 0;
                          return (
                            <div key={item.name} className="flex justify-between items-center text-xs font-bold py-1 border-b border-border/30 last:border-none">
                              <span className="text-secondary truncate">{item.name}</span>
                              <Badge className="bg-rose-500/10 text-primary border-none rounded-lg font-black font-mono">
                                {item.value} casos ({pct}%)
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Asesor Card */}
                <Card className="border-none rounded-[1.8rem] card-shadow bg-card">
                  <CardHeader className="py-4 border-b border-border/10">
                    <CardTitle className="text-sm font-extrabold uppercase tracking-wider text-secondary flex items-center gap-2">
                      <Award className="w-4 h-4 text-primary" />
                      Volumen de Gestiones por Asesor
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 max-h-[310px] overflow-y-auto custom-scrollbar">
                    {groupings.casosPorAsesor.length === 0 ? (
                      <p className="text-xs text-muted-foreground font-semibold text-center py-6 px-6">No hay registros calificados.</p>
                    ) : (
                      <table className="w-full text-left">
                        <thead className="bg-muted/30 text-[10px] uppercase font-mono text-muted-foreground tracking-wider border-b border-border/10 sticky top-0 bg-card z-10">
                          <tr>
                            <th className="py-2.5 px-4 font-black">Asesor Emisor</th>
                            <th className="py-2.5 px-4 text-right font-black">Casos</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                          {groupings.casosPorAsesor.map((item) => (
                            <tr key={item.name} className="hover:bg-muted/10 font-bold text-xs transition-colors">
                              <td className="py-3 px-4 text-secondary">{item.name}</td>
                              <td className="py-3 px-4 text-right text-slate-800 dark:text-slate-200 font-mono">{item.value} cases</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>

              </div>

            </motion.div>
          )}

          {/* TAB 2: LINKS & RANKINGS */}
          {activeSubTab === 'links' && (
            <motion.div 
              key="links"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              
              {/* TOP ASESORES */}
              <Card className="border-none rounded-[1.8rem] card-shadow bg-card overflow-hidden">
                <CardHeader className="bg-rose-500/5 py-4 px-6 border-b border-border/10">
                  <CardTitle className="text-sm font-extrabold uppercase tracking-wider text-primary flex items-center gap-2">
                    <Award className="w-4.5 h-4.5 text-primary" />
                    Ranking de Asesores por Recaudo Efectivo
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  {groupings.topAsesores.length === 0 ? (
                    <p className="text-xs text-muted-foreground font-semibold text-center py-8 px-6">No hay enlaces registrados.</p>
                  ) : (
                    <table className="w-full text-left min-w-[1100px]">
                      <thead className="bg-muted/40 text-[10px] uppercase font-mono text-muted-foreground tracking-widest border-b border-border/10">
                        <tr>
                          <th className="py-3 px-4 font-black text-center w-12">#</th>
                          <th className="py-3 px-4 font-black">Asesor</th>
                          <th className="py-3 px-4 font-black text-center">Supervisor</th>
                          <th className="py-3 px-4 text-center font-black">Casos</th>
                          <th className="py-3 px-4 text-center font-black">Links Gen</th>
                          <th className="py-3 px-4 text-center font-black text-emerald-600 dark:text-emerald-400">Pagados</th>
                          <th className="py-3 px-4 text-center font-black text-blue-500">Pendientes</th>
                          <th className="py-3 px-4 text-center font-black text-rose-500">Anulados</th>
                          <th className="py-3 px-4 text-right font-black">Valor CRM</th>
                          <th className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400">Recaudado</th>
                          <th className="py-3 px-4 text-right font-black">Ticket Prom.</th>
                          <th className="py-3 px-4 text-right font-black">Conv.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20 font-bold text-xs">
                        {groupings.topAsesores.map((item, idx) => (
                          <tr key={item.email} className="hover:bg-muted/15 transition-all">
                            <td className="py-3.5 px-4 text-center">
                              {idx === 0 ? (
                                <Badge className="bg-yellow-500 hover:bg-yellow-500 text-white font-extrabold text-[9px] px-1.5 py-0.5 rounded-lg">1🥇</Badge>
                              ) : idx === 1 ? (
                                <Badge className="bg-slate-300 hover:bg-slate-300 text-slate-800 font-extrabold text-[9px] px-1.5 py-0.5 rounded-lg">2🥈</Badge>
                              ) : idx === 2 ? (
                                <Badge className="bg-amber-600 hover:bg-amber-600 text-white font-extrabold text-[9px] px-1.5 py-0.5 rounded-lg">3🥉</Badge>
                              ) : (
                                <span className="text-muted-foreground font-mono">{idx + 1}</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <p className="text-secondary uppercase text-[11px] font-black">{item.name}</p>
                              <p className="text-[9px] text-muted-foreground lowercase font-normal">{item.email}</p>
                            </td>
                            <td className="py-3.5 px-4 text-center text-[10px] text-slate-500 dark:text-slate-400">{item.supervisor}</td>
                            <td className="py-3.5 px-4 text-center font-mono">{item.casos}</td>
                            <td className="py-3.5 px-4 text-center font-mono">{item.linksGen}</td>
                            <td className="py-3.5 px-4 text-center font-mono text-emerald-600 dark:text-emerald-400 font-extrabold">{item.linksPagados}</td>
                            <td className="py-3.5 px-4 text-center font-mono text-blue-500">{item.linksPendientes}</td>
                            <td className="py-3.5 px-4 text-center font-mono text-rose-500">{item.linksAnulados}</td>
                            <td className="py-3.5 px-4 text-right font-mono text-muted-foreground text-[11px]">
                              ${Math.round(item.valorGen).toLocaleString('es-CO')}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400 font-black text-[11px]">
                              ${Math.round(item.valorRec).toLocaleString('es-CO')}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                              ${Math.round(item.ticketPromedio).toLocaleString('es-CO')}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-secondary font-black text-[11px]">
                              {item.conversion}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>

              {/* GRID FOR SUPERVISORS & CARTERAS RANKINGS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* TOP SUPERVISORES */}
                <Card className="border-none rounded-[1.8rem] card-shadow bg-card overflow-hidden">
                  <CardHeader className="bg-indigo-500/5 py-4 px-6 border-b border-border/10">
                    <CardTitle className="text-sm font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      Ranking de Supervisores por Recaudo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    {groupings.topSupervisores.length === 0 ? (
                      <p className="text-xs text-muted-foreground font-semibold text-center py-6 px-6">No hay datos.</p>
                    ) : (
                      <table className="w-full text-left">
                        <thead className="bg-muted/40 text-[10px] uppercase font-mono text-muted-foreground tracking-wider border-b border-border/10">
                          <tr>
                            <th className="py-2.5 px-4 font-black">Supervisor</th>
                            <th className="py-2.5 px-4 text-center font-black">Casos</th>
                            <th className="py-2.5 px-4 text-center font-black">Links</th>
                            <th className="py-2.5 px-4 text-right font-black">Recaudado</th>
                            <th className="py-2.5 px-4 text-right font-black">Conv.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20 font-bold text-xs">
                          {groupings.topSupervisores.map((s) => (
                            <tr key={s.name} className="hover:bg-muted/10 transition-colors">
                              <td className="py-3 px-4 text-secondary truncate max-w-[150px]">{s.name}</td>
                              <td className="py-3 px-4 text-center font-mono">{s.casos}</td>
                              <td className="py-3 px-4 text-center font-mono">{s.linksGen}</td>
                              <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">
                                ${Math.round(s.valorRec).toLocaleString('es-CO')}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-secondary">{s.conversion}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
 
                {/* TOP CARTERAS */}
                <Card className="border-none rounded-[1.8rem] card-shadow bg-card overflow-hidden">
                  <CardHeader className="bg-teal-500/5 py-4 px-6 border-b border-border/10">
                    <CardTitle className="text-sm font-extrabold uppercase tracking-wider text-teal-600 dark:text-teal-400 flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      Ranking de Carteras por Recaudo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    {groupings.topCarteras.length === 0 ? (
                      <p className="text-xs text-muted-foreground font-semibold text-center py-6 px-6">No hay datos.</p>
                    ) : (
                      <table className="w-full text-left">
                        <thead className="bg-muted/40 text-[10px] uppercase font-mono text-muted-foreground tracking-wider border-b border-border/10">
                          <tr>
                            <th className="py-2.5 px-4 font-black">Cartera</th>
                            <th className="py-2.5 px-4 text-center font-black">Casos</th>
                            <th className="py-2.5 px-4 text-center font-black">Links</th>
                            <th className="py-2.5 px-4 text-right font-black">Recaudado</th>
                            <th className="py-2.5 px-4 text-right font-black">Conv.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20 font-bold text-xs">
                          {groupings.topCarteras.map((c) => (
                            <tr key={c.name} className="hover:bg-muted/10 transition-colors">
                              <td className="py-3 px-4 text-secondary">{c.name}</td>
                              <td className="py-3 px-4 text-center font-mono">{c.casos}</td>
                              <td className="py-3 px-4 text-center font-mono">{c.linksGen}</td>
                              <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">
                                ${Math.round(c.valorRec).toLocaleString('es-CO')}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-secondary">{c.conversion}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>

              </div>

              {/* GRID FOR RESPONSABLES, EMISORES & TRANSFERENCIAS */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* TOP RESPONSABLES */}
                <Card className="border-none rounded-[1.8rem] card-shadow bg-card overflow-hidden">
                  <CardHeader className="bg-blue-500/5 py-4 px-6 border-b border-border/10">
                    <CardTitle className="text-sm font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      Responsables por Recaudo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    {groupings.topResponsables.length === 0 ? (
                      <p className="text-xs text-muted-foreground font-semibold text-center py-6 px-6">No hay datos.</p>
                    ) : (
                      <table className="w-full text-left">
                        <thead className="bg-muted/40 text-[10px] uppercase font-mono text-muted-foreground tracking-wider border-b border-border/10">
                          <tr>
                            <th className="py-2.5 px-4 font-black">Responsable</th>
                            <th className="py-2.5 px-4 text-center font-black">Casos</th>
                            <th className="py-2.5 px-4 text-right font-black">Recaudado</th>
                            <th className="py-2.5 px-4 text-right font-black">Conv.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20 font-bold text-xs">
                          {groupings.topResponsables.map((r) => (
                            <tr key={r.name} className="hover:bg-muted/10 transition-colors">
                              <td className="py-3 px-4 text-secondary truncate max-w-[150px] uppercase">{r.name}</td>
                              <td className="py-3 px-4 text-center font-mono">{r.casos}</td>
                              <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">
                                ${Math.round(r.valorRec).toLocaleString('es-CO')}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-secondary">{r.conversion}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>

                {/* TOP EMISORES */}
                <Card className="border-none rounded-[1.8rem] card-shadow bg-card overflow-hidden">
                  <CardHeader className="bg-amber-500/5 py-4 px-6 border-b border-border/10">
                    <CardTitle className="text-sm font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      Emisores de Enlace por Recaudo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    {groupings.topEmisores.length === 0 ? (
                      <p className="text-xs text-muted-foreground font-semibold text-center py-6 px-6">No hay datos.</p>
                    ) : (
                      <table className="w-full text-left">
                        <thead className="bg-muted/40 text-[10px] uppercase font-mono text-muted-foreground tracking-wider border-b border-border/10">
                          <tr>
                            <th className="py-2.5 px-4 font-black">Emisor</th>
                            <th className="py-2.5 px-4 text-center font-black">Links</th>
                            <th className="py-2.5 px-4 text-right font-black">Recaudado</th>
                            <th className="py-2.5 px-4 text-right font-black">Conv.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20 font-bold text-xs">
                          {groupings.topEmisores.map((e) => (
                            <tr key={e.name} className="hover:bg-muted/10 transition-colors">
                              <td className="py-3 px-4 text-secondary truncate max-w-[150px] uppercase">{e.name}</td>
                              <td className="py-3 px-4 text-center font-mono">{e.linksGen}</td>
                              <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">
                                ${Math.round(e.valorRec).toLocaleString('es-CO')}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-secondary">{e.conversion}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>

                {/* TRANSFERENCIA DE CASOS */}
                <Card className="border-none rounded-[1.8rem] card-shadow bg-card overflow-hidden">
                  <CardHeader className="bg-purple-500/5 py-4 px-6 border-b border-border/10">
                    <CardTitle className="text-sm font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-2">
                      <ArrowUpRight className="w-4.5 h-4.5 text-purple-600 dark:text-purple-400" />
                      Transferencias de Casos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    {groupings.topTransferencias.list.length === 0 ? (
                      <p className="text-xs text-muted-foreground font-semibold text-center py-6 px-6">No hay transferencias.</p>
                    ) : (
                      <table className="w-full text-left">
                        <thead className="bg-muted/40 text-[10px] uppercase font-mono text-muted-foreground tracking-wider border-b border-border/10">
                          <tr>
                            <th className="py-2.5 px-4 font-black">Asesor</th>
                            <th className="py-2.5 px-4 text-center font-black text-rose-500">Env.</th>
                            <th className="py-2.5 px-4 text-center font-black text-emerald-500">Rec.</th>
                            <th className="py-2.5 px-4 text-right font-black">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20 font-bold text-xs">
                          {groupings.topTransferencias.list.slice(0, 10).map((t) => (
                            <tr key={t.name} className="hover:bg-muted/10 transition-colors">
                              <td className="py-3 px-4 text-secondary truncate max-w-[150px] uppercase">{t.name}</td>
                              <td className="py-3 px-4 text-center font-mono text-rose-500 font-extrabold">{t.enviadas}</td>
                              <td className="py-3 px-4 text-center font-mono text-emerald-500 font-extrabold">{t.recibidas}</td>
                              <td className="py-3 px-4 text-right font-mono text-secondary font-black">{t.enviadas + t.recibidas}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>

              </div>

            </motion.div>
          )}

          {/* TAB 3: APOYOS */}
          {activeSubTab === 'apoyos' && (
            <motion.div 
              key="apoyos"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              
              {/* Summary counters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                <Card className="border-none rounded-3xl card-shadow bg-card">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-red-500/10 text-primary rounded-2xl">
                      <HeartHandshake className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Casos Apoyados</p>
                      <h4 className="text-3xl font-black text-secondary mt-0.5">{metrics.casosApoyados}</h4>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">Gestiones de ayuda</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none rounded-3xl card-shadow bg-card">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/10 text-indigo-600 rounded-2xl">
                      <ArrowUpRight className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Brindaron Apoyo</p>
                      <h4 className="text-3xl font-black text-secondary mt-0.5">{brindaronApoyoCount()}</h4>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">Asesores emisores</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none rounded-3xl card-shadow bg-card">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-2xl">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Recibieron Apoyo</p>
                      <h4 className="text-3xl font-black text-secondary mt-0.5">{recibieronApoyoCount()}</h4>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">Asesores receptores</span>
                    </div>
                  </CardContent>
                </Card>

              </div>

              {/* Summary table of Supports and Transfers per Advisor */}
              <Card className="border-none rounded-[1.8rem] card-shadow bg-card overflow-hidden">
                <CardHeader className="py-4 px-6 border-b border-border/10 bg-indigo-500/5">
                  <CardTitle className="text-sm font-extrabold uppercase tracking-wider text-secondary flex items-center gap-2">
                    <HeartHandshake className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
                    Resumen de Apoyos y Transferencias por Asesor
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto max-h-[350px] overflow-y-auto custom-scrollbar">
                  {groupings.topApoyosYTransfers.length === 0 ? (
                    <p className="text-xs text-muted-foreground font-semibold text-center py-10 px-6">No hay registros de apoyos o transferencias.</p>
                  ) : (
                    <table className="w-full text-left">
                      <thead className="bg-muted/40 text-[10px] uppercase font-mono text-muted-foreground tracking-wider border-b border-border/10 sticky top-0 bg-card z-10">
                        <tr>
                          <th className="py-3 px-6 font-black">Asesor</th>
                          <th className="py-3 px-4 text-center font-black text-indigo-600 dark:text-indigo-400">Apoyos Brindados</th>
                          <th className="py-3 px-4 text-center font-black text-emerald-600 dark:text-emerald-400">Apoyos Recibidos</th>
                          <th className="py-3 px-4 text-center font-black text-blue-500">Transf. Realizadas</th>
                          <th className="py-3 px-4 text-center font-black text-purple-500">Transf. Recibidas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20 font-bold text-xs">
                        {groupings.topApoyosYTransfers.map((item) => (
                          <tr key={item.email} className="hover:bg-muted/10 transition-colors">
                            <td className="py-3 px-6">
                              <p className="text-secondary uppercase">{item.name}</p>
                              <p className="text-[10px] text-muted-foreground lowercase font-normal">{item.email}</p>
                            </td>
                            <td className="py-3 px-4 text-center font-mono text-indigo-600 dark:text-indigo-400 font-extrabold text-sm">{item.apoyosBrindados}</td>
                            <td className="py-3 px-4 text-center font-mono text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">{item.apoyosRecibidos}</td>
                            <td className="py-3 px-4 text-center font-mono text-blue-500 text-sm">{item.transfersEnviadas}</td>
                            <td className="py-3 px-4 text-center font-mono text-purple-500 text-sm">{item.transfersRecibidas}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>

              {/* Detailed logs list */}
              <Card className="border-none rounded-[1.8rem] card-shadow bg-card overflow-hidden">
                <CardHeader className="py-4 px-6 border-b border-border/10">
                  <CardTitle className="text-sm font-extrabold uppercase tracking-wider text-secondary flex items-center gap-2">
                    <HeartHandshake className="w-4.5 h-4.5 text-primary" />
                    Registro de Casos Colaborativos / Apoyo entre Asesores
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 max-h-[350px] overflow-y-auto custom-scrollbar">
                  {apoyosDetails.length === 0 ? (
                    <p className="text-xs text-muted-foreground font-semibold text-center py-10 px-6">No se registran casos de apoyo en este período o filtros seleccionados.</p>
                  ) : (
                    <table className="w-full text-left">
                      <thead className="bg-muted/40 text-[10px] uppercase font-mono text-muted-foreground tracking-wider border-b border-border/10 sticky top-0 bg-card z-10">
                        <tr>
                          <th className="py-3 px-6 font-black">Solicitud</th>
                          <th className="py-3 px-4 font-black">Cliente</th>
                          <th className="py-3 px-4 font-black text-indigo-600 dark:text-indigo-400">Brindó Apoyo (Emisor)</th>
                          <th className="py-3 px-4 font-black text-emerald-600 dark:text-emerald-400">Recibió Apoyo (Receptor)</th>
                          <th className="py-3 px-4 font-black">Cartera</th>
                          <th className="py-3 px-6 text-right font-black">Fecha</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20 font-bold text-xs">
                        {apoyosDetails.map((apoyo) => (
                          <tr key={apoyo.id} className="hover:bg-muted/10 transition-colors">
                            <td className="py-3 px-6 font-mono text-slate-500">{apoyo.requestNumber}</td>
                            <td className="py-3 px-4 text-secondary max-w-[150px] truncate">{apoyo.cliente}</td>
                            <td className="py-3 px-4 text-indigo-600 dark:text-indigo-400">{apoyo.emisor}</td>
                            <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400">{apoyo.receptor}</td>
                            <td className="py-3 px-4 text-muted-foreground">{apoyo.cartera}</td>
                            <td className="py-3 px-6 text-right text-slate-500 font-mono font-medium">{apoyo.fecha}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>

            </motion.div>
          )}

          {/* TAB 4: GRAFICAS */}
          {activeSubTab === 'graficas' && (
            <motion.div 
              key="graficas"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              
              {/* Daily cases and links trend */}
              <div className="col-span-12 lg:col-span-8">
                <Card className="border-none rounded-[1.8rem] card-shadow bg-card">
                  <CardHeader className="py-4 border-b border-border/10">
                    <CardTitle className="text-sm font-extrabold uppercase tracking-wider text-secondary flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-primary" />
                      Casos Gestionados y Links Generados por Día
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="h-64">
                      {trendsData.length === 0 ? (
                        <p className="text-xs text-muted-foreground font-semibold text-center py-20">Seleccione un rango con datos.</p>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={trendsData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#88888820" />
                            <XAxis dataKey="shortDate" tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#888" />
                            <YAxis tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#888" />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: 10, fontWeight: 'bold' }} />
                            <Line type="monotone" dataKey="casos" stroke="#E11D48" strokeWidth={2.5} name="Casos Totales" dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="links" stroke="#F59E0B" strokeWidth={2.5} name="Links Generados" dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Pie/Radial Channel Distribution */}
              <div className="col-span-12 lg:col-span-4">
                <Card className="border-none rounded-[1.8rem] card-shadow bg-card h-full">
                  <CardHeader className="py-4 border-b border-border/10">
                    <CardTitle className="text-sm font-extrabold uppercase tracking-wider text-secondary flex items-center gap-2">
                      <PieIcon className="w-4 h-4 text-primary" />
                      Participación de Canal
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 flex flex-col items-center justify-center h-[280px]">
                    <div className="w-full h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Llamada', value: metrics.llamadas },
                              { name: 'WhatsApp', value: metrics.whatsapp }
                            ]}
                            cx="50%"
                            cy="50%"
                            outerRadius={65}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            <Cell fill="#E11D48" />
                            <Cell fill="#10B981" />
                          </Pie>
                          <Tooltip formatter={(value) => `${value} casos`} />
                          <Legend wrapperStyle={{ fontSize: 10, fontWeight: 'bold' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recaudo Efectivo por Día Chart */}
              <div className="col-span-12 lg:col-span-6">
                <Card className="border-none rounded-[1.8rem] card-shadow bg-card">
                  <CardHeader className="py-4 border-b border-border/10">
                    <CardTitle className="text-sm font-extrabold uppercase tracking-wider text-secondary flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-primary" />
                      Recaudo Efectivo Diario ($ COP)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="h-60">
                      {trendsData.length === 0 ? (
                        <p className="text-xs text-muted-foreground font-semibold text-center py-20">Seleccione un rango con datos.</p>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={trendsData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#88888820" />
                            <XAxis dataKey="shortDate" tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#888" />
                            <YAxis tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#888" formatter={(v) => `$${(v as number).toLocaleString('es-CO')}`} />
                            <Tooltip formatter={(value) => [`$${(value as number).toLocaleString('es-CO')}`, 'Recaudo Efectivo']} />
                            <Bar dataKey="recaudo" fill="#10B981" radius={[4, 4, 0, 0]} name="Recaudo diario" />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Conversión Diaria Chart */}
              <div className="col-span-12 lg:col-span-6">
                <Card className="border-none rounded-[1.8rem] card-shadow bg-card">
                  <CardHeader className="py-4 border-b border-border/10">
                    <CardTitle className="text-sm font-extrabold uppercase tracking-wider text-secondary flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      Conversión Diaria de Pagos (%)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="h-60">
                      {trendsData.length === 0 ? (
                        <p className="text-xs text-muted-foreground font-semibold text-center py-20">Seleccione un rango con datos.</p>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={trendsData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#88888820" />
                            <XAxis dataKey="shortDate" tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#888" />
                            <YAxis tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#888" formatter={(v) => `${v}%`} />
                            <Tooltip formatter={(v) => [`${v}%`, 'Conversión']} />
                            <Line type="monotone" dataKey="conversion" stroke="#3B82F6" strokeWidth={3} name="Conversión (%)" dot={{ r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

            </motion.div>
          )}

          {/* TAB 5: EMBUDO DE CONVERSIÓN */}
          {activeSubTab === 'embudo' && (
            <motion.div 
              key="embudo"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              
              <Card className="border-none rounded-[1.8rem] card-shadow bg-card overflow-hidden">
                <CardHeader className="py-5 px-6 border-b border-border/10 bg-primary/5">
                  <CardTitle className="text-base font-extrabold uppercase tracking-wider text-secondary flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Embudo Ejecutivo de Conversión de Gestión y Recaudo
                  </CardTitle>
                  <p className="text-xs text-muted-foreground font-medium mt-1">
                    Visualización del flujo desde la primera gestión operativa en el CRM hasta la conciliación final del recaudo.
                  </p>
                </CardHeader>
                <CardContent className="p-6 md:p-8">
                  
                  {/* Funnel container */}
                  <div className="max-w-4xl mx-auto space-y-4 relative">
                    
                    {/* Stage 1 */}
                    <div className="relative group">
                      <div className="flex flex-col md:flex-row items-center justify-between p-4 bg-red-500/5 dark:bg-red-500/10 border border-red-500/20 rounded-2xl relative z-10 hover:shadow-md transition-all">
                        <div className="flex items-center gap-4">
                          <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">1</span>
                          <div>
                            <h4 className="font-extrabold text-secondary text-sm">Casos Gestionados</h4>
                            <p className="text-[10px] text-muted-foreground font-semibold">Total gestiones registradas en el CRM</p>
                          </div>
                        </div>
                        <div className="mt-2 md:mt-0 text-right">
                          <p className="text-xl font-black text-secondary font-mono">{metrics.totalCasos.toLocaleString('es-CO')}</p>
                          <span className="text-[10px] font-bold text-primary font-mono">100% Entrada</span>
                        </div>
                      </div>
                      {/* Funnel width visualizer */}
                      <div className="w-full bg-muted/20 h-1 rounded-full mt-2 overflow-hidden">
                        <div className="bg-primary h-full rounded-full" style={{ width: '100%' }} />
                      </div>
                    </div>

                    {/* Arrow / connection 1 */}
                    <div className="flex justify-center -my-2 relative z-0">
                      <div className="h-6 w-0.5 border-dashed border-primary/30" />
                    </div>

                    {/* Stage 2 */}
                    <div className="relative group">
                      <div className="flex flex-col md:flex-row items-center justify-between p-4 bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/20 rounded-2xl relative z-10 hover:shadow-md transition-all">
                        <div className="flex items-center gap-4">
                          <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">2</span>
                          <div>
                            <h4 className="font-extrabold text-secondary text-sm">Clientes Contactados</h4>
                            <p className="text-[10px] text-muted-foreground font-semibold">Clientes únicos gestionados (sin duplicados)</p>
                          </div>
                        </div>
                        <div className="mt-2 md:mt-0 text-right">
                          <p className="text-xl font-black text-secondary font-mono">{metrics.clientesContactados.toLocaleString('es-CO')}</p>
                          <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 font-mono">
                            {metrics.totalCasos > 0 ? ((metrics.clientesContactados / metrics.totalCasos) * 100).toFixed(1) : 0}% de casos
                          </span>
                        </div>
                      </div>
                      {/* Funnel width visualizer */}
                      <div className="w-full bg-muted/20 h-1 rounded-full mt-2 overflow-hidden">
                        <div className="bg-orange-500 h-full rounded-full" style={{ width: `${metrics.totalCasos > 0 ? Math.min((metrics.clientesContactados / metrics.totalCasos) * 100, 100) : 0}%` }} />
                      </div>
                    </div>

                    {/* Arrow / connection 2 */}
                    <div className="flex justify-center -my-2 relative z-0">
                      <div className="h-6 w-0.5 border-dashed border-orange-500/30" />
                    </div>

                    {/* Stage 3 */}
                    <div className="relative group">
                      <div className="flex flex-col md:flex-row items-center justify-between p-4 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl relative z-10 hover:shadow-md transition-all">
                        <div className="flex items-center gap-4">
                          <span className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm">3</span>
                          <div>
                            <h4 className="font-extrabold text-secondary text-sm">Links de Pago Enviados</h4>
                            <p className="text-[10px] text-muted-foreground font-semibold">Enlaces de recaudo generados en el período</p>
                          </div>
                        </div>
                        <div className="mt-2 md:mt-0 text-right">
                          <p className="text-xl font-black text-secondary font-mono">{metrics.linksGenerados.toLocaleString('es-CO')}</p>
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 font-mono">
                            {metrics.clientesContactados > 0 ? ((metrics.linksGenerados / metrics.clientesContactados) * 100).toFixed(1) : 0}% efectividad de envío
                          </span>
                        </div>
                      </div>
                      {/* Funnel width visualizer */}
                      <div className="w-full bg-muted/20 h-1 rounded-full mt-2 overflow-hidden">
                        <div className="bg-amber-500 h-full rounded-full" style={{ width: `${metrics.clientesContactados > 0 ? Math.min((metrics.linksGenerados / metrics.clientesContactados) * 100, 100) : 0}%` }} />
                      </div>
                    </div>

                    {/* Arrow / connection 3 */}
                    <div className="flex justify-center -my-2 relative z-0">
                      <div className="h-6 w-0.5 border-dashed border-amber-500/30" />
                    </div>

                    {/* Stage 4 */}
                    <div className="relative group">
                      <div className="flex flex-col md:flex-row items-center justify-between p-4 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-2xl relative z-10 hover:shadow-md transition-all">
                        <div className="flex items-center gap-4">
                          <span className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm">4</span>
                          <div>
                            <h4 className="font-extrabold text-secondary text-sm">Enlaces Pagados Conciliados</h4>
                            <p className="text-[10px] text-muted-foreground font-semibold">Enlaces con confirmación de pago efectivo en banco</p>
                          </div>
                        </div>
                        <div className="mt-2 md:mt-0 text-right">
                          <p className="text-xl font-black text-secondary font-mono">{metrics.linksPagados.toLocaleString('es-CO')}</p>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                            {metrics.conversionPago}% conversión de pago
                          </span>
                        </div>
                      </div>
                      {/* Funnel width visualizer */}
                      <div className="w-full bg-muted/20 h-1 rounded-full mt-2 overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${metrics.conversionPago}%` }} />
                      </div>
                    </div>

                    {/* Arrow / connection 4 */}
                    <div className="flex justify-center -my-2 relative z-0">
                      <div className="h-6 w-0.5 border-dashed border-emerald-500/30" />
                    </div>

                    {/* Stage 5 */}
                    <div className="relative group">
                      <div className="flex flex-col md:flex-row items-center justify-between p-4 bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 rounded-2xl relative z-10 hover:shadow-md transition-all">
                        <div className="flex items-center gap-4">
                          <span className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">5</span>
                          <div>
                            <h4 className="font-extrabold text-secondary text-sm">Monto Total Recaudado</h4>
                            <p className="text-[10px] text-muted-foreground font-semibold">Valor monetario efectivo conciliado en cuentas bancarias</p>
                          </div>
                        </div>
                        <div className="mt-2 md:mt-0 text-right">
                          <p className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono">
                            ${Math.round(metrics.recaudoEfectivo).toLocaleString('es-CO')} COP
                          </p>
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 font-mono">
                            Ticket Promedio: ${Math.round(metrics.ticketPromedio).toLocaleString('es-CO')}
                          </span>
                        </div>
                      </div>
                      {/* Funnel width visualizer */}
                      <div className="w-full bg-muted/20 h-1 rounded-full mt-2 overflow-hidden">
                        <div className="bg-blue-500 h-full rounded-full" style={{ width: '100%' }} />
                      </div>
                    </div>

                  </div>

                </CardContent>
              </Card>

            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
};
