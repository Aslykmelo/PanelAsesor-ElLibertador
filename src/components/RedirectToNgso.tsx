import React, { useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { db } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { logError } from '../logger';
import { User } from '../types';
import { Loader2, Search, Tag, Send, CheckCircle2, AlertTriangle, MessageSquareText } from 'lucide-react';

type ConversationMatch = { id: string; contactName: string | null; status: string; agentId: string | null };

interface RedirectToNgsoProps {
  currentUser: User;
}

const DEFAULT_NGSO_MESSAGE = `¡Buen día, Apreciado cliente!

Reciba un cordial saludo;

Le informamos, que en este momento el gestor de cobro de su obligación pendiente es NGSO, con quién se podrá comunicar a los siguientes números de contacto:

🟢PBX 601-4320170 - 3023437566 en los horarios de Lunes a Viernes de 8 a 5

.
Muchas gracias por haberse comunicado con nosotros. ¡Qué tenga un feliz día!`;

export const RedirectToNgso: React.FC<RedirectToNgsoProps> = ({ currentUser }) => {
  const [requestNumber, setRequestNumber] = useState('');
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<ConversationMatch[] | null>(null);
  const [selectedConversationIds, setSelectedConversationIds] = useState<Set<string>>(new Set());
  const [tagsByConversation, setTagsByConversation] = useState<Record<string, string[]>>({});
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState(DEFAULT_NGSO_MESSAGE);
  const [sending, setSending] = useState(false);

  const resetSearch = () => {
    setMatches(null);
    setSelectedConversationIds(new Set());
    setTagsByConversation({});
    setSelectedTags(new Set());
  };

  const availableTags = useMemo(() => {
    const names = new Map<string, string>();
    selectedConversationIds.forEach(id => {
      (tagsByConversation[id] || []).forEach(t => names.set(t, t));
    });
    return Array.from(names.values()).sort();
  }, [tagsByConversation, selectedConversationIds]);

  const handleSearch = async () => {
    const solicitud = requestNumber.trim();
    if (!solicitud) {
      toast.error('Ingresa el número de solicitud');
      return;
    }

    setSearching(true);
    resetSearch();
    try {
      const res = await fetch(`${window.location.origin}/api/ngso/search?requestNumber=${encodeURIComponent(solicitud)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'No fue posible buscar la solicitud');
      }

      const found: ConversationMatch[] = data.conversations || [];
      setMatches(found);

      if (found.length === 0) {
        toast.warning('No se encontraron conversaciones abiertas de Infobip con esa solicitud.');
        return;
      }

      const allIds = new Set(found.map(c => c.id));
      setSelectedConversationIds(allIds);

      const tagEntries = await Promise.all(
        found.map(async (c) => {
          try {
            const tagsRes = await fetch(`${window.location.origin}/api/ngso/conversation/${encodeURIComponent(c.id)}/tags`);
            const tagsData = await tagsRes.json();
            return [c.id, tagsRes.ok ? (tagsData.tags || []) : []] as const;
          } catch {
            return [c.id, []] as const;
          }
        })
      );
      setTagsByConversation(Object.fromEntries(tagEntries));
    } catch (e: any) {
      logError(e, 'RedirectToNgso/Search');
      toast.error(e.message || 'No fue posible buscar la solicitud');
    } finally {
      setSearching(false);
    }
  };

  const toggleConversation = (id: string) => {
    setSelectedConversationIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTag = (name: string) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleRedirect = () => {
    if (selectedConversationIds.size === 0) {
      toast.error('Selecciona al menos una conversación');
      return;
    }
    if (!message.trim()) {
      toast.error('Escribe el mensaje que recibirá el cliente');
      return;
    }

    toast.warning(`¿Enviar la solicitud #${requestNumber.trim()} a NGSO para aprobación?`, {
      description: 'Todavía no se le avisa al cliente ni se quitan etiquetas — eso pasa solo si un aprobador confirma la solicitud en Validación NGSO.',
      action: {
        label: 'Enviar para aprobación',
        onClick: () => doSubmitForApproval()
      },
      cancel: {
        label: 'Cancelar'
      }
    });
  };

  const doSubmitForApproval = async () => {
    const conversationIds = Array.from(selectedConversationIds);
    const tagNamesToRemove = Array.from(selectedTags);
    const solicitud = requestNumber.trim();

    setSending(true);
    try {
      await addDoc(collection(db, 'ngso_redirects'), {
        requestNumber: solicitud,
        conversations: (matches || [])
          .filter(m => conversationIds.includes(m.id))
          .map(m => ({ conversationId: m.id, contactName: m.contactName || '' })),
        tagsToRemove: tagNamesToRemove,
        message: message.trim(),
        redirectedByEmail: (currentUser.email || '').toLowerCase(),
        redirectedByName: currentUser.name || '',
        redirectedAt: serverTimestamp(),
        status: 'pendiente',
        validatedByEmail: null,
        validatedByName: null,
        validatedAt: null,
        motivo: null,
        executionResults: null
      });

      toast.success('Solicitud enviada para aprobación de NGSO');
      setRequestNumber('');
      setMessage(DEFAULT_NGSO_MESSAGE);
      resetSearch();
    } catch (e: any) {
      logError(e, 'RedirectToNgso/SubmitForApproval');
      toast.error(e.message || 'No fue posible enviar la solicitud para aprobación');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4 border-2 border-emerald-500/20">
          <span className="text-3xl">🏢</span>
        </div>
        <h1 className="text-3xl font-black text-secondary tracking-tight">Redirigir a NGSO</h1>
        <p className="text-muted-foreground mt-2 font-medium">
          Envía la solicitud para aprobación: el aviso al cliente y el retiro de etiquetas solo ocurren si un aprobador la confirma en Validación NGSO
        </p>
      </div>

      <div className="space-y-6">
        <Card className="border-none rounded-[2.5rem] card-shadow overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border/10">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" />
              Número de Solicitud
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Solicitud *</Label>
              <div className="flex gap-3">
                <Input
                  placeholder="Ej: 10192516"
                  className="h-12 bg-muted/50 border-none rounded-2xl focus-visible:ring-primary font-mono text-sm"
                  value={requestNumber}
                  onChange={(e) => setRequestNumber(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                />
                <Button
                  type="button"
                  onClick={handleSearch}
                  disabled={searching}
                  className="h-12 px-6 rounded-2xl bg-secondary hover:bg-secondary/90 text-white font-bold shrink-0"
                >
                  {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Buscar'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground ml-1">
                Busca todas las conversaciones abiertas en Infobip que tengan este número de solicitud (puede haber más de una).
              </p>
            </div>
          </CardContent>
        </Card>

        {matches !== null && matches.length > 0 && (
          <Card className="border-none rounded-[2.5rem] card-shadow overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/10">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <MessageSquareText className="w-5 h-5 text-primary" />
                Conversaciones Encontradas ({matches.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-3">
              <p className="text-xs text-muted-foreground">Desmarca alguna si no corresponde a esta solicitud.</p>
              {matches.map(m => {
                const isSelected = selectedConversationIds.has(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleConversation(m.id)}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-transparent bg-muted/40 opacity-60 hover:opacity-100'
                    }`}
                  >
                    {isSelected ? (
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/40 shrink-0 mt-0.5" />
                    )}
                    <div className="overflow-hidden">
                      <p className="text-sm font-bold text-secondary dark:text-foreground truncate">{m.contactName || 'Sin nombre'}</p>
                      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mt-0.5">
                        {m.status} · ID: {m.id}
                      </p>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        )}

        {matches !== null && availableTags.length > 0 && (
          <Card className="border-none rounded-[2.5rem] card-shadow overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/10">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Tag className="w-5 h-5 text-primary" />
                Etiquetas a Quitar
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-4">
              <p className="text-xs text-muted-foreground">Marca la etiqueta del asesor y la de compañía asesor (o cualquier otra que corresponda quitar). Solo se quitará de los contactos que realmente la tengan. El atributo "Agente_campaña" del contacto se vacía automáticamente al redirigir.</p>
              <div className="flex flex-wrap gap-2">
                {availableTags.map(name => {
                  const isSelected = selectedTags.has(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleTag(name)}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 flex items-center gap-2 ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted/75'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {name}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-none rounded-[2.5rem] card-shadow overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border/10">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Mensaje para el Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-4">
            <textarea
              className="w-full min-h-[140px] bg-muted/30 rounded-[2rem] p-6 text-sm border-none focus:ring-1 focus:ring-primary outline-none custom-scrollbar font-medium"
              placeholder="Escribe aquí el mensaje exacto que recibirá el cliente..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Este es el mensaje que recibirá el cliente por Infobip, pero solo se envía cuando un aprobador confirme la solicitud. Revísalo antes de enviarla.</span>
            </div>
          </CardContent>
        </Card>

        <Button
          type="button"
          onClick={handleRedirect}
          disabled={sending || selectedConversationIds.size === 0 || !message.trim()}
          className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-[2rem] shadow-xl shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          {sending ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              <Send className="w-6 h-6 mr-2" />
              Enviar para Aprobación {selectedConversationIds.size > 0 ? `(${selectedConversationIds.size})` : ''}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
