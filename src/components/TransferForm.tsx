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
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { Loader2, Send, Save, User as UserIcon, Phone, FileText, DollarSign, Briefcase, Search } from 'lucide-react';
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

  // 🔎 FILTERED ADVISORS
  const filteredAdvisors = useMemo(() => {
    return advisors.filter(a => 
      a.active !== false && (
        (a.name || '').toLowerCase().includes(searchAdvisor.toLowerCase()) ||
        (a.email || '').toLowerCase().includes(searchAdvisor.toLowerCase())
      )
    );
  }, [searchAdvisor, advisors]);

  const selectedToAdvisor = useMemo(() => 
    advisors.find(a => (a.email || '').toLowerCase() === toAdvisorEmail.toLowerCase()),
  [toAdvisorEmail, advisors]);

  useEffect(() => {
    if (managementType === 'Mensaje (Transferencia de llamada)') {
      setPaymentValue('0');
    }
  }, [managementType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!managementType || !requestNumber || !customerName || !phone || !toAdvisorEmail) {
      toast.error('Por favor complete los campos obligatorios (*)');
      return;
    }

    if (!selectedToAdvisor) {
      toast.error('Asesor de destino no válido');
      return;
    }

    setLoading(true);
    try {
      const type = managementType.includes('Mensaje') ? 'mensaje' : 'regalo';
      
      const docData = {
        type,
        managementType,
        fromAdvisorName: currentUser.name,
        fromAdvisorEmail: currentUser.email.toLowerCase(),
        toAdvisorName: selectedToAdvisor.name,
        toAdvisorEmail: selectedToAdvisor.email.toLowerCase(),
        supervisorEmail: selectedToAdvisor.supervisorEmail.toLowerCase(),
        supervisorName: selectedToAdvisor.supervisor,
        cartera: selectedToAdvisor.cartera,
        requestNumber,
        customerName,
        contactPhones: phone,
        paymentLinkValue: parseFloat(paymentValue || '0'),
        observations,
        status: 'pendiente',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: currentUser.email.toLowerCase()
      };

      const docRef = await addDoc(collection(db, 'registros'), docData);
      
      // Intentar enviar el correo mediante la API del servidor
      try {
        const mailRes = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(docData)
        });
        
        if (mailRes.ok) {
          toast.success('Notificación enviada por correo', {
            description: `Se envió un aviso a ${type === 'mensaje' ? docData.toAdvisorEmail : docData.supervisorEmail}`
          });
          
          // Actualizamos el registro en Firestore para marcarlo como notificado visualmente
          await updateDoc(doc(db, 'registros', docRef.id), {
            notified: true,
            notifiedAt: serverTimestamp()
          });
        } else {
          toast.warning('Registro guardado, pero falló el correo', {
            description: 'Verifica la configuración de Mail en tu Perfil.'
          });
        }
      } catch (e) {
        console.error("Error al disparar el envío de correo:", e);
      }
      
      toast.success(type === 'mensaje' 
        ? 'Transferencia registrada exitosamente' 
        : 'Link de pago registrado exitosamente'
      );

      onSubmit?.(docData);

      // Reset
      setManagementType('');
      setRequestNumber('');
      setCustomerName('');
      setPhone('');
      setPaymentValue('');
      setToAdvisorEmail('');
      setObservations('');
      setSearchAdvisor('');

    } catch (error) {
      console.error("Error saving record:", error);
      toast.error("Error al procesar la gestión");
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
                      type="number"
                      placeholder="0.00" 
                      disabled={managementType.includes('Mensaje')}
                      className="h-12 bg-muted/50 border-none rounded-2xl pl-10 focus-visible:ring-primary font-bold transition-all disabled:opacity-50"
                      value={paymentValue}
                      onChange={(e) => setPaymentValue(e.target.value)}
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
                        {filteredAdvisors.map(adv => (
                          <div 
                            key={adv.id || adv.email}
                            onClick={() => {
                              setToAdvisorEmail(adv.email);
                              setSearchAdvisor('');
                            }}
                            className="p-4 rounded-2xl border-2 border-transparent bg-muted/10 hover:border-primary/30 hover:bg-primary/5 cursor-pointer transition-all flex items-center gap-4"
                          >
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-muted-foreground">
                              {(adv.name || '').charAt(0)}
                            </div>
                            <div className="overflow-hidden">
                              <p className="font-bold text-sm text-secondary truncate uppercase">{adv.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{adv.email}</p>
                            </div>
                          </div>
                        ))}
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
                      
                      <div className="p-6 bg-primary/5 border-2 border-primary rounded-[2rem] relative overflow-hidden group">
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
                              <p className="font-bold text-xs text-secondary truncate">{selectedToAdvisor.cartera}</p>
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
