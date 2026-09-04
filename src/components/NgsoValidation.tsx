import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { db } from '@/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { logError } from '../logger';
import { User } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, XCircle, Clock, ShieldCheck, MessageSquareText, Tag, Loader2 } from 'lucide-react';

type NgsoRedirectConversation = { conversationId: string; topic: string };

type NgsoRedirect = {
  id: string;
  requestNumber: string;
  conversations: NgsoRedirectConversation[];
  tagsRemoved: string[];
  message: string;
  redirectedByName: string;
  redirectedByEmail: string;
  redirectedAt: any;
  status: 'pendiente' | 'aprobado' | 'rechazado';
  validatedByName: string | null;
  validatedAt: any;
  motivo: string | null;
};

interface NgsoValidationProps {
  currentUser: User;
}

export const NgsoValidation: React.FC<NgsoValidationProps> = ({ currentUser }) => {
  const [records, setRecords] = useState<NgsoRedirect[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'ngso_redirects'), orderBy('redirectedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ ...d.data(), id: d.id })) as NgsoRedirect[];
      setRecords(data);
      setLoading(false);
    }, (error) => {
      logError(error, 'NgsoValidation/Sync');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const safeFormatDate = (dateVal: any) => {
    if (!dateVal) return '';
    try {
      const d = typeof dateVal?.toDate === 'function' ? dateVal.toDate() : new Date(dateVal);
      return format(d, "dd 'de' MMMM, yyyy - hh:mm a", { locale: es });
    } catch {
      return '';
    }
  };

  const handleApprove = async (record: NgsoRedirect) => {
    setSavingId(record.id);
    try {
      await updateDoc(doc(db, 'ngso_redirects', record.id), {
        status: 'aprobado',
        validatedByEmail: (currentUser.email || '').toLowerCase(),
        validatedByName: currentUser.name || '',
        validatedAt: serverTimestamp(),
        motivo: null
      });
      toast.success('Solicitud aprobada');
    } catch (e: any) {
      logError(e, 'NgsoValidation/Approve');
      toast.error('No fue posible aprobar la solicitud');
    } finally {
      setSavingId(null);
    }
  };

  const handleReject = async (record: NgsoRedirect) => {
    if (!rejectReason.trim()) {
      toast.error('Escribe el motivo del rechazo');
      return;
    }
    setSavingId(record.id);
    try {
      await updateDoc(doc(db, 'ngso_redirects', record.id), {
        status: 'rechazado',
        validatedByEmail: (currentUser.email || '').toLowerCase(),
        validatedByName: currentUser.name || '',
        validatedAt: serverTimestamp(),
        motivo: rejectReason.trim()
      });
      toast.success('Solicitud rechazada');
      setRejectingId(null);
      setRejectReason('');
    } catch (e: any) {
      logError(e, 'NgsoValidation/Reject');
      toast.error('No fue posible rechazar la solicitud');
    } finally {
      setSavingId(null);
    }
  };

  const statusStyle = (status: string) => {
    if (status === 'aprobado') return 'bg-green-100 text-green-700 dark:bg-green-950/45 dark:text-green-400';
    if (status === 'rechazado') return 'bg-red-100 text-red-700 dark:bg-red-950/45 dark:text-red-400';
    return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/45 dark:text-yellow-400';
  };

  const pendingCount = records.filter(r => r.status === 'pendiente').length;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4 border-2 border-emerald-500/20">
          <ShieldCheck className="w-8 h-8 text-emerald-600" />
        </div>
        <h1 className="text-3xl font-black text-secondary tracking-tight">Validación NGSO</h1>
        <p className="text-muted-foreground mt-2 font-medium">
          Solicitudes redirigidas a NGSO por los asesores {pendingCount > 0 ? `— ${pendingCount} pendiente(s)` : ''}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : records.length === 0 ? (
        <div className="p-20 text-center border-2 border-dashed border-border rounded-[2rem]">
          <p className="text-muted-foreground">Aún no hay solicitudes redirigidas a NGSO.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {records.map(record => (
            <Card key={record.id} className="border-none rounded-[2.5rem] card-shadow overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border/10">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    Solicitud #{record.requestNumber}
                  </CardTitle>
                  <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest ${statusStyle(record.status)}`}>
                    {record.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-8 space-y-5">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <MessageSquareText className="w-3.5 h-3.5" /> Conversaciones ({record.conversations?.length || 0})
                  </p>
                  <div className="space-y-1.5">
                    {(record.conversations || []).map(c => (
                      <div key={c.conversationId} className="bg-muted/30 rounded-xl p-3 text-xs">
                        <p className="font-bold text-secondary dark:text-foreground truncate">{c.topic || 'Sin tópico'}</p>
                        <p className="text-muted-foreground font-mono">{c.conversationId}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {record.tagsRemoved?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" /> Etiquetas quitadas
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {record.tagsRemoved.map(tag => (
                        <span key={tag} className="px-3 py-1 rounded-lg text-[10px] font-black uppercase bg-muted text-muted-foreground">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-slate-50 dark:bg-slate-900/40 rounded-2xl p-4 text-xs font-medium text-secondary dark:text-foreground whitespace-pre-line">
                  {record.message}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider pt-2 border-t border-border/30">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> {record.redirectedByName} · {safeFormatDate(record.redirectedAt)}
                  </span>
                  {record.status !== 'pendiente' && (
                    <span>{record.validatedByName} · {safeFormatDate(record.validatedAt)}</span>
                  )}
                </div>

                {record.status === 'rechazado' && record.motivo && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-2xl p-4 text-xs">
                    <b>Motivo del rechazo:</b> {record.motivo}
                  </div>
                )}

                {record.status === 'pendiente' && (
                  <div className="pt-2 space-y-3">
                    {rejectingId === record.id ? (
                      <div className="space-y-3">
                        <textarea
                          className="w-full min-h-[80px] bg-muted/30 rounded-2xl p-4 text-sm border-none focus:ring-1 focus:ring-primary outline-none"
                          placeholder="Motivo del rechazo..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => { setRejectingId(null); setRejectReason(''); }}
                            className="rounded-xl font-bold"
                          >
                            Cancelar
                          </Button>
                          <Button
                            type="button"
                            onClick={() => handleReject(record)}
                            disabled={savingId === record.id}
                            className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex-1"
                          >
                            {savingId === record.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Rechazo'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <Button
                          type="button"
                          onClick={() => handleApprove(record)}
                          disabled={savingId === record.id}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex-1 flex items-center gap-2"
                        >
                          {savingId === record.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          Aprobar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setRejectingId(record.id)}
                          disabled={savingId === record.id}
                          className="border-red-500/40 text-red-600 hover:bg-red-500/10 rounded-xl font-bold flex-1 flex items-center gap-2"
                        >
                          <XCircle className="w-4 h-4" />
                          Rechazar
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
