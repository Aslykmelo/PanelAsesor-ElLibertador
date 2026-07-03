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
import { supabase } from '@/supabase';
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
    let success = false;
    let records: any[] = [];

    // 1. Try Supabase first if available
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('recaudo_historico')
          .select('*');
        if (!error && data && data.length > 0) {
          records = data;
          success = true;
          console.log("Dashboard Ejecutivo: Cargado de recaudo desde Supabase.");
        } else if (error) {
          console.error("Error fetching recaudo_historico:", error);
        }
      } catch (sErr) {
        console.error("Supabase exception:", sErr);
      }
    }

    // 2. Fallback to Firestore if Supabase is not configured or failed to return records
    if (!success) {
      try {
        const { collection, getDocs } = await import('firebase/firestore');
        const { db } = await import('@/firebase');
        const querySnapshot = await getDocs(collection(db, 'recaudo_historico'));
        const fData: any[] = [];
        querySnapshot.forEach((doc) => {
          fData.push(doc.data());
        });
        if (fData.length > 0) {
          records = fData;
          success = true;
          console.log("Dashboard Ejecutivo: Cargado de recaudo desde Firestore (Fallback de producción).");
        }
      } catch (fErr) {
        console.error("Firestore load backup error:", fErr);
      }
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

    const conversionPago = linksGenerados > 0 ? Number(((linksPagados / linksGenerados) * 100).toFixed(1)) : 0;

    // RECAUDO EFECTIVO (EXCLUSIVAMENTE DESDE CONCILIACIÓN CON ESTADO RECIBO = RECIBO Y TIPO RECAUDO = S)
    // Filtered by the selected period (checked in filteredData.reconciled)
    const recaudoEfectivo = linksCRM.reduce((sum, item) => {
      if (item.estadoCRM === 'PAGADO' && String(item.tipo_recaudo || '').trim().toUpperCase() === 'S') {
        return sum + (item.valor_liquidacion || 0);
      }
      return sum;
    }, 0);

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

      const conversion = linksGen > 0 ? Number(((linksPagados / linksGen) * 100).toFixed(1)) : 0;
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
      valorRec: number;
    }> = {};

    filteredData.crm.forEach(t => {
      const sup = toTitleCase(t.supervisorName) || 'Sin Supervisor';
      if (!rankingSupervisoresMap[sup]) {
        rankingSupervisoresMap[sup] = { name: sup, casos: 0, linksGen: 0, linksPagados: 0, valorRec: 0 };
      }
      rankingSupervisoresMap[sup].casos++;
    });

    filteredData.reconciled.forEach(item => {
      const sup = toTitleCase(item.supervisor) || 'Sin Supervisor';
      if (!rankingSupervisoresMap[sup]) {
        rankingSupervisoresMap[sup] = { name: sup, casos: 0, linksGen: 0, linksPagados: 0, valorRec: 0 };
      }
      const entry = rankingSupervisoresMap[sup];
      entry.linksGen++;
      if (item.estadoCRM === 'PAGADO') {
        entry.linksPagados++;
        if (String(item.tipo_recaudo || '').trim().toUpperCase() === 'S') {
          entry.valorRec += (item.valor_liquidacion || 0);
        }
      }
    });

    const topSupervisores = Object.values(rankingSupervisoresMap)
      .map(entry => {
        const conversion = entry.linksGen > 0 ? Number(((entry.linksPagados / entry.linksGen) * 100).toFixed(1)) : 0;
        return { ...entry, conversion };
      })
      .sort((a, b) => b.valorRec - a.valorRec || b.casos - a.casos);

    // 6. TOP CARTERAS (cases, links, collected, conversion)
    const rankingCarterasMap: Record<string, {
      name: string;
      casos: number;
      linksGen: number;
      linksPagados: number;
      valorRec: number;
    }> = {};

    filteredData.crm.forEach(t => {
      const cart = t.cartera || 'Sin Cartera';
      if (!rankingCarterasMap[cart]) {
        rankingCarterasMap[cart] = { name: cart, casos: 0, linksGen: 0, linksPagados: 0, valorRec: 0 };
      }
      rankingCarterasMap[cart].casos++;
    });

    filteredData.reconciled.forEach(item => {
      const cart = item.cartera || 'Sin Cartera';
      if (!rankingCarterasMap[cart]) {
        rankingCarterasMap[cart] = { name: cart, casos: 0, linksGen: 0, linksPagados: 0, valorRec: 0 };
      }
      const entry = rankingCarterasMap[cart];
      entry.linksGen++;
      if (item.estadoCRM === 'PAGADO') {
        entry.linksPagados++;
        if (String(item.tipo_recaudo || '').trim().toUpperCase() === 'S') {
          entry.valorRec += (item.valor_liquidacion || 0);
        }
      }
    });

    const topCarteras = Object.values(rankingCarterasMap)
      .map(entry => {
        const conversion = entry.linksGen > 0 ? Number(((entry.linksPagados / entry.linksGen) * 100).toFixed(1)) : 0;
        return { ...entry, conversion };
      })
      .sort((a, b) => b.valorRec - a.valorRec || b.casos - a.casos);

    // 7. TOP RESPONSABLES (Responsable, Casos, Links, Recaudo, Conversión)
    const rankingResponsablesMap: Record<string, {
      name: string;
      casos: number;
      linksGen: number;
      linksPagados: number;
      valorRec: number;
    }> = {};

    filteredData.crm.forEach(t => {
      const resp = toTitleCase(t.toAdvisorName) || 'Sin Responsable';
      if (!rankingResponsablesMap[resp]) {
        rankingResponsablesMap[resp] = { name: resp, casos: 0, linksGen: 0, linksPagados: 0, valorRec: 0 };
      }
      rankingResponsablesMap[resp].casos++;
    });

    filteredData.reconciled.forEach(item => {
      const resp = toTitleCase(item.responsable) || 'Sin Responsable';
      if (!rankingResponsablesMap[resp]) {
        rankingResponsablesMap[resp] = { name: resp, casos: 0, linksGen: 0, linksPagados: 0, valorRec: 0 };
      }
      const entry = rankingResponsablesMap[resp];
      entry.linksGen++;
      if (item.estadoCRM === 'PAGADO') {
        entry.linksPagados++;
        if (String(item.tipo_recaudo || '').trim().toUpperCase() === 'S') {
          entry.valorRec += (item.valor_liquidacion || 0);
        }
      }
    });

    const topResponsables = Object.values(rankingResponsablesMap)
      .map(entry => {
        const conversion = entry.linksGen > 0 ? Number(((entry.linksPagados / entry.linksGen) * 100).toFixed(1)) : 0;
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
        const conversion = entry.linksGen > 0 ? Number(((entry.linksPagados / entry.linksGen) * 100).toFixed(1)) : 0;
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
    }> = {};

    // Base date list from selection range to make sure chart is contiguous
    if (filterStartDate && filterEndDate) {
      const start = new Date(filterStartDate + 'T00:00:00');
      const end = new Date(filterEndDate + 'T23:59:59');
      let curr = new Date(start);
      while (curr <= end) {
        const dateStr = curr.toISOString().split('T')[0];
        daysMap[dateStr] = { date: dateStr, casos: 0, links: 0, recaudo: 0, linksPagados: 0 };
        curr.setDate(curr.getDate() + 1);
      }
    }

    // Populate Cases
    filteredData.crm.forEach(t => {
      const dateStr = formatGenerateDateString(t.createdAt);
      if (dateStr !== '-' && daysMap[dateStr]) {
        daysMap[dateStr].casos++;
      } else if (dateStr !== '-') {
        daysMap[dateStr] = { date: dateStr, casos: 1, links: 0, recaudo: 0, linksPagados: 0 };
      }
    });

    // Populate Links & Recaudo
    filteredData.reconciled.forEach(item => {
      const genDateStr = item.fecha_generacion_link;
      const pagoDateStr = item.fecha_pago;

      // Add as link generated on generation date
      if (genDateStr !== '-' && daysMap[genDateStr]) {
        daysMap[genDateStr].links++;
        if (item.estadoCRM === 'PAGADO') {
          daysMap[genDateStr].linksPagados++;
        }
      }

      // Add as recaudo on payment date
      if (pagoDateStr !== '-' && item.estadoCRM === 'PAGADO' && String(item.tipo_recaudo || '').trim().toUpperCase() === 'S') {
        if (daysMap[pagoDateStr]) {
          daysMap[pagoDateStr].recaudo += (item.valor_liquidacion || 0);
        } else {
          daysMap[pagoDateStr] = { date: pagoDateStr, casos: 0, links: 0, recaudo: item.valor_liquidacion, linksPagados: 0 };
        }
      }
    });

    return Object.values(daysMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(day => {
        const conversion = day.links > 0 ? Number(((day.linksPagados / day.links) * 100).toFixed(1)) : 0;
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

    // Background decoration
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 45, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORTE EJECUTIVO DE GESTIÓN Y RECAUDO', 15, 14);
    
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    
    const activeFiltersText = [
      `Período: ${filterStartDate || 'Inicio'} a ${filterEndDate || 'Hoy'}`,
      `Cartera: ${filterCartera !== 'todos' ? filterCartera : 'Todas'}`,
      `Supervisor: ${filterSupervisor !== 'todos' ? toTitleCase(filterSupervisor) : 'Todos'}`,
      `Responsable: ${filterResponsable !== 'todos' ? toTitleCase(filterResponsable) : 'Todos'}`,
      `Canal: ${filterCanal !== 'todos' ? filterCanal : 'Todos'}`
    ].join(' | ');

    doc.text(activeFiltersText, 15, 22);
    doc.text(`Generado por: ${user.name} (${user.email}) • ${new Date().toLocaleString('es-CO')}`, 15, 28);
    
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text('Este reporte contiene únicamente información correspondiente a los filtros seleccionados.', 15, 34);

    // Section 1: KPI OPERATIVOS Y FINANCIEROS
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Indicadores Claves de Desempeño (KPI)', 15, 55);

    const kpiRows = [
      ['Total Casos Gestionados', String(metrics.totalCasos), 'Gestiones de llamadas y mensajes registradas'],
      ['Casos por Canal', `Llamadas: ${metrics.llamadas} (${metrics.llamadasPct}%) • WhatsApp: ${metrics.whatsapp} (${metrics.whatsappPct}%)`, 'Canal utilizado en CRM'],
      ['Toma de Mensajes', String(metrics.tomaMensajes), 'Registros tipo Toma de Mensaje'],
      ['Links de Pago Generados', String(metrics.linksGenerados), 'Enlaces creados para recaudar'],
      ['Conciliación Enlaces', `Pagados: ${metrics.linksPagados} • Pendientes: ${metrics.linksPendientes} • Anulados: ${metrics.linksAnulados}`, 'Estados del recaudo financiero'],
      ['Conversión de Pago', `${metrics.conversionPago}%`, 'Porcentaje de efectividad del recaudo'],
      ['Valor Generado CRM', `$${Math.round(metrics.valorRegistradoCRM).toLocaleString('es-CO')}`, 'Valor monetario registrado en CRM'],
      ['Recaudo Efectivo', `$${Math.round(metrics.recaudoEfectivo).toLocaleString('es-CO')}`, 'Recaudo real en Supabase (estado RECIBO, tipo S)'],
      ['Apoyos entre Asesores', `${metrics.casosApoyados} casos (brindaron: ${brindaronApoyoCount()} • recibieron: ${recibieronApoyoCount()})`, 'Apoyos registrados en transferencias']
    ];

    autoTable(doc, {
      startY: 60,
      head: [['KPI / Indicador', 'Valor', 'Descripción']],
      body: kpiRows,
      theme: 'striped',
      headStyles: { fillColor: primaryColor },
      styles: { fontSize: 9, cellPadding: 2.5 }
    });

    // Add page if needed
    doc.addPage();
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Desempeño de Asesores (Ranking)', 15, 20);

    const advisorRowsToPrint = groupings.topAsesores.slice(0, 15); // Print top 15 on PDF
    const asesorRows = advisorRowsToPrint.map((a, idx) => [
      String(idx + 1),
      a.name,
      String(a.casos),
      String(a.linksGen),
      `$${Math.round(a.valorGen).toLocaleString('es-CO')}`,
      `$${Math.round(a.valorRec).toLocaleString('es-CO')}`,
      `${a.conversion}%`,
      `${a.avgPaymentTime}d`
    ]);

    autoTable(doc, {
      startY: 25,
      head: [['#', 'Asesor Responsable', 'Casos', 'Links', 'Valor CRM', 'Valor Recaudado', 'Conv.', 'T.Pago']],
      body: asesorRows,
      theme: 'striped',
      headStyles: { fillColor: [21, 49, 87] as [number, number, number] }, // Navy Blue for subtable
      styles: { fontSize: 8.5, cellPadding: 2 }
    });

    // Section 3: Supervisores y Carteras
    const lastY = (doc as any).lastAutoTable.finalY + 12;
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('3. Desempeño por Supervisor y Cartera', 15, lastY);

    const supRows = groupings.topSupervisores.map(s => [
      s.name,
      String(s.casos),
      String(s.linksGen),
      `$${Math.round(s.valorRec).toLocaleString('es-CO')}`,
      `${s.conversion}%`
    ]);

    autoTable(doc, {
      startY: lastY + 5,
      head: [['Supervisor', 'Total Casos', 'Links Generados', 'Monto Recaudado', 'Conversión']],
      body: supRows,
      theme: 'striped',
      headStyles: { fillColor: primaryColor },
      styles: { fontSize: 8.5, cellPadding: 2 }
    });

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
