import { useState, useEffect } from 'react';
import { User, Transfer } from '../types';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Mail,
  Shield,
  Calendar,
  Trophy,
  Star,
  Activity,
  User as UserIcon,
  Briefcase,
  Award,
  AlertCircle,
  CheckCircle,
  RefreshCcw,
  PhoneCall
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useRef } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { db } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const CONVERSATION_COUNT_POLL_MS = 30000;

interface ProfileProps {
  user: User;
  transfers: Transfer[];
}

export function Profile({ user, transfers }: ProfileProps) {
  const certificateRef = useRef<HTMLDivElement>(null);
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

  const [activeConversations, setActiveConversations] = useState<number | null>(null);
  const [checkingConversations, setCheckingConversations] = useState(false);

  const checkActiveConversations = async () => {
    if (!user.email) return;
    setCheckingConversations(true);
    try {
      const res = await fetch(`/api/ngso/my-conversation-count?email=${encodeURIComponent(user.email)}&name=${encodeURIComponent(user.name || '')}`);
      const data = await res.json();
      setActiveConversations(res.ok ? data.count : null);
    } catch (e) {
      console.error("Error al consultar conversaciones activas:", e);
    } finally {
      setCheckingConversations(false);
    }
  };

  useEffect(() => {
    checkActiveConversations();
    const interval = setInterval(checkActiveConversations, CONVERSATION_COUNT_POLL_MS);
    return () => clearInterval(interval);
  }, [user.email]);

  // Total de llamadas que sube el equipo Controller — el asesor solo ve el
  // suyo (así lo restringen las reglas de Firestore: solo su propio correo).
  const [callTotal, setCallTotal] = useState<number | null>(null);

  useEffect(() => {
    if (!user.email) return;
    const unsubscribe = onSnapshot(
      doc(db, 'call_totals', user.email.toLowerCase()),
      (snap) => setCallTotal(snap.exists() ? (snap.data().totalCalls ?? null) : null),
      () => setCallTotal(null)
    );
    return () => unsubscribe();
  }, [user.email]);

  const totalValue = transfers.reduce((acc, t) => acc + (t.paymentLinkValue || 0), 0);
  const totalGestiones = transfers.length;

  const downloadCertificate = async () => {
    if (!certificateRef.current) return;
    
    const toastId = toast.loading('Generando reconocimiento premium...');
    
    try {
      // Pequeña espera para asegurar renderizado
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const canvas = await html2canvas(certificateRef.current, {
        scale: 3, // Mayor calidad
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
      pdf.save(`Reconocimiento_Libertador_${(user.name || 'Asesor').split(' ')[0]}.pdf`);
      
      toast.dismiss(toastId);
      toast.success('¡Reconocimiento descargado con éxito!');
    } catch (error) {
      console.error('Cert error:', error);
      toast.dismiss(toastId);
      toast.error('Error al generar el certificado');
    }
  };

  const roleLabel = (user.role === 'admin' || user.email === 'taliana.moreno@segurosbolivar.com') ? 'Administrador' : user.role === 'supervisor' ? 'Supervisor' : 'Asesor Corporativo';
  
  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
      
      {/* HIDDEN CERTIFICATE FOR DOM CAPTURE */}
      <div className="absolute top-0 left-0 -z-50 pointer-events-none overflow-hidden h-0 w-0">
        <div 
          ref={certificateRef}
          className="w-[1123px] h-[794px] bg-white p-12 flex flex-col items-center justify-between border-[24px] border-[#153157] relative"
        >
          {/* Decorative Corner Patters */}
          <div className="absolute top-0 right-0 w-48 h-48 border-t-[12px] border-r-[12px] border-[#a1161b] m-8" />
          <div className="absolute bottom-0 left-0 w-48 h-48 border-b-[12px] border-l-[12px] border-[#a1161b] m-8" />
          
          {/* Header */}
          <div className="text-center space-y-4 w-full pt-8">
             <div className="flex justify-center items-center gap-4 mb-4">
               <div className="h-1 w-32 bg-[#a1161b]" />
               <Star className="text-[#a1161b] w-8 h-8 fill-[#a1161b]" />
               <div className="h-1 w-32 bg-[#a1161b]" />
             </div>
             <h1 className="text-[#153157] text-2xl font-bold tracking-[0.8em] uppercase">Mención de Honor</h1>
             <h2 className="text-[#153157] text-7xl font-black italic uppercase tracking-tighter">El Libertador</h2>
             <p className="text-[#a1161b] font-black tracking-[0.3em] uppercase">Seguros Bolívar S.A.</p>
          </div>

          {/* Main Content */}
          <div className="text-center space-y-8 flex-1 flex flex-col justify-center">
            <p className="text-2xl text-slate-400 font-medium">Se otorga con orgullo el presente reconocimiento a:</p>
            <div className="space-y-2">
              <h3 className="text-8xl font-black text-[#153157] uppercase tracking-tight leading-none px-4">{user.name}</h3>
              <div className="h-2 w-full bg-gradient-to-r from-transparent via-[#a1161b] to-transparent max-w-3xl mx-auto" />
            </div>
            <p className="text-2xl text-slate-600 max-w-3xl mx-auto italic leading-relaxed">
              "Por su compromiso excepcional, liderazgo inspirador y resultados sobresalientes 
              en la gestión de carteras y transferencias corporativas."
            </p>
          </div>

          {/* Footer */}
          <div className="w-full flex justify-between items-end px-20 pb-12">
            <div className="text-center space-y-3">
              <div className="w-56 h-0.5 bg-[#153157]" />
              <p className="text-sm font-black text-[#153157] uppercase tracking-wider">Dirección Nacional</p>
            </div>
            
            <div className="relative">
               <div className="w-40 h-40 bg-[#153157] rounded-full flex items-center justify-center border-8 border-white shadow-2xl scale-110">
                  <Trophy className="w-24 h-24 text-[#a1161b]" />
               </div>
               <div className="absolute -top-4 -right-4 w-12 h-12 bg-[#a1161b] rounded-full border-4 border-white flex items-center justify-center">
                  <Star className="text-white w-6 h-6 fill-white" />
               </div>
            </div>

            <div className="text-center space-y-3">
              <div className="w-56 h-0.5 bg-[#153157]" />
              <p className="text-sm font-black text-[#153157] uppercase tracking-wider">Gestión Humana</p>
            </div>
          </div>
          
          {/* Watermark Background */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex items-center justify-center">
             <Trophy className="w-[600px] h-[600px] text-[#153157]" />
          </div>
        </div>
      </div>

      {/* PROFILE HEADER CARD */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-[3rem] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        <Card className="relative bg-card border-none rounded-[3rem] overflow-hidden card-shadow">
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
                <div className="w-40 h-40 rounded-[2.5rem] bg-background border-8 border-background card-shadow overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
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
                <h1 className="text-4xl font-black text-secondary tracking-tight">{user.name}</h1>
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
                <motion.div whileHover={{ y: -5 }} className="text-center p-4 bg-muted/30 rounded-3xl min-w-[100px]">
                  <p className="text-2xl font-black text-primary">LVL 4</p>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Progreso</p>
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
          <section className="bg-card rounded-[2.5rem] p-8 card-shadow space-y-6">
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

          <Card className="bg-secondary rounded-[2.5rem] p-8 border-none text-white relative overflow-hidden group shadow-xl shadow-secondary/20">
            <Trophy className="absolute top-4 right-4 w-16 h-16 text-white/5 group-hover:scale-125 transition-transform duration-700" />
            <div className="relative z-10">
              <h3 className="text-xl font-black mb-2">Mi Logro</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                "El éxito es la suma de pequeños esfuerzos repetidos día tras día."
              </p>
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-bold">
                  <span className="uppercase">Eficiencia Mensual</span>
                  <span>92%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full">
                  <div className="h-full bg-primary w-[92%] rounded-full shadow-[0_0_10px_rgba(161,22,27,0.5)]" />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* PERFORMANCE METRICS */}
        <div className="md:col-span-2 space-y-8">
          <section className="bg-card rounded-[2.5rem] p-8 card-shadow">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-secondary">Estadísticas Consolidadas</h3>
              <div className="px-4 py-1.5 bg-primary/10 rounded-full text-[10px] md:text-xs font-black text-primary uppercase tracking-widest">
                En tiempo real
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-8 rounded-[2rem] bg-muted/20 border border-border/50 hover:border-primary/20 transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:rotate-12 transition-transform">
                  <Activity className="w-6 h-6 text-primary" />
                </div>
                <p className="text-4xl font-black text-secondary">{totalGestiones}</p>
                <p className="text-sm font-bold text-muted-foreground uppercase mt-1">Gestiones Realizadas</p>
              </div>

              <div className="p-8 rounded-[2rem] bg-muted/20 border border-border/50 hover:border-secondary/20 transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center mb-4 group-hover:rotate-12 transition-transform">
                  <Shield className="w-6 h-6 text-secondary" />
                </div>
                <p className="text-4xl font-black text-secondary">
                  ${Math.round(totalValue).toLocaleString('es-CO')}
                </p>
                <p className="text-sm font-bold text-muted-foreground uppercase mt-1">Valor Total en Links</p>
              </div>

              <div className="p-8 rounded-[2rem] bg-muted/20 border border-border/50 hover:border-primary/20 transition-all group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:rotate-12 transition-transform">
                    <PhoneCall className="w-6 h-6 text-primary" />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-full"
                    onClick={checkActiveConversations}
                    disabled={checkingConversations}
                  >
                    <RefreshCcw className={cn("w-3 h-3 text-muted-foreground", checkingConversations && "animate-spin")} />
                  </Button>
                </div>
                <p className="text-4xl font-black text-secondary">{activeConversations ?? '—'}</p>
                <p className="text-sm font-bold text-muted-foreground uppercase mt-1">Conversaciones Activas Ahora</p>
              </div>

              <div className="p-8 rounded-[2rem] bg-muted/20 border border-border/50 hover:border-secondary/20 transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center mb-4 group-hover:rotate-12 transition-transform">
                  <Award className="w-6 h-6 text-secondary" />
                </div>
                <p className="text-4xl font-black text-secondary">{callTotal ?? '—'}</p>
                <p className="text-sm font-bold text-muted-foreground uppercase mt-1">
                  {callTotal === null ? 'Total de Llamadas (sin datos)' : 'Total de Llamadas'}
                </p>
              </div>

              <div className="sm:col-span-2 p-8 rounded-[2rem] bg-gradient-to-br from-secondary to-slate-800 text-white relative overflow-hidden flex flex-col items-center justify-center text-center">
                 <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/tech/800/400')] opacity-5 mix-blend-overlay" />
                 <Trophy className="w-16 h-16 text-primary mb-4 animate-bounce" />
                 <h4 className="text-2xl font-black mb-2">¡Asesor Destacado del Mes!</h4>
                 <p className="text-slate-400 max-w-sm">Has superado tu meta de gestiones en un 15% comparado con el mes anterior.</p>
                 <Button 
                   onClick={downloadCertificate}
                   className="mt-6 bg-white text-secondary hover:bg-slate-100 font-black rounded-xl"
                 >
                   Descargar Reconocimiento
                 </Button>
              </div>
            </div>
          </section>
        </div>

      </div>
    </div>
  );
}
