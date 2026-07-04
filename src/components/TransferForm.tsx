import React, { useState, useEffect, useMemo } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { MANAGEMENT_TYPES } from '@/constants';
import { toast } from 'sonner';
import { db } from '@/firebase';
import { logError, logWarn } from '../logger';
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { CollectionReference } from 'firebase/firestore';
import { Loader2, Send, Save, User as UserIcon, Phone, FileText, DollarSign, Briefcase, Search, MessageSquare } from 'lucide-react';
import { User, Advisor } from '../types';
import { motion } from 'motion/react';

interface TransferFormProps {
  onSubmit?: (data: any) => void;
  currentUser: User;
  advisors: Advisor[];
}

export const TransferForm: React.FC<TransferFormProps> = ({ onSubmit, currentUser, advisors }) => {
  const [loading, setLoading] = useState(false);
  const [managementType, setManagementType] = useState<string>('');
  const [toAdvisorEmail, setToAdvisorEmail] = useState('');
  const [requestNumber, setRequestNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentValue, setPaymentValue] = useState('');
  const [observations, setObservations] = useState('');
  const [searchAdvisor, setSearchAdvisor] = useState('');
  const [canalGestion, setCanalGestion] = useState<'Llamada' | 'WhatsApp' | ''>('');

  const formatCOP = (valString: string) => {
    if (!valString) return '';
    const num = parseInt(valString, 10);
    if (isNaN(num)) return '';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  const handlePaymentValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    setPaymentValue(rawValue);
  };

  // 🔎 FILTERED & UNIQUE ADVISORS
  const filteredAdvisors = useMemo(() => {
    // 1. Deduplicate by email
    const uniqueAdvisors = advisors.reduce((acc: Advisor[], current) => {
      const x = acc.find(item => item.email?.toLowerCase() === current.email?.toLowerCase());
      if (!x) {
        return acc.concat([current]);
      } else {
        return acc;
      }
    }, []);

    // 1.5. Add virtual NGSO advisor
    const ngsoAdvisor: Advisor = {
      id: 'ngso-virtual',
      name: 'NGSO',
      email: 'lidercartera2@ngsoabogados.com',
      supervisor: 'NGSO',
      supervisorEmail: 'lidercartera2@ngsoabogados.com',
      cartera: 'NGSO',
      role: 'asesor',
      active: true,
      createdAt: new Date()
    };
    
    const combined = [ngsoAdvisor, ...uniqueAdvisors];

    // 2. Filter by active and search
    return combined.filter(a => 
      a.active !== false && (
        (a.name || '').toLowerCase().includes(searchAdvisor.toLowerCase()) ||
        (a.email || '').toLowerCase().includes(searchAdvisor.toLowerCase()) ||
        (a.cartera || '').toLowerCase().includes(searchAdvisor.toLowerCase())
      )
    );
  }, [searchAdvisor, advisors]);

  const selectedToAdvisor = useMemo(() => {
    if ((toAdvisorEmail || '').toLowerCase() === 'lidercartera2@ngsoabogados.com') {
      return {
        id: 'ngso-virtual',
        name: 'NGSO',
        email: 'lidercartera2@ngsoabogados.com',
        supervisor: 'NGSO',
        supervisorEmail: 'lidercartera2@ngsoabogados.com',
        cartera: 'NGSO',
        active: true
      };
    }
    return advisors.find(a => (a.email || '').toLowerCase() === toAdvisorEmail.toLowerCase());
  }, [toAdvisorEmail, advisors]);

  useEffect(() => {
    if (managementType === 'Mensaje (Transferencia de llamada)') {
      setPaymentValue('0');
    }
  }, [managementType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!managementType || !requestNumber || !customerName || !phone || !toAdvisorEmail || !canalGestion) {
      toast.error('Por favor complete los campos obligatorios (*). Recuerde seleccionar el Canal de Gestión.');
      return;
    }

    if (!selectedToAdvisor) {
      toast.error('Asesor de destino no válido');
      return;
    }

    const type = managementType.includes('Mensaje') ? 'mensaje' : 'regalo';
    if (type === 'regalo') {
      const parsedValue = parseFloat(paymentValue || '0');
      if (isNaN(parsedValue) || parsedValue < 1000) {
        toast.error('⚠️ El valor del link debe ser mayor a $1.000 COP.');
        return;
      }
    }

    setLoading(true);
    try {
      const type = managementType.includes('Mensaje') ? 'mensaje' : 'regalo';
      
      const isNgso = (selectedToAdvisor.cartera || '').toUpperCase().trim() === 'NGSO';
      
      const docData = {
        type,
        managementType,
        canalGestion,
        fromAdvisorName: currentUser.name,
        fromAdvisorEmail: currentUser.email.toLowerCase(),
        toAdvisorName: selectedToAdvisor.name,
        toAdvisorEmail: isNgso ? 'lidercartera2@ngsoabogados.com' : selectedToAdvisor.email.toLowerCase(),
        supervisorEmail: isNgso ? 'lidercartera2@ngsoabogados.com' : selectedToAdvisor.supervisorEmail.toLowerCase(),
        supervisorName: isNgso ? 'NGSO' : selectedToAdvisor.supervisor,
        cartera: isNgso ? 'NGSO' : selectedToAdvisor.cartera,
        requestNumber,
        customerName,
        contactPhones: phone,
        paymentLinkValue: parseFloat(paymentValue || '0'),
        observations,
        status: 'pendiente',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: currentUser.email.toLowerCase(),
        createdByName: currentUser.name,
        createdByEmail: currentUser.email.toLowerCase()
      };

      let docRef: any = null;
      let isLocalOnly = false;
      try {
        docRef = await addDoc(collection(db, 'registros'), docData);
      } catch (dbError: any) {
        logError(dbError, "TransferForm/SaveFirestore");
        const isQuota = dbError.code === 'resource-exhausted' || dbError.message?.toLowerCase().includes('quota exceeded') || dbError.message?.toLowerCase().includes('quota-exceeded');
        
        if (isQuota) {
          isLocalOnly = true;
          const localId = 'local-' + Math.random().toString(36).substring(7);
          docRef = { id: localId };
          
          try {
            const cached = localStorage.getItem('cached_registros');
            let parsed = cached ? JSON.parse(cached) : [];
            if (!Array.isArray(parsed)) {
              parsed = [];
            }
            const newLocalData = { 
              ...docData, 
              id: localId, 
              isLocalOnly: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            localStorage.setItem('cached_registros', JSON.stringify([newLocalData, ...parsed]));
            
            // Dispatch a custom event so App state reloads instantly!
            window.dispatchEvent(new CustomEvent('local-registros-updated'));
          } catch (e) {
            logError(e, "TransferForm/SaveLocalRegistry");
          }
        } else {
          throw dbError;
        }
      }
      
      // Intentar enviar el correo mediante la API del servidor
      try {
        const mailRes = await fetch(`${window.location.origin}/api/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(docData)
        });
        
        if (mailRes.ok) {
          toast.success('Notificación enviada por correo', {
            description: `Se envió un aviso a ${isNgso ? 'lidercartera2@ngsoabogados.com' : (type === 'mensaje' ? docData.toAdvisorEmail : docData.supervisorEmail)}`
          });
          
          // Actualizamos el registro en Firestore para marcarlo como notificado visualmente
          if (!isLocalOnly && docRef?.id) {
            await updateDoc(doc(db, 'registros', docRef.id), {
              notified: true,
              notifiedAt: serverTimestamp()
            });
          } else if (isLocalOnly) {
            // Update local storage
            try {
              const cached = localStorage.getItem('cached_registros');
              if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed)) {
                  const updated = parsed.map(t => t.id === docRef.id ? { ...t, notified: true, notifiedAt: new Date().toISOString() } : t);
                  localStorage.setItem('cached_registros', JSON.stringify(updated));
                  window.dispatchEvent(new CustomEvent('local-registros-updated'));
                }
              }
            } catch (e) {
              logError(e, "TransferForm/LocalNotifyUpdate");
            }
          }
        } else {
          let errorData;
          try {
            errorData = await mailRes.json();
          } catch (e) {
            errorData = { error: 'Error desconocido' };
          }
          
          logError(errorData, "TransferForm/SendEmailResponse");
          toast.warning('Registro guardado, pero falló el correo de notificación.');
        }
      } catch (e: any) {
        logError(e, "TransferForm/SendEmailTrigger");
        toast.warning('Registro guardado, pero no fue posible enviar el correo en este momento.');
      }
      
      if (isLocalOnly) {
        toast.warning(type === 'mensaje' 
          ? 'Transferencia registrada localmente' 
          : 'Link de pago registrado localmente',
          {
            description: 'Guardado de respaldo en su navegador. La notificación continuará de forma habitual.'
          }
        );
      } else {
        toast.success(type === 'mensaje' 
          ? 'Transferencia registrada exitosamente' 
          : 'Link de pago registrado exitosamente'
        );
      }

      onSubmit?.(docData);

      // Reset
      setManagementType('');
      setCanalGestion('');
      setRequestNumber('');
      setCustomerName('');
      setPhone('');
      setPaymentValue('');
      setToAdvisorEmail('');
      setObservations('');
      setSearchAdvisor('');

    } catch (error) {
      logError(error, "TransferForm/Submit");
      toast.error("No fue posible guardar la información.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-4 border-2 border-primary/20">
          <Send className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-black text-secondary tracking-tight">Nueva Gestión</h1>
        <p className="text-muted-foreground mt-2 font-medium">Registra una transferencia o link de pago en segundos</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* LEFT: MAIN INFO */}
          <div className="space-y-6">
            <Card className="border-none rounded-[2.5rem] card-shadow overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border/10">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Información de la Gestión
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Tipo de Gestión *</Label>
                  <Select value={managementType} onValueChange={setManagementType}>
                    <SelectTrigger className="h-12 bg-muted/50 border-none rounded-2xl focus:ring-primary shadow-none font-bold">
                      <SelectValue placeholder="Selecciona el tipo" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {MANAGEMENT_TYPES.map(type => (
                        <SelectItem key={type} value={type} className="font-medium">{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Canal de Gestión *</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setCanalGestion('Llamada')}
                      className={`h-12 flex items-center justify-center gap-2 rounded-2xl font-bold transition-all text-sm border-2 ${
                        canalGestion === 'Llamada'
                          ? 'border-primary bg-primary/10 text-primary dark:bg-rose-500/10 dark:border-rose-500 dark:text-rose-400'
                          : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted/75'
                      }`}
                    >
                      <Phone className="w-4 h-4" />
                      Llamada
                    </button>
                    <button
                      type="button"
                      onClick={() => setCanalGestion('WhatsApp')}
                      className={`h-12 flex items-center justify-center gap-2 rounded-2xl font-bold transition-all text-sm border-2 ${
                        canalGestion === 'WhatsApp'
                          ? 'border-primary bg-primary/10 text-primary dark:bg-rose-500/10 dark:border-rose-500 dark:text-rose-400'
                          : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted/75'
                      }`}
                    >
                      <MessageSquare className="w-4 h-4" />
                      WhatsApp
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Número de Solicitud *</Label>
                  <Input 
                    placeholder="Ej: 102938" 
                    className="h-12 bg-muted/50 border-none rounded-2xl focus-visible:ring-primary font-bold"
                    value={requestNumber}
                    onChange={(e) => setRequestNumber(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Valor Link de Pago</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      type="text"
                      placeholder="$0" 
                      disabled={managementType.includes('Mensaje')}
                      className="h-12 bg-muted/50 border-none rounded-2xl pl-10 focus-visible:ring-primary font-bold transition-all disabled:opacity-50"
                      value={paymentValue ? formatCOP(paymentValue) : ''}
                      onChange={handlePaymentValueChange}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none rounded-[2.5rem] card-shadow overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border/10">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Phone className="w-5 h-5 text-primary" />
                  Datos del Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nombre Completo *</Label>
                  <Input 
                    placeholder="Ej: Juan Perez" 
                    className="h-12 bg-muted/50 border-none rounded-2xl focus-visible:ring-primary font-bold"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Teléfono de Contacto *</Label>
                  <Input 
                    placeholder="Ej: 3101234567" 
                    className="h-12 bg-muted/50 border-none rounded-2xl focus-visible:ring-primary font-bold"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: TARGET INFO */}
          <div className="space-y-6">
            <Card className="border-none rounded-[2.5rem] card-shadow overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border/10">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-primary" />
                  Asesor Responsable *
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="space-y-4">
                  {!selectedToAdvisor ? (
                    <>
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Buscar Asesor *</Label>
                      <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input 
                          placeholder="Nombre o correo del asesor..." 
                          className="h-12 pl-10 bg-muted/20 border-2 border-dashed border-border rounded-2xl focus-visible:ring-primary font-bold"
                          value={searchAdvisor}
                          onChange={(e) => setSearchAdvisor(e.target.value)}
                        />
                      </div>
                      
                      <div className="max-h-[220px] overflow-y-auto pr-2 custom-scrollbar space-y-2">
                        {filteredAdvisors.map(adv => {
                          const isNgsoItem = (adv.cartera || '').toUpperCase().trim() === 'NGSO';
                          return (
                            <div 
                              key={adv.id || adv.email}
                              onClick={() => {
                                setToAdvisorEmail(adv.email);
                                setSearchAdvisor('');
                              }}
                              className={`p-4 rounded-2xl border-2 border-transparent hover:border-primary/30 hover:bg-primary/5 cursor-pointer transition-all flex items-center gap-4 ${
                                isNgsoItem 
                                  ? 'bg-emerald-500/5 border-dashed border-emerald-500/30 hover:border-emerald-500/50 hover:bg-emerald-500/10 dark:bg-emerald-950/10' 
                                  : 'bg-muted/10'
                              }`}
                            >
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${
                                isNgsoItem 
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 font-extrabold text-base' 
                                  : 'bg-muted text-muted-foreground'
                              }`}>
                                {isNgsoItem ? '🏢' : (adv.name || '').charAt(0)}
                              </div>
                              <div className="overflow-hidden flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-sm text-secondary truncate uppercase">{adv.name}</p>
                                  {isNgsoItem && (
                                    <span className="text-[9px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase tracking-widest leading-none">
                                      Outsourcing
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground truncate">{adv.email}</p>
                              </div>
                            </div>
                          );
                        })}
                        {filteredAdvisors.length === 0 && (
                          <p className="text-center text-xs text-muted-foreground py-4">No se encontraron asesores.</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Asesor Seleccionado</Label>
                        <Button 
                          type="button" 
                          variant="secondary" 
                          size="sm"
                          onClick={() => {
                            console.log("Resetting advisor selection");
                            setToAdvisorEmail('');
                            setSearchAdvisor('');
                          }}
                          className="text-[10px] font-black uppercase tracking-widest bg-secondary/10 hover:bg-secondary/20 text-secondary border-none rounded-xl h-10 px-5 transition-all shadow-sm"
                        >
                          Cambiar asesor
                        </Button>
                      </div>
                      
                      {(() => {
                        const isNgso = (selectedToAdvisor.cartera || '').toUpperCase().trim() === 'NGSO';
                        if (isNgso) {
                          return (
                            <div className="p-6 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-2 border-emerald-500 dark:border-emerald-600 rounded-[2rem] relative overflow-hidden group shadow-md w-full">
                              <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-5 pointer-events-none">
                                <Briefcase className="w-40 h-40" />
                              </div>
                              
                              <div className="flex items-center gap-4">
                                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center text-xl font-black shadow-lg shadow-emerald-500/20 shrink-0">
                                     🏢
                                  </div>
                                  <div className="overflow-hidden">
                                     <h4 className="text-xl font-black text-secondary dark:text-emerald-400 truncate tracking-tight">🏢 NGSO</h4>
                                     <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 truncate">lidercartera2@ngsoabogados.com</p>
                                  </div>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div className="p-6 bg-primary/5 border-2 border-primary rounded-[2rem] relative overflow-hidden group w-full">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center text-xl font-black shadow-lg shadow-primary/20 shrink-0">
                                   {(selectedToAdvisor.name || '').charAt(0)}
                                </div>
                                <div className="overflow-hidden">
                                   <h4 className="text-xl font-black text-secondary truncate tracking-tight">{selectedToAdvisor.name}</h4>
                                   <p className="text-sm font-bold text-primary/70 truncate">{selectedToAdvisor.email}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="bg-white dark:bg-black/20 p-4 rounded-2xl border border-primary/10 shadow-sm flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                                  <Briefcase className="w-4 h-4 text-orange-500" />
                                </div>
                                <div className="overflow-hidden">
                                  <p className="text-[9px] font-black text-muted-foreground uppercase mb-0.5">Cartera</p>
                                  <p className="font-bold text-xs text-secondary truncate">
                                    {selectedToAdvisor.cartera}
                                  </p>
                                </div>
                              </div>
                              <div className="bg-white dark:bg-black/20 p-4 rounded-2xl border border-primary/10 shadow-sm flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                  <UserIcon className="w-4 h-4 text-blue-500" />
                                </div>
                                <div className="overflow-hidden">
                                  <p className="text-[9px] font-black text-muted-foreground uppercase mb-0.5">Supervisor</p>
                                  <p className="font-bold text-xs text-secondary truncate">{selectedToAdvisor.supervisor}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </motion.div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
               <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Observaciones (Opcional)</Label>
               <textarea 
                  className="w-full min-h-[120px] bg-card rounded-[2rem] p-6 text-sm card-shadow border-none focus:ring-1 focus:ring-primary outline-none custom-scrollbar font-medium"
                  placeholder="Añade detalles relevantes sobre esta gestión..."
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                />
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full h-16 bg-primary hover:bg-primary/90 text-white font-black text-lg rounded-[2rem] shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <Save className="w-6 h-6 mr-2" />
                  Confirmar y Enviar Gestión
                </>
              )}
            </Button>
          </div>

        </div>
      </form>
    </div>
  );
};
