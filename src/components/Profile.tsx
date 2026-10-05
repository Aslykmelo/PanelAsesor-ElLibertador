import { useState, useEffect } from 'react';
import { User, Transfer, Advisor } from '../types';
import { Button } from '@/components/ui/button';
import { Building2, Mail, Shield, Calendar, Star, Activity, User as UserIcon, Briefcase, AlertCircle, CheckCircle, RefreshCcw, PhoneCall, Pencil, Check as CheckIcon, X as XIcon, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { db } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { todayKey } from '@/lib/itbxCache';
import { useMyDayStats } from '@/lib/useMyDayStats';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MyBitacoras, useMyBitacoras } from '@/components/MyBitacoras';
import { DailyGoals } from '@/components/DailyGoals';
import { BitacorasUpload } from '@/components/BitacorasUpload';
import { AdvisorSearch } from '@/components/AdvisorSearch';
import { BITACORA_UPLOADER_EMAILS, CONTROLLER_EMAILS } from '@/constants';

interface ProfileProps {
  user: User;
  transfers: Transfer[];
  advisors: Advisor[];
}

export function Profile({ user, transfers, advisors }: ProfileProps) {
  const [mailStatus, setMailStatus] = useState<{ emailUserSet: boolean, emailPassSet: boolean } | null>(null);
  const [checking, setChecking] = useState(false);

  const checkMailStatus = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/config-status');
      const data = await res.json();
      setMailStatus(data);
    } catch (e) {
      console.error("Error al verificar estado de correo:", e);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkMailStatus();
  }, []);

  // Extensión ITBX — el asesor la escribe una vez en su perfil; con eso se
  // busca su total de llamadas del día en la caché compartida de ITBX.
  const [editingExtension, setEditingExtension] = useState(false);
  const [extensionInput, setExtensionInput] = useState(user.extension || '');
  const [savingExtension, setSavingExtension] = useState(false);
  // Conversaciones (Infobip) y llamadas (ITBX) del asesor, con el único botón
  // "Actualizar" y su enfriamiento. Ver useMyDayStats.
  const {
    activeConversations,
    closedTodayConversations,
    conversationsError,
    callsFailed,
    itbxDateOptions,
    itbxDate,
    setItbxDate,
    itbxCallTotal,
    itbxAnswered,
    itbxTodayAnswered,
    itbxLoading,
    itbxError,
    refreshing,
    cooldownSecondsLeft,
    handleRefreshAll,
    updatedAt,
  } = useMyDayStats(user);

  const { data: bitacoraDoc } = useMyBitacoras(user.email);
  const todayBitacoras = bitacoraDoc?.days[todayKey()]?.total ?? null;

  useEffect(() => {
    setExtensionInput(user.extension || '');
  }, [user.extension]);

  const saveExtension = async () => {
    const value = extensionInput.trim();
    if (!value) return;
    setSavingExtension(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { extension: value });
      setEditingExtension(false);
      toast.success('Extensión guardada');
    } catch (e) {
      console.error('Error al guardar extensión:', e);
      toast.error('No se pudo guardar la extensión');
    } finally {
      setSavingExtension(false);
    }
  };

  const totalValue = transfers.reduce((acc, t) => acc + (t.paymentLinkValue || 0), 0);
  const totalGestiones = transfers.length;

  const roleLabel = (user.role === 'admin' || user.email === 'taliana.moreno@segurosbolivar.com') ? 'Administrador' : user.role === 'supervisor' ? 'Supervisor' : 'Asesor Corporativo';
  
  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
      
      {/* PROFILE HEADER CARD */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        <Card className="relative bg-card border-none rounded-2xl overflow-hidden card-shadow">
          <div className="h-48 bg-secondary relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/40 via-transparent to-transparent opacity-50" />
            <div className="absolute top-10 right-10 flex gap-2">
              <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                Miembro Activo
              </div>
            </div>
          </div>
          
          <CardContent className="px-8 pb-12 -mt-20 relative z-10">
            <div className="flex flex-col md:flex-row items-end gap-8">
              <div className="relative">
                <div className="w-40 h-40 rounded-2xl bg-background border-8 border-background card-shadow overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <UserIcon className="w-20 h-20 text-muted-foreground" />
                  )}
                </div>
                <div className="absolute bottom-4 -right-2 w-10 h-10 bg-green-500 border-4 border-background rounded-full flex items-center justify-center shadow-lg">
                  <Activity className="w-5 h-5 text-white animate-pulse" />
                </div>
              </div>
              
              <div className="flex-1 text-center md:text-left pb-4">
                <h1 className="text-2xl font-black text-secondary tracking-tight">{user.name}</h1>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-3">
                  <span className="bg-primary text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-[0.2em] shadow-lg shadow-primary/20">
                    {roleLabel}
                  </span>
                  <div className="h-1 w-1 bg-muted-foreground rounded-full hidden md:block" />
                  <p className="text-muted-foreground font-bold flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    Seguros Bolívar S.A.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pb-4">
                <motion.div whileHover={{ y: -5 }} className="text-center p-4 bg-muted/30 rounded-3xl min-w-[100px]">
                  <p className="text-2xl font-black text-secondary">{totalGestiones}</p>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Gestiones</p>
                </motion.div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DETAILED INFO & METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* PERSONAL INFO */}
        <div className="md:col-span-1 space-y-8">
          <section className="bg-card rounded-2xl p-5 card-shadow space-y-6">
            <h3 className="text-lg font-black text-secondary flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-primary" />
              Info Personal
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Correo Corporativo</p>
                  <p className="font-bold text-secondary break-all">{user.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Supervisor Asignado</p>
                  <p className="font-bold text-secondary">{user.supervisorName}</p>
                  <p className="text-xs text-muted-foreground">{user.supervisorEmail}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Cartera / Portafolio</p>
                  <p className="font-bold text-secondary">{user.cartera}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Miembro Desde</p>
                  <p className="font-bold text-secondary">
                    {user.createdAt ? format(user.createdAt.toDate?.() || user.createdAt, "MMMM yyyy", { locale: es }) : 'Abril 2024'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Extensión (ITBX)</p>
                  {editingExtension ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        value={extensionInput}
                        onChange={(e) => setExtensionInput(e.target.value)}
                        placeholder="Ej: 1234"
                        className="h-8 text-sm font-bold max-w-[120px]"
                        disabled={savingExtension}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full text-emerald-600"
                        onClick={saveExtension}
                        disabled={savingExtension || !extensionInput.trim()}
                      >
                        <CheckIcon className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full text-muted-foreground"
                        onClick={() => { setEditingExtension(false); setExtensionInput(user.extension || ''); }}
                        disabled={savingExtension}
                      >
                        <XIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-secondary">{user.extension || 'Sin registrar'}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full"
                        onClick={() => setEditingExtension(true)}
                      >
                        <Pencil className="w-3 h-3 text-muted-foreground" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* SERVIDOR DE CORREO STATUS */}
              <div className="pt-4 mt-4 border-t border-border/50">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Servidor de Correo</p>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 rounded-full" 
                    onClick={checkMailStatus}
                    disabled={checking}
                  >
                    <RefreshCcw className={cn("w-3 h-3 text-muted-foreground", checking && "animate-spin")} />
                  </Button>
                </div>
                
                <div className="space-y-3">
                  <div className={cn(
                    "flex items-center gap-3 p-3 rounded-2xl border transition-colors",
                    mailStatus?.emailUserSet ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"
                  )}>
                    {mailStatus?.emailUserSet ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-tight text-secondary">
                      {mailStatus?.emailUserSet ? "Usuario Configurado" : "Falta EMAIL_USER"}
                    </span>
                  </div>

                  <div className={cn(
                    "flex items-center gap-3 p-3 rounded-2xl border transition-colors",
                    mailStatus?.emailPassSet ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"
                  )}>
                    {mailStatus?.emailPassSet ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-tight text-secondary">
                      {mailStatus?.emailPassSet ? "Contraseña Lista" : "Falta EMAIL_PASS"}
                    </span>
                  </div>

                  {!mailStatus?.emailUserSet || !mailStatus?.emailPassSet ? (
                    <p className="text-[9px] text-muted-foreground leading-relaxed px-1">
                      ⚠️ Correos desactivados. Configura EMAIL_USER y EMAIL_PASS en Settings para activar.
                    </p>
                  ) : (
                    <p className="text-[9px] text-green-600 font-bold leading-relaxed px-1">
                      ✅ ¡Listo! Los correos se enviarán automáticamente.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

        </div>

        {/* PERFORMANCE METRICS */}
        <div className="md:col-span-2 space-y-8">
          <DailyGoals
            user={user}
            calls={user.extension ? itbxTodayAnswered : null}
            conversations={closedTodayConversations}
            bitacoras={todayBitacoras}
            refreshing={refreshing}
            cooldownLeft={cooldownSecondsLeft}
            onRefresh={handleRefreshAll}
            callsError={callsFailed}
            conversationsError={conversationsError}
            updatedAt={updatedAt}
          />

          <section className="bg-card rounded-2xl p-5 card-shadow">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-secondary">Estadísticas Consolidadas</h3>
              <div className="px-4 py-1.5 bg-primary/10 rounded-full text-[10px] md:text-xs font-black text-primary uppercase tracking-widest">
                En tiempo real
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl bg-muted/20 border border-border/50 hover:border-primary/20 transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:rotate-12 transition-transform">
                  <Activity className="w-6 h-6 text-primary" />
                </div>
                <p className="text-2xl font-black text-secondary">{totalGestiones}</p>
                <p className="text-sm font-bold text-muted-foreground uppercase mt-1">Gestiones Realizadas</p>
              </div>

              <div className="p-5 rounded-2xl bg-muted/20 border border-border/50 hover:border-secondary/20 transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center mb-4 group-hover:rotate-12 transition-transform">
                  <Shield className="w-6 h-6 text-secondary" />
                </div>
                <p className="text-2xl font-black text-secondary">
                  ${Math.round(totalValue).toLocaleString('es-CO')}
                </p>
                <p className="text-sm font-bold text-muted-foreground uppercase mt-1">Valor Total en Links</p>
              </div>

              <div className="p-5 rounded-2xl bg-muted/20 border border-border/50 hover:border-primary/20 transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:rotate-12 transition-transform">
                  <PhoneCall className="w-6 h-6 text-primary" />
                </div>
                <p className="text-2xl font-black text-secondary">{activeConversations ?? '—'}</p>
                <p className="text-sm font-bold text-muted-foreground uppercase mt-1">Conversaciones Activas Ahora</p>
              </div>

              <div className="p-5 rounded-2xl bg-muted/20 border border-border/50 hover:border-emerald-500/20 transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:rotate-12 transition-transform">
                  <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-2xl font-black text-secondary">{closedTodayConversations ?? '—'}</p>
                <p className="text-sm font-bold text-muted-foreground uppercase mt-1">Conversaciones Cerradas Hoy</p>
              </div>

              <div className="p-5 rounded-2xl bg-muted/20 border border-border/50 hover:border-primary/20 transition-all group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:rotate-12 transition-transform">
                    <Phone className="w-6 h-6 text-primary" />
                  </div>
                  {user.extension && (
                    <Select value={itbxDate} onValueChange={setItbxDate}>
                      <SelectTrigger className="h-6 w-auto px-2 rounded-full text-[9px] font-bold border-none bg-transparent gap-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {itbxDateOptions.map(opt => (
                          <SelectItem key={opt.key} value={opt.key} className="text-xs font-medium">{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {!user.extension ? (
                  <>
                    <p className="text-2xl font-black text-secondary">—</p>
                    <p className="text-sm font-bold text-muted-foreground uppercase mt-1">Llamadas (ITBX)</p>
                    <p className="text-[10px] text-muted-foreground font-medium mt-1">Registra tu extensión para ver este dato</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-black text-secondary">
                      {itbxLoading ? '...' : itbxError ? '—' : itbxCallTotal ?? '—'}
                    </p>
                    <p className="text-sm font-bold text-muted-foreground uppercase mt-1">
                      {itbxError ? 'Llamadas (ITBX) — error' : 'Llamadas (ITBX)'}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-medium mt-1">Extensión {user.extension}</p>
                  </>
                )}
              </div>

              <div className="p-5 rounded-2xl bg-muted/20 border border-border/50 hover:border-emerald-500/20 transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:rotate-12 transition-transform">
                  <PhoneCall className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-2xl font-black text-secondary">
                  {!user.extension || itbxLoading || itbxError ? (itbxLoading && user.extension ? '...' : '—') : itbxAnswered ?? '—'}
                </p>
                <p className="text-sm font-bold text-muted-foreground uppercase mt-1">Llamadas Contestadas</p>
                <p className="text-[10px] text-muted-foreground font-medium mt-1">
                  {user.extension ? 'Según el día elegido en la tarjeta de al lado' : 'Registra tu extensión para ver este dato'}
                </p>
              </div>

            </div>
          </section>

          <MyBitacoras email={user.email} />

          {CONTROLLER_EMAILS.includes((user.email || '').toLowerCase()) && (
            <AdvisorSearch advisors={advisors} />
          )}

          {BITACORA_UPLOADER_EMAILS.includes((user.email || '').toLowerCase()) && (
            <BitacorasUpload currentUser={user} />
          )}
        </div>

      </div>
    </div>
  );
}
