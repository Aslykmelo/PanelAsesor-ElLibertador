import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  Trash2, 
  Search, 
  Filter,
  TrendingUp, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle,
  FileDown,
  Terminal,
  Award,
  Users,
  Target,
  Briefcase,
  Plus,
  RotateCcw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Transfer, User } from '@/types';
import { toast } from 'sonner';
import { supabase } from '@/supabase';

interface ExcelMetadata {
  fileName: string;
  uploadedAtDate: string;
  uploadedAtTime: string;
  uploaderName: string;
  uploaderEmail: string;
  recordCount: number;
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

interface RecaudoTrackingProps {
  transfers: Transfer[];
  user: User;
  onRefreshRecaudo?: () => void;
}

export const RecaudoTracking: React.FC<RecaudoTrackingProps> = ({ transfers, user }) => {
  const [bankRecords, setBankRecords] = useState<RecaudoHistoricoDB[]>(() => {
    try {
      const cached = localStorage.getItem('recaudo_historico_local_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [metadata, setMetadata] = useState<ExcelMetadata | null>(() => {
    try {
      const cached = localStorage.getItem('recaudo_excel_metadata_v2');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [logs, setLogs] = useState<string[]>([]);
  const [isLogsExpanded, setIsLogsExpanded] = useState(false);
  const [isLoadingDb, setIsLoadingDb] = useState(false);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [filterSupervisor, setFilterSupervisor] = useState('todos');
  const [filterResponsable, setFilterResponsable] = useState('todos');
  const [filterEmisor, setFilterEmisor] = useState('todos');
  const [filterCartera, setFilterCartera] = useState('todos');
  const [filterGenDesde, setFilterGenDesde] = useState('');
  const [filterGenHasta, setFilterGenHasta] = useState('');
  const [filterVenDesde, setFilterVenDesde] = useState('');
  const [filterVenHasta, setFilterVenHasta] = useState('');
  const [filterPagoDesde, setFilterPagoDesde] = useState('');
  const [filterPagoHasta, setFilterPagoHasta] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Normalizer for request numbers
  const normalizeSolicitud = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null) return '';
    return String(val)
      .replace(/[\u200B-\u200D\uFEFF\u200F\u200E\u00A0]/g, '')
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .trim()
      .toUpperCase();
  };

  // Safe date parser
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

  const formatDisplayDateStr = (dateStr: string): string => {
    if (!dateStr || dateStr === '-') return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Metrics calculators
  const getDaysDifference = (endStr: string, startStr: string): number | '-' => {
    if (!endStr || endStr === '-' || !startStr || startStr === '-') return '-';
    const end = parseToDate(endStr);
    const start = parseToDate(startStr);
    if (!end || !start) return '-';
    const diffTime = end.getTime() - start.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getMoraDays = (pagoStr: string, vencimientoStr: string): number | '-' => {
    if (!pagoStr || pagoStr === '-' || !vencimientoStr || vencimientoStr === '-') return '-';
    const pago = parseToDate(pagoStr);
    const vencimiento = parseToDate(vencimientoStr);
    if (!pago || !vencimiento) return '-';
    if (pago > vencimiento) {
      const diffTime = pago.getTime() - vencimiento.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    return '-';
  };

  // Source of Truth CRM Active Links matching Regalo
  const activeLinks = useMemo(() => {
    return transfers.filter(t => t.type === 'regalo');
  }, [transfers]);

  // Load from Supabase on mount
  useEffect(() => {
    const fetchFromSupabase = async () => {
      if (!supabase) return;
      setIsLoadingDb(true);
      try {
        const { data, error } = await supabase
          .from('recaudo_historico')
          .select('*');
        if (error) {
          console.error("Error fetching recaudo_historico:", error);
          toast.error("Error al sincronizar con Supabase.");
        } else if (data) {
          const metaRec = data.find(r => r.id_registro_crm === 'METADATA_RECORD');
          if (metaRec) {
            setMetadata({
              fileName: metaRec.archivo_origen || '-',
              uploadedAtDate: metaRec.fecha_generacion_link || '-',
              uploadedAtTime: metaRec.fecha_vencimiento_link || '-',
              uploaderName: metaRec.cliente || '-',
              uploaderEmail: metaRec.solicitud || '-',
              recordCount: Number(metaRec.valor_liquidacion) || 0
            });
          }
          const filteredRecords = data.filter(r => r.id_registro_crm !== 'METADATA_RECORD');
          setBankRecords(filteredRecords);
          
          try {
            localStorage.setItem('recaudo_historico_local_cache', JSON.stringify(filteredRecords));
          } catch (e) {
            console.error("Local storage sync error:", e);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingDb(false);
      }
    };
    fetchFromSupabase();
  }, []);

  // Save bankRecords to local cache
  useEffect(() => {
    try {
      if (bankRecords && bankRecords.length > 0) {
        localStorage.setItem('recaudo_historico_local_cache', JSON.stringify(bankRecords));
      } else {
        localStorage.removeItem('recaudo_historico_local_cache');
      }
    } catch (e) {
      console.error("Error writing to local storage:", e);
    }
  }, [bankRecords]);

  // Save metadata changes to cache
  useEffect(() => {
    if (metadata) {
      localStorage.setItem('recaudo_excel_metadata_v2', JSON.stringify(metadata));
    } else {
      localStorage.removeItem('recaudo_excel_metadata_v2');
    }
  }, [metadata]);

  // Excel processor
  const processExcelData = async (fileName: string, rawRows: any[]) => {
    try {
      const parseExcelDate = (val: any): string => {
        if (!val) return '-';
        const valStr = String(val).trim();
        if (valStr === '' || valStr === '-') return '-';
        
        const num = Number(valStr);
        if (!isNaN(num) && num > 30000 && num < 60000) {
          const date = new Date((num - 25569) * 86400 * 1000);
          const day = String(date.getUTCDate()).padStart(2, '0');
          const month = String(date.getUTCMonth() + 1).padStart(2, '0');
          const year = date.getUTCFullYear();
          return `${year}-${month}-${day}`;
        }
        
        // Try parsing string date
        const parsed = parseToDate(valStr);
        if (parsed) {
          const d = String(parsed.getDate()).padStart(2, '0');
          const m = String(parsed.getMonth() + 1).padStart(2, '0');
          const y = parsed.getFullYear();
          return `${y}-${m}-${d}`;
        }
        return valStr;
      };

      const parsedRows = rawRows.map((row: any) => {
        const keys = Object.keys(row);
        const getVal = (possibleNames: string[]) => {
          const foundKey = keys.find(k => possibleNames.includes(k.toUpperCase().trim()));
          return foundKey ? row[foundKey] : undefined;
        };

        const solicitud = String(getVal(['SOLICITUD', 'SOLICITUDE', 'SOLICITUDES', 'ID', 'REQ', 'REQUEST']) || '').trim();
        const rawEst = String(getVal(['ESTADO RECIBO', 'ESTADO', 'ESTADO_RECIBO', 'ESTADO_REC_B', 'ESTADO RECIBOS', 'STATUS']) || '').trim().toUpperCase();
        const funcionario = String(getVal(['FUNCIONARIO', 'CAJERO', 'FUNCIONARIO CAJA', 'OFFICER', 'USER']) || 'Desconocido').trim();
        
        const rawFechaLiquidacion = getVal(['FECHA LIQUIDACION', 'FECHA LIQUIDACIÓN', 'FECHA_LIQUIDACION', 'FECHA_LIQUIDACIÓN', 'FEC LIQ']);
        const fechaGeneracion = parseExcelDate(rawFechaLiquidacion);

        const rawFechaLimitePago = getVal(['FECHA LIMITE PAGO', 'FECHA LÍMITE PAGO', 'FECHA_LIMITE_PAGO', 'FECHA LIMITE', 'FEC LIMITE', 'VENCIMIENTO']);
        const fechaVencimiento = parseExcelDate(rawFechaLimitePago);

        const rawFechaPago = getVal(['FECHA PAGO', 'FECHA_PAGO', 'FECHA', 'DATE', 'PAYMENT DATE', 'FECHA DE PAGO']);
        const fechaPago = parseExcelDate(rawFechaPago);

        const rawVlrLiquidacion = getVal(['VLR LIQUIDACION', 'VLR LIQUIDACIÓN', 'VALOR LIQUIDACION', 'VALOR LIQUIDACIÓN', 'VALOR_LIQUIDACION', 'VLR_LIQUIDACION', 'VALOR RECAUDADO', 'VLR RECAUDADO', 'VALOR_RECAUDADO']);
        const valorLiquidacion = rawVlrLiquidacion !== undefined 
          ? (Number(String(rawVlrLiquidacion).replace(/[^0-9.-]/g, '')) || 0) 
          : 0;

        const rawTipoRecaudo = String(getVal(['TIPO RECAUDO', 'TIPO_RECAUDO', 'TIPO', 'TYPE', 'TIPO REC', 'TIPO_REC']) || '').trim().toUpperCase();

        let estadoRecibo = 'LIQUIDACION';
        if (rawEst === 'RECIBO') {
          estadoRecibo = 'RECIBO';
        } else if (rawEst === 'ANULADO') {
          estadoRecibo = 'ANULADO';
        } else if (rawEst === 'LIQUIDACION' || rawEst === 'LIQUIDACIÓN') {
          estadoRecibo = 'LIQUIDACION';
        }

        return { 
          solicitud, 
          estadoRecibo, 
          funcionario, 
          fechaGeneracion, 
          fechaVencimiento, 
          fechaPago, 
          valorLiquidacion,
          tipoRecaudo: rawTipoRecaudo
        };
      }).filter(r => r.solicitud);

      if (parsedRows.length === 0) {
        toast.error('No se encontraron registros válidos de solicitudes en el archivo.');
        return;
      }

      // Read current persistent entries
      const recordsMap = new Map<string, RecaudoHistoricoDB>();
      bankRecords.forEach(r => {
        recordsMap.set(r.id_registro_crm, r);
      });

      // Filter active (Regalo) links that are not already recorded as RECIBO in Supabase
      const eligibleLinks = activeLinks.filter(al => {
        const existing = recordsMap.get(al.id || '');
        return !existing || existing.estado_recibo !== 'RECIBO';
      });

      // Group eligible links by normalized solicitud
      const eligibleLinksGroup = new Map<string, Transfer[]>();
      eligibleLinks.forEach(al => {
        const norm = normalizeSolicitud(al.requestNumber);
        if (!eligibleLinksGroup.has(norm)) {
          eligibleLinksGroup.set(norm, []);
        }
        eligibleLinksGroup.get(norm)!.push(al);
      });

      // Group newly processed Excel rows by normalized solicitud
      const excelGroup = new Map<string, typeof parsedRows>();
      parsedRows.forEach(row => {
        const norm = normalizeSolicitud(row.solicitud);
        if (!excelGroup.has(norm)) {
          excelGroup.set(norm, []);
        }
        excelGroup.get(norm)!.push(row);
      });

      const newUpserts: RecaudoHistoricoDB[] = [];
      let consolidatedPayments = 0;

      // Match 1-to-1 order of appearance per solicitud
      eligibleLinksGroup.forEach((crmLinks, normSol) => {
        const excelRows = excelGroup.get(normSol) || [];
        const N = crmLinks.length;
        const M = excelRows.length;

        for (let i = 0; i < Math.max(N, M); i++) {
          if (i < N) {
            const link = crmLinks[i];
            const hasExisting = recordsMap.get(link.id || '');

            if (i < M) {
              const excelRow = excelRows[i];
              const resolvedRec: RecaudoHistoricoDB = {
                id_registro_crm: link.id || '',
                solicitud: link.requestNumber,
                cliente: link.customerName,
                estado_recibo: excelRow.estadoRecibo,
                valor_link_crm: link.paymentLinkValue || 0,
                valor_liquidacion: excelRow.estadoRecibo === 'RECIBO' ? excelRow.valorLiquidacion : 0,
                funcionario: excelRow.funcionario,
                fecha_generacion_link: excelRow.fechaGeneracion !== '-' ? excelRow.fechaGeneracion : formatGenerateDateString(link.createdAt),
                fecha_vencimiento_link: excelRow.fechaVencimiento,
                fecha_pago: excelRow.estadoRecibo === 'RECIBO' ? excelRow.fechaPago : '-',
                archivo_origen: fileName,
                usuario_importacion: user.email || user.name || 'Usuario',
                tipo_recaudo: excelRow.tipoRecaudo
              };

              newUpserts.push(resolvedRec);
              recordsMap.set(link.id || '', resolvedRec);
              consolidatedPayments++;
            } else {
              // No matching Excel row left to map. Keep prior db status or default to initial state
              if (!hasExisting) {
                const defaultRec: RecaudoHistoricoDB = {
                  id_registro_crm: link.id || '',
                  solicitud: link.requestNumber,
                  cliente: link.customerName,
                  estado_recibo: 'LIQUIDACION',
                  valor_link_crm: link.paymentLinkValue || 0,
                  valor_liquidacion: 0,
                  funcionario: '-',
                  fecha_generacion_link: formatGenerateDateString(link.createdAt),
                  fecha_vencimiento_link: '-',
                  fecha_pago: '-',
                  archivo_origen: '-',
                  usuario_importacion: '-',
                  tipo_recaudo: ''
                };
                newUpserts.push(defaultRec);
                recordsMap.set(link.id || '', defaultRec);
              }
            }
          }
        }
      });

      const nextRecords = Array.from(recordsMap.values());
      setBankRecords(nextRecords);

      if (supabase && newUpserts.length > 0) {
        const { error } = await supabase
          .from('recaudo_historico')
          .upsert(newUpserts, { onConflict: 'id_registro_crm' });

        if (error) {
          console.error("Supabase upsert error:", error);
          toast.error("Error al subir conciliación en Supabase.");
        } else {
          toast.success(`Consolidados ${newUpserts.length} cambios en Supabase.`);
        }
      }

      // Metadata update
      const today = new Date();
      const nextMeta = {
        fileName,
        uploadedAtDate: today.toLocaleDateString('es-CO'),
        uploadedAtTime: today.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        uploaderName: user.name || 'Usuario',
        uploaderEmail: user.email || '',
        recordCount: parsedRows.length
      };
      setMetadata(nextMeta);

      if (supabase) {
        const metadataRecord = {
          id_registro_crm: 'METADATA_RECORD',
          solicitud: nextMeta.uploaderEmail,
          cliente: nextMeta.uploaderName,
          estado_recibo: 'METADATA',
          valor_link_crm: 0,
          valor_liquidacion: nextMeta.recordCount,
          funcionario: '-',
          fecha_generacion_link: nextMeta.uploadedAtDate,
          fecha_vencimiento_link: nextMeta.uploadedAtTime,
          fecha_pago: null,
          archivo_origen: nextMeta.fileName,
          usuario_importacion: user.email || user.name || 'Usuario',
          tipo_recaudo: 'METADATA'
        };

        const { error: metaErr } = await supabase
          .from('recaudo_historico')
          .upsert([metadataRecord], { onConflict: 'id_registro_crm' });

        if (metaErr) {
          console.error("Supabase metadata error:", metaErr);
        }
      }

      const activeCrmIds = new Set(activeLinks.map(al => al.id));
      const totalRecaudo = nextRecords
        .filter(r => r.estado_recibo === 'RECIBO' && String(r.tipo_recaudo || '').trim().toUpperCase() === 'S' && activeCrmIds.has(r.id_registro_crm))
        .reduce((sum, r) => sum + (r.valor_liquidacion || 0), 0);

      setLogs(prev => [
        ...prev,
        `📥 Cargue incremental: ${fileName}`,
        `👤 Uploader: ${user.name || user.email}`,
        `📁 Filas leídas: ${parsedRows.length}`,
        `✅ Conciliaciones efectuadas: ${consolidatedPayments}`,
        `💰 Total Recaudado Acumulado: $${Math.round(totalRecaudo).toLocaleString('es-CO')}`
      ]);

      toast.success('Excel procesado incrementalmente.');

    } catch (err: any) {
      console.error(err);
      toast.error(`Error procesando archivo: ${err.message}`);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv');
      if (!isExcel) {
        toast.error('Formato no soportado. Suba un archivo Excel (.xlsx, .xls) o CSV.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const workbook = XLSX.read(bstr, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rawJson = XLSX.utils.sheet_to_json(sheet);
          processExcelData(file.name, rawJson);
        } catch (err: any) {
          toast.error(`Error de lectura: ${err.message}`);
        }
      };
      reader.readAsBinaryString(file);
    }
  };

  // Reset/Resetear Recaudo handler
  const handleResetRecaudo = async () => {
    const confirmed = window.confirm('¿Está absolutamente seguro de que desea reiniciar el recaudo financiero? Esto eliminará permanentemente la base histórica de Supabase.');
    if (!confirmed) return;

    setIsLoadingDb(true);
    try {
      if (supabase) {
        const { error } = await supabase
          .from('recaudo_historico')
          .delete()
          .neq('id_registro_crm', 'xxx_none_xxx');
        
        if (error) throw error;
      }
      setBankRecords([]);
      setMetadata(null);
      try {
        localStorage.removeItem('recaudo_historico_local_cache');
        localStorage.removeItem('recaudo_excel_metadata_v2');
      } catch (e) {
        console.error("Error cleaning local cache on reset:", e);
      }
      setLogs([`🗑️ [REINICIO] Base de datos vaciada por completo a las ${new Date().toLocaleString('es-CO')}.`]);
      toast.success('Módulo de recaudo reiniciado con éxito.');
    } catch (err: any) {
      console.error(err);
      toast.error(`Error al vaciar base de datos: ${err.message}`);
    } finally {
      setIsLoadingDb(false);
    }
  };

  // Reconciled rows construction linked strictly to activeLinks CRM representation
  const reconciledLinks = useMemo(() => {
    const dbMap = new Map<string, RecaudoHistoricoDB>();
    bankRecords.forEach(r => {
      dbMap.set(r.id_registro_crm, r);
    });

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

      if (match) {
        funcionario = match.funcionario || '-';
        fecha_pago = match.estado_recibo === 'RECIBO' ? match.fecha_pago : '-';
        valor_liquidacion = match.estado_recibo === 'RECIBO' ? (match.valor_liquidacion || 0) : 0;
        fecha_generacion_link = match.fecha_generacion_link || fecha_generacion_link;
        fecha_vencimiento_link = match.fecha_vencimiento_link || '-';
        archivo_origen = match.archivo_origen || '-';
        usuario_importacion = match.usuario_importacion || '-';

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
        tipo_recaudo: match ? (match.tipo_recaudo || '') : ''
      };
    });
  }, [activeLinks, bankRecords]);

  // Mandatory indicators & KPI calculations
  const metricsKpis = useMemo(() => {
    const linksGenerados = activeLinks.length;
    const valueRegistrado = activeLinks.reduce((sum, t) => sum + (t.paymentLinkValue || 0), 0);

    let linksPagados = 0;
    let noPagados = 0;
    let pendientes = 0;
    let recaudoEfectivo = 0;

    reconciledLinks.forEach(item => {
      if (item.estadoCRM === 'PAGADO') {
        linksPagados++;
        if (String(item.tipo_recaudo || '').trim().toUpperCase() === 'S') {
          recaudoEfectivo += item.valor_liquidacion;
        }
      } else if (item.estadoCRM === 'NO PAGADO') {
        noPagados++;
      } else {
        pendientes++;
      }
    });

    const conversion = linksGenerados > 0 ? (linksPagados / linksGenerados) * 100 : 0;

    return {
      linksGenerados,
      valueRegistrado,
      linksPagados,
      noPagados,
      pendientes,
      recaudoEfectivo,
      conversion
    };
  }, [activeLinks, reconciledLinks]);

  // AUDIT ALERT SYSTEM - validations
  const auditValidation = useMemo(() => {
    const dbTotalRecibo = bankRecords
      .filter(r => r.estado_recibo === 'RECIBO')
      .reduce((sum, r) => sum + Number(r.valor_liquidacion || 0), 0);

    // Filter DB entries that actually exist in the CRM system
    const activeCrmIds = new Set(activeLinks.map(al => al.id));
    const dbTotalReciboActiveCrm = bankRecords
      .filter(r => r.estado_recibo === 'RECIBO' && String(r.tipo_recaudo || '').trim().toUpperCase() === 'S' && activeCrmIds.has(r.id_registro_crm))
      .reduce((sum, r) => sum + Number(r.valor_liquidacion || 0), 0);

    const memoryTotalRecaudo = metricsKpis.recaudoEfectivo;
    const difference = Math.abs(memoryTotalRecaudo - dbTotalReciboActiveCrm);

    return {
      hasDiscrepancy: difference > 1,
      dbTotal: dbTotalRecibo,
      crmLinkedDbTotal: dbTotalReciboActiveCrm,
      difference
    };
  }, [bankRecords, activeLinks, metricsKpis.recaudoEfectivo]);

  // Unique lists for Filter dropdowns
  const filterOptions = useMemo(() => {
    const supervisors = new Set<string>();
    const responsables = new Set<string>();
    const emisores = new Set<string>();
    const carteras = new Set<string>();

    activeLinks.forEach(t => {
      if (t.supervisorName) supervisors.add(t.supervisorName.trim());
      if (t.toAdvisorName) responsables.add(t.toAdvisorName.trim());
      if (t.fromAdvisorName) emisores.add(t.fromAdvisorName.trim());
      if (t.cartera) carteras.add(t.cartera.trim());
    });

    return {
      supervisors: Array.from(supervisors).sort(),
      responsables: Array.from(responsables).sort(),
      emisores: Array.from(emisores).sort(),
      carteras: Array.from(carteras).sort()
    };
  }, [activeLinks]);

  // Rankings on RECIBO state only with TIPO RECAUDO = 'S'
  const rankings = useMemo(() => {
    const funcMap: Record<string, number> = {};
    const respMap: Record<string, number> = {};
    const supMap: Record<string, number> = {};
    const cartMap: Record<string, number> = {};

    reconciledLinks.forEach(r => {
      if (r.estadoCRM !== 'PAGADO' || String(r.tipo_recaudo || '').trim().toUpperCase() !== 'S') return;
      const v = r.valor_liquidacion || 0;

      if (r.funcionario && r.funcionario !== '-') {
        funcMap[r.funcionario] = (funcMap[r.funcionario] || 0) + v;
      }
      if (r.responsable && r.responsable !== '-') {
        respMap[r.responsable] = (respMap[r.responsable] || 0) + v;
      }
      if (r.supervisor && r.supervisor !== '-') {
        supMap[r.supervisor] = (supMap[r.supervisor] || 0) + v;
      }
      if (r.cartera && r.cartera !== '-') {
        cartMap[r.cartera] = (cartMap[r.cartera] || 0) + v;
      }
    });

    const sortMap = (m: Record<string, number>) => {
      return Object.entries(m)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    };

    return {
      funcionarios: sortMap(funcMap),
      responsables: sortMap(respMap),
      supervisores: sortMap(supMap),
      carteras: sortMap(cartMap)
    };
  }, [reconciledLinks]);

  // Filter main dataset
  const filteredLinks = useMemo(() => {
    return reconciledLinks.filter(item => {
      // Search
      const matchSearch = 
        String(item.cliente || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(item.solicitud || '').toLowerCase().includes(searchTerm.toLowerCase());

      // Dropdown filters
      const matchEstado = filterEstado === 'todos' || item.estadoCRM === filterEstado;
      const matchSupervisor = filterSupervisor === 'todos' || item.supervisor === filterSupervisor;
      const matchResponsable = filterResponsable === 'todos' || item.responsable === filterResponsable;
      const matchEmisor = filterEmisor === 'todos' || item.emisor === filterEmisor;
      const matchCartera = filterCartera === 'todos' || item.cartera === filterCartera;

      // Dates Generation
      const dGen = parseToDate(item.fecha_generacion_link);
      if (filterGenDesde) {
        const d = new Date(filterGenDesde + 'T00:00:00');
        if (!dGen || dGen < d) return false;
      }
      if (filterGenHasta) {
        const d = new Date(filterGenHasta + 'T23:59:59');
        if (!dGen || dGen > d) return false;
      }

      // Dates Vencimiento
      const dVen = parseToDate(item.fecha_vencimiento_link);
      if (filterVenDesde) {
        const d = new Date(filterVenDesde + 'T00:00:00');
        if (!dVen || dVen < d) return false;
      }
      if (filterVenHasta) {
        const d = new Date(filterVenHasta + 'T23:59:59');
        if (!dVen || dVen > d) return false;
      }

      // Dates Pago
      const dPago = parseToDate(item.fecha_pago);
      if (filterPagoDesde) {
        const d = new Date(filterPagoDesde + 'T00:00:00');
        if (!dPago || dPago < d) return false;
      }
      if (filterPagoHasta) {
        const d = new Date(filterPagoHasta + 'T23:59:59');
        if (!dPago || dPago > d) return false;
      }

      return matchSearch && matchEstado && matchSupervisor && matchResponsable && matchEmisor && matchCartera;
    });
  }, [reconciledLinks, searchTerm, filterEstado, filterSupervisor, filterResponsable, filterEmisor, filterCartera, filterGenDesde, filterGenHasta, filterVenDesde, filterVenHasta, filterPagoDesde, filterPagoHasta]);

  // CSV export
  const exportToCSV = () => {
    if (filteredLinks.length === 0) {
      toast.error('No hay datos calificados para descargar.');
      return;
    }

    const headers = [
      'Cliente', 'Solicitud', 'Fecha Generacion', 'Fecha Vencimiento', 'Fecha Pago', 
      'Estado', 'Valor CRM', 'Valor Recaudado', 'Funcionario', 'Emisor', 
      'Responsable', 'Supervisor', 'Cartera', 'Dias Vencimiento', 'Dias Pago', 'Dias Mora'
    ];

    const rows = filteredLinks.map(item => {
      const dVenc = getDaysDifference(item.fecha_vencimiento_link, item.fecha_generacion_link);
      const dPago = getDaysDifference(item.fecha_pago, item.fecha_generacion_link);
      const dMora = getMoraDays(item.fecha_pago, item.fecha_vencimiento_link);

      return [
        `"${item.cliente || '-'}"`,
        `"${item.solicitud || '-'}"`,
        item.fecha_generacion_link || '-',
        item.fecha_vencimiento_link || '-',
        item.fecha_pago || '-',
        item.estadoCRM,
        Math.round(item.valor_link_crm || 0),
        Math.round(item.valor_liquidacion || 0),
        `"${item.funcionario || '-'}"`,
        `"${item.emisor || '-'}"`,
        `"${item.responsable || '-'}"`,
        `"${item.supervisor || '-'}"`,
        `"${item.cartera || '-'}"`,
        dVenc,
        dPago,
        dMora
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Conciliacion_Seguimiento_Recaudo.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Reporte descargado correctamente.');
  };

  // Reset all filters
  const resetFilters = () => {
    setSearchTerm('');
    setFilterEstado('todos');
    setFilterSupervisor('todos');
    setFilterResponsable('todos');
    setFilterEmisor('todos');
    setFilterCartera('todos');
    setFilterGenDesde('');
    setFilterGenHasta('');
    setFilterVenDesde('');
    setFilterVenHasta('');
    setFilterPagoDesde('');
    setFilterPagoHasta('');
    setCurrentPage(1);
    toast.success('Filtros restablecidos.');
  };

  // Pagination computations
  const totalPages = Math.ceil(filteredLinks.length / itemsPerPage);
  const paginatedLinks = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLinks.slice(start, start + itemsPerPage);
  }, [filteredLinks, currentPage, itemsPerPage]);

  return (
    <div className="space-y-6 pt-1 text-slate-800 dark:text-slate-150 text-left">
      
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-xl font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="p-2 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-500/20 shadow-sm">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            Seguimiento de Recaudo
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Conciliación automática entre enlaces de pago y recaudos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input 
            type="file" 
            id="excel-recaudo-loader" 
            className="hidden" 
            accept=".xlsx,.xls,.csv" 
            onChange={handleFileInput}
          />
          <Button 
            id="btn-upload-recaudo" 
            onClick={() => document.getElementById('excel-recaudo-loader')?.click()}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Cargar Recaudo
          </Button>

          <Button 
            id="btn-recaudo-reset" 
            variant="destructive" 
            size="sm" 
            onClick={handleResetRecaudo}
            className="rounded-xl border border-red-500/20 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-600 dark:hover:bg-red-500 hover:text-white font-bold gap-1.5 text-xs px-4"
          >
            <Trash2 className="w-3.5 h-3.5" /> Reiniciar Recaudo
          </Button>
        </div>
      </div>

      {/* METADATA VIEW */}
      {metadata && (
        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-850 shadow-sm text-xs">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block uppercase font-mono tracking-wider">Archivo procesado</span>
              <p className="font-extrabold text-slate-800 dark:text-slate-300 truncate mt-0.5">{metadata.fileName}</p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block uppercase font-mono tracking-wider">Fecha Recibido</span>
              <p className="font-bold text-slate-800 dark:text-slate-300 mt-0.5">{metadata.uploadedAtDate}</p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block uppercase font-mono tracking-wider">Hora procesamiento</span>
              <p className="font-bold text-slate-800 dark:text-slate-300 mt-0.5">{metadata.uploadedAtTime}</p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block uppercase font-mono tracking-wider">Usuario Gestor</span>
              <p className="font-bold text-slate-800 dark:text-slate-300 truncate mt-0.5">{metadata.uploaderName}</p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block uppercase font-mono tracking-wider">Total Filas Cargadas</span>
              <p className="font-mono text-indigo-600 dark:text-indigo-400 font-black mt-0.5">{metadata.recordCount.toLocaleString()} items</p>
            </div>
          </div>
        </div>
      )}

      {/* AUDIT ALERT */}
      {auditValidation.hasDiscrepancy && (
        <div className="bg-red-50/55 dark:bg-rose-950/20 rounded-xl border border-red-200 dark:border-rose-900/40 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-rose-400 shrink-0 mt-0.5 animate-pulse" />
          <div className="text-xs">
            <h4 className="font-black text-red-800 dark:text-red-400">⚠️ ALERTA DE RECONCILIACIÓN Y AUDITORÍA</h4>
            <p className="text-red-600 dark:text-red-400/80 mt-1">
              Existe una discrepancia financiera de <strong>${Math.round(auditValidation.difference).toLocaleString('es-CO')}</strong> entre el recaudo sumado de los links CRM y los pagos totales de caja en Supabase. Posible causa: existen recaudos registrados sin concordancia directa con links CRM registrados.
            </p>
          </div>
        </div>
      )}

      {/* MAIN INDICATORS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {/* Links Generados */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider block">Links Generados</span>
          <p className="text-2xl font-black mt-2 font-mono text-slate-800 dark:text-slate-100">{metricsKpis.linksGenerados}</p>
          <span className="text-[9px] text-slate-400 mt-1 block">Total CRM Regalo</span>
        </div>

        {/* Valor Registrado CRM */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider block">Valor Registrado</span>
          <p className="text-2xl font-black mt-2 font-mono text-slate-800 dark:text-slate-100 truncate" title={metricsKpis.valueRegistrado.toLocaleString()}>
            ${Math.round(metricsKpis.valueRegistrado).toLocaleString('es-CO')}
          </p>
          <span className="text-[9px] text-slate-400 mt-1 block">Total Registrado</span>
        </div>

        {/* Links Pagados */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-450 tracking-wider block">Links Pagados</span>
          <p className="text-2xl font-black mt-2 font-mono text-emerald-600 dark:text-emerald-450">{metricsKpis.linksPagados}</p>
          <span className="text-[9px] text-slate-400 mt-1 block">Pagados</span>
        </div>

        {/* Recaudo Efectivo */}
        <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 shadow-sm">
          <span className="text-[10px] uppercase font-black text-indigo-600 dark:text-indigo-400 tracking-wider block">Recaudo Efectivo</span>
          <p className="text-2xl font-black mt-2 font-mono text-indigo-600 dark:text-indigo-400 truncate" title={metricsKpis.recaudoEfectivo.toLocaleString()}>
            ${Math.round(metricsKpis.recaudoEfectivo).toLocaleString('es-CO')}
          </p>
          <span className="text-[9px] text-indigo-500 font-bold mt-1 block">Valor Recaudado</span>
        </div>

        {/* No Pagados */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-450 tracking-wider block">No Pagados</span>
          <p className="text-2xl font-black mt-2 font-mono text-rose-600 dark:text-rose-450">{metricsKpis.noPagados}</p>
          <span className="text-[9px] text-slate-400 mt-1 block">Anulados</span>
        </div>

        {/* Pendientes */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider block">Pendientes</span>
          <p className="text-2xl font-black mt-2 font-mono text-amber-600 dark:text-amber-400">{metricsKpis.pendientes}</p>
          <span className="text-[9px] text-slate-400 mt-1 block">Pendientes</span>
        </div>

        {/* Conversion */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-fuchsia-600 dark:text-fuchsia-450 tracking-wider block">Conversión</span>
          <p className="text-2xl font-black mt-2 font-mono text-fuchsia-600 dark:text-fuchsia-450">{metricsKpis.conversion.toFixed(1)}%</p>
          <span className="text-[9px] text-slate-400 mt-1 block">Conversión</span>
        </div>
      </div>

      {/* FILTER PANEL SECTION */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-indigo-500" />
            Filtros Obligatorios de Selección
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={resetFilters}
            className="text-xs gap-1.5 hover:bg-slate-100 rounded-xl px-3 h-8 shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restablecer
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-xs">
          
          {/* SEARCH FIELD */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-bold">Cliente / Solicitud</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <Input 
                placeholder="Buscar cliente..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-8 text-xs font-semibold h-8 rounded-lg"
              />
            </div>
          </div>

          {/* ESTADO */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-bold">Estado</label>
            <select
              value={filterEstado}
              onChange={(e) => { setFilterEstado(e.target.value); setCurrentPage(1); }}
              className="bg-white dark:bg-slate-900 border rounded-lg h-8 px-2 text-xs font-semibold"
            >
              <option value="todos">Todos los Estados</option>
              <option value="PAGADO">PAGADO (RECIBO)</option>
              <option value="NO PAGADO">NO PAGADO (ANULADO)</option>
              <option value="PENDIENTE">PENDIENTE (LIQUIDACION)</option>
            </select>
          </div>

          {/* SUPERVISOR */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-bold">Supervisor</label>
            <select
              value={filterSupervisor}
              onChange={(e) => { setFilterSupervisor(e.target.value); setCurrentPage(1); }}
              className="bg-white dark:bg-slate-900 border rounded-lg h-8 px-2 text-xs font-semibold"
            >
              <option value="todos">Todos los Supervisores</option>
              {filterOptions.supervisors.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* RESPONSABLE */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-bold">Responsable</label>
            <select
              value={filterResponsable}
              onChange={(e) => { setFilterResponsable(e.target.value); setCurrentPage(1); }}
              className="bg-white dark:bg-slate-900 border rounded-lg h-8 px-2 text-xs font-semibold"
            >
              <option value="todos">Todos los Responsables</option>
              {filterOptions.responsables.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* EMISOR */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-bold">Emisor</label>
            <select
              value={filterEmisor}
              onChange={(e) => { setFilterEmisor(e.target.value); setCurrentPage(1); }}
              className="bg-white dark:bg-slate-900 border rounded-lg h-8 px-2 text-xs font-semibold"
            >
              <option value="todos">Todos los Emisores</option>
              {filterOptions.emisores.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* CARTERA */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-bold">Cartera</label>
            <select
              value={filterCartera}
              onChange={(e) => { setFilterCartera(e.target.value); setCurrentPage(1); }}
              className="bg-white dark:bg-slate-900 border rounded-lg h-8 px-2 text-xs font-semibold"
            >
              <option value="todos">Todas las Carteras</option>
              {filterOptions.carteras.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* FECHA GENERACIÓN DESDE */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-bold">F. Gen Desde</label>
            <input 
              type="date"
              value={filterGenDesde}
              onChange={(e) => { setFilterGenDesde(e.target.value); setCurrentPage(1); }}
              className="bg-white dark:bg-slate-900 border rounded-lg h-8 px-2 text-xs font-medium"
            />
          </div>

          {/* FECHA GENERACIÓN HASTA */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-bold">F. Gen Hasta</label>
            <input 
              type="date"
              value={filterGenHasta}
              onChange={(e) => { setFilterGenHasta(e.target.value); setCurrentPage(1); }}
              className="bg-white dark:bg-slate-900 border rounded-lg h-8 px-2 text-xs font-medium"
            />
          </div>

          {/* FECHA VENCIMIENTO DESDE */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-bold">F. Ven Desde</label>
            <input 
              type="date"
              value={filterVenDesde}
              onChange={(e) => { setFilterVenDesde(e.target.value); setCurrentPage(1); }}
              className="bg-white dark:bg-slate-900 border rounded-lg h-8 px-2 text-xs font-medium"
            />
          </div>

          {/* FECHA VENCIMIENTO HASTA */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-bold">F. Ven Hasta</label>
            <input 
              type="date"
              value={filterVenHasta}
              onChange={(e) => { setFilterVenHasta(e.target.value); setCurrentPage(1); }}
              className="bg-white dark:bg-slate-900 border rounded-lg h-8 px-2 text-xs font-medium"
            />
          </div>

          {/* FECHA PAGO DESDE */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-bold">F. Pago Desde</label>
            <input 
              type="date"
              value={filterPagoDesde}
              onChange={(e) => { setFilterPagoDesde(e.target.value); setCurrentPage(1); }}
              className="bg-white dark:bg-slate-900 border rounded-lg h-8 px-2 text-xs font-medium"
            />
          </div>

          {/* FECHA PAGO HASTA */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-bold">F. Pago Hasta</label>
            <input 
              type="date"
              value={filterPagoHasta}
              onChange={(e) => { setFilterPagoHasta(e.target.value); setCurrentPage(1); }}
              className="bg-white dark:bg-slate-900 border rounded-lg h-8 px-2 text-xs font-medium"
            />
          </div>

        </div>
      </div>

      {/* RANKINGS GRID (RECIBO ONLY) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Top Funcionarios */}
        <div className="bg-white dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-left">
          <h4 className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
            <Users className="w-3.5 h-3.5" />
            Top Funcionarios
          </h4>
          {rankings.funcionarios.length === 0 ? (
            <p className="text-[10px] text-slate-400 italic">Sin datos de recaudo.</p>
          ) : (
            <div className="space-y-2">
              {rankings.funcionarios.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs font-semibold">
                  <span>{idx + 1}. {item.name}</span>
                  <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">${Math.round(item.value).toLocaleString('es-CO')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Responsables */}
        <div className="bg-white dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-left">
          <h4 className="text-[10px] font-black uppercase text-sky-600 dark:text-sky-400 flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
            <Award className="w-3.5 h-3.5" />
            Top Responsables
          </h4>
          {rankings.responsables.length === 0 ? (
            <p className="text-[10px] text-slate-400 italic">Sin datos de recaudo.</p>
          ) : (
            <div className="space-y-2">
              {rankings.responsables.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs font-semibold">
                  <span>{idx + 1}. {item.name}</span>
                  <span className="font-mono font-black text-sky-600 dark:text-sky-400">${Math.round(item.value).toLocaleString('es-CO')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Supervisores */}
        <div className="bg-white dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-left">
          <h4 className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
            <Target className="w-3.5 h-3.5" />
            Top Supervisores
          </h4>
          {rankings.supervisores.length === 0 ? (
            <p className="text-[10px] text-slate-400 italic">Sin datos de recaudo.</p>
          ) : (
            <div className="space-y-2">
              {rankings.supervisores.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs font-semibold">
                  <span>{idx + 1}. {item.name}</span>
                  <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">${Math.round(item.value).toLocaleString('es-CO')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Carteras */}
        <div className="bg-white dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-left">
          <h4 className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
            <Briefcase className="w-3.5 h-3.5" />
            Top Carteras
          </h4>
          {rankings.carteras.length === 0 ? (
            <p className="text-[10px] text-slate-400 italic">Sin datos de recaudo.</p>
          ) : (
            <div className="space-y-2">
              {rankings.carteras.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs font-semibold">
                  <span>{idx + 1}. {item.name}</span>
                  <span className="font-mono font-black text-amber-600 dark:text-amber-400">${Math.round(item.value).toLocaleString('es-CO')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* CONSOLE LOGGER */}
      {logs.length > 0 && (
        <div className="bg-slate-950 font-mono text-[10px] text-slate-300 dark:text-slate-400 border border-slate-800 rounded-xl overflow-hidden mt-6 shadow-md">
          <button 
            onClick={() => setIsLogsExpanded(!isLogsExpanded)}
            className="w-full text-left p-3 border-b border-slate-900 bg-slate-900 flex justify-between items-center text-slate-400 font-bold"
          >
            <span className="flex items-center gap-1.5 font-mono"><Terminal className="w-4 h-4 text-indigo-400" /> Historial de Cargues</span>
            <span className="text-indigo-400 bg-slate-800 rounded px-1.5 py-0.5 text-[9px] font-bold">{isLogsExpanded ? 'MINIMIZAR' : 'AMPLIAR'}</span>
          </button>
          
          <AnimatePresence>
            {isLogsExpanded && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="p-4 space-y-1 max-h-[160px] overflow-y-auto"
              >
                {logs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed hover:bg-slate-900/60 py-0.5 px-1 rounded">{log}</div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* CORE RECONCILIATION TABLE */}
      <div className="bg-white dark:bg-slate-900/30 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 text-left space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 font-mono tracking-wider">📜 Detalle de Recaudos</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Detalle consolidado de los enlaces conciliados.</p>
          </div>

          <Button 
            onClick={exportToCSV}
            variant="outline"
            size="sm"
            className="text-xs font-extrabold gap-1 border-slate-200 dark:border-slate-800"
          >
            <FileDown className="w-4 h-4 text-indigo-500" /> Exportar CSV
          </Button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full border-collapse font-mono text-[11px] text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 border-b border-slate-200 dark:border-slate-800/80">
                <th className="p-3 font-extrabold">Cliente</th>
                <th className="p-3 font-extrabold">Solicitud</th>
                <th className="p-3 font-extrabold">F. Generación</th>
                <th className="p-3 font-extrabold">F. Vencimiento</th>
                <th className="p-3 font-extrabold">F. Pago</th>
                <th className="p-3 font-extrabold text-center">Estado</th>
                <th className="p-3 font-extrabold text-right">V. CRM</th>
                <th className="p-3 font-extrabold text-right">V. Recaudado</th>
                <th className="p-3 font-extrabold">Funcionario</th>
                <th className="p-3 font-extrabold">Emisor</th>
                <th className="p-3 font-extrabold">Responsable</th>
                <th className="p-3 font-extrabold">Supervisor</th>
                <th className="p-3 font-extrabold">Cartera</th>
                <th className="p-3 font-extrabold text-center">Días Venc.</th>
                <th className="p-3 font-extrabold text-center">Días Pago</th>
                <th className="p-3 font-extrabold text-center">Mora (Días)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {paginatedLinks.length === 0 ? (
                <tr>
                  <td colSpan={16} className="p-8 text-center text-slate-400 italic">No hay registros coincidentes con los filtros especificados.</td>
                </tr>
              ) : (
                paginatedLinks.map((item, idx) => {
                  let badge = "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40";
                  if (item.estadoCRM === 'PAGADO') {
                    badge = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-250 dark:border-emerald-800/60";
                  } else if (item.estadoCRM === 'NO PAGADO') {
                    badge = "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-450 border border-rose-300 dark:border-rose-900/60";
                  }

                  const dVenc = getDaysDifference(item.fecha_vencimiento_link, item.fecha_generacion_link);
                  const dPago = getDaysDifference(item.fecha_pago, item.fecha_generacion_link);
                  const dMora = getMoraDays(item.fecha_pago, item.fecha_vencimiento_link);

                  return (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-all font-mono">
                      <td className="p-3 font-bold truncate max-w-[130px]" title={item.cliente}>{item.cliente || '-'}</td>
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{item.solicitud || '-'}</td>
                      <td className="p-3">{formatDisplayDateStr(item.fecha_generacion_link)}</td>
                      <td className="p-3">{formatDisplayDateStr(item.fecha_vencimiento_link)}</td>
                      <td className="p-3">{formatDisplayDateStr(item.fecha_pago)}</td>
                      <td className="p-1.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider block mx-auto text-center ${badge}`}>
                          {item.estadoCRM}
                        </span>
                      </td>
                      <td className="p-3 text-right font-semibold text-slate-500">${Math.round(item.valor_link_crm).toLocaleString('es-CO')}</td>
                      <td className="p-3 text-right font-black text-emerald-600 dark:text-emerald-400">${Math.round(item.valor_liquidacion).toLocaleString('es-CO')}</td>
                      <td className="p-3 truncate max-w-[110px]" title={item.funcionario}>{item.funcionario}</td>
                      <td className="p-3 truncate max-w-[110px]" title={item.emisor}>{item.emisor}</td>
                      <td className="p-3 truncate max-w-[110px]" title={item.responsable}>{item.responsable}</td>
                      <td className="p-3 truncate max-w-[110px]" title={item.supervisor}>{item.supervisor}</td>
                      <td className="p-3 uppercase">{item.cartera}</td>
                      <td className="p-3 text-center">{dVenc}</td>
                      <td className="p-3 text-center">{dPago}</td>
                      <td className="p-3 text-center">
                        {dMora !== '-' ? (
                          <span className="bg-red-50 dark:bg-rose-950 px-1.5 py-0.5 rounded text-red-650 dark:text-red-400 font-extrabold">{dMora}</span>
                        ) : '-'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION PANEL */}
        {filteredLinks.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t text-xs text-slate-500 font-mono">
            <div className="flex items-center gap-2">
              <span>Mostrar por página:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="bg-slate-50 dark:bg-slate-900 border rounded px-1.5 py-1 text-[11px] font-semibold"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="h-8 rounded-lg"
              >
                Anterior
              </Button>
              <span>Página <strong>{currentPage}</strong> de <strong>{totalPages || 1}</strong></span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="h-8 rounded-lg"
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
