import React, { useState } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PhoneForwarded, ShieldCheck, Loader2 } from 'lucide-react';
import { signIn } from '@/firebase';
import { toast } from 'sonner';

export const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const { resolvedTheme } = useTheme();
  
  const isDark = resolvedTheme === 'dark';

  const handleLogin = async () => {
    setLoading(true);
    try {
      await signIn();
    } catch (error: any) {
      console.error("Login error:", error);
      toast.error(error.message || "Error al iniciar sesión con Google");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden transition-colors duration-500">
      
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-secondary/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      
      <Card className="w-full max-w-md shadow-2xl border-none bg-card/80 backdrop-blur-xl z-10 rounded-[3rem] overflow-hidden">
        
        <CardHeader className="text-center space-y-6 pt-12">
          <div className="mx-auto flex items-center justify-center">
            <div className="p-5 rounded-[2.5rem] transform hover:rotate-3 transition-transform duration-500 flex items-center justify-center min-w-[120px] min-h-[120px]">
              {!logoError ? (
                <img 
                  src={isDark ? "/ellibertador.png" : "/isotipo.png"} 
                  alt="Logo El Libertador" 
                  className="w-32 h-auto rounded-xl" 
                  referrerPolicy="no-referrer"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <div className="flex flex-col items-center text-white/50">
                  <ShieldCheck className="w-12 h-12 mb-1" />
                  <span className="text-[10px] font-black uppercase tracking-widest">El Libertador</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <CardTitle className="text-4xl font-black text-foreground uppercase tracking-tighter italic">
              El Libertador
            </CardTitle>
            <CardDescription className="text-muted-foreground font-bold uppercase text-[10px] tracking-[0.3em]">
              Gestión Corporativa de Transferencias
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="px-10 py-6">
          <div className="p-5 bg-muted/50 rounded-2xl text-xs font-bold flex gap-4 items-center border border-border/50">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <p className="text-muted-foreground leading-relaxed">Acceso exclusivo para asesores autorizados de Seguros Bolívar S.A.</p>
          </div>
        </CardContent>

        <CardFooter className="px-10 pb-12">
          <Button 
            className="w-full h-16 text-lg font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-95"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin mr-3 w-6 h-6" /> : <PhoneForwarded className="mr-3 w-6 h-6" />}
            Ingresar al Sistema
          </Button>
        </CardFooter>

      </Card>
    </div>
  );
};