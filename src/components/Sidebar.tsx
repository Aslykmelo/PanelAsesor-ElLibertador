import React, { useState } from 'react';
import { useTheme } from 'next-themes';
import { 
  LayoutDashboard, 
  PhoneForwarded, 
  ClipboardList, 
  Trophy,
  LogOut,
  UserCircle,
  Users,
  History,
  ShieldCheck,
  ChevronLeft,
  X,
  Menu,
  DollarSign,
  TrendingUp,
  Building2,
  ListChecks
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { User } from '../types';
import { NGSO_VALIDATOR_EMAILS, CONTROLLER_EMAILS } from '../constants';

interface SidebarProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  user?: User;
  onLogout?: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab = 'dashboard', 
  onTabChange, 
  user,
  onLogout,
  isOpen,
  onToggle
}) => {
  const [logoError, setLogoError] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  
  const isAsesor = user?.role === 'asesor';
  
  const menuItems = [
    { id: 'dashboard', label: isAsesor ? 'Mi Gestión' : 'Tablero', icon: LayoutDashboard },
    { id: 'executive-dashboard', label: 'Dashboard Ejecutivo', icon: TrendingUp, role: ['admin', 'supervisor'] },
    { id: 'new-transfer', label: 'Nueva Gestión', icon: PhoneForwarded },
    { id: 'my-tasks', label: 'Mis Gestiones', icon: ClipboardList },
    { id: 'redirect-ngso', label: 'Redirigir a NGSO', icon: Building2 },
    { id: 'ngso-validation', label: 'Validación NGSO', icon: ShieldCheck, emails: NGSO_VALIDATOR_EMAILS },
    { id: 'call-totals-upload', label: 'Cargar Totales', icon: ListChecks, emails: CONTROLLER_EMAILS },
    { id: 'recaudo', label: 'Seguimiento Recaudo', icon: DollarSign, role: ['admin', 'supervisor'] },
    { id: 'advisor-management', label: 'Gestión Asesores', icon: Users, role: ['admin', 'supervisor'] },
    { id: 'ranking', label: 'Clasificación', icon: Trophy, role: ['admin', 'supervisor'] },
    { id: 'user-management', label: 'Usuarios', icon: UserCircle, role: ['admin'] },
    { id: 'history', label: 'Historial', icon: History, role: ['admin', 'supervisor'] },
  ];

  const filteredMenu = menuItems.filter(item => {
    if (item.emails) {
      return !!user && item.emails.includes((user.email || '').toLowerCase());
    }
    return !item.role || (user && item.role.includes(user.role));
  });

  return (
    <>
      {/* MOBILE OVERLAY */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity" 
          onClick={onToggle}
        />
      )}

      <aside className={cn(
        "fixed md:relative top-0 left-0 h-screen bg-sidebar text-white flex flex-col transition-all duration-500 z-50 overflow-hidden shadow-xl",
        isOpen ? "w-56 translate-x-0" : "-translate-x-full md:translate-x-0 md:w-16",
        "border-r border-white/5"
      )}>

        {/* HEADER: logo + wordmark + toggle, one compact row */}
        <div className="h-14 shrink-0 px-3 flex items-center justify-between border-b border-white/5 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 shrink-0 rounded-lg overflow-hidden flex items-center justify-center bg-white/5">
              {!logoError ? (
                <img
                  src="/ellibertador.png"
                  alt="Logo El Libertador"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <ShieldCheck className="w-5 h-5 text-secondary" />
              )}
            </div>
            {isOpen && (
              <p className="text-xs font-black uppercase tracking-wide truncate animate-in fade-in duration-300">El Libertador</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="text-white/60 hover:text-white hover:bg-white/10 rounded-lg w-8 h-8 shrink-0 transition-all active:scale-95"
          >
            {isOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </Button>
        </div>

        {/* NAVIGATION */}
        <nav className="px-2 py-3 space-y-1 overflow-y-auto custom-scrollbar">

          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-2.5 h-9 rounded-lg transition-all duration-300 group overflow-hidden",
              activeTab === 'profile'
                ? "bg-primary text-white shadow-sm shadow-primary/30"
                : "hover:bg-white/10 text-white/60 hover:text-white"
            )}
            onClick={() => onTabChange?.('profile')}
          >
            <UserCircle className={cn(
              "w-4 h-4 shrink-0",
              activeTab === 'profile' ? "text-white" : "text-white/40"
            )} />
            {isOpen && <span className="font-bold text-xs whitespace-nowrap">Mi Perfil</span>}
          </Button>

          <div className="my-2 h-px bg-white/5 mx-1" />

          {filteredMenu.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              className={cn(
                "w-full justify-start gap-2.5 h-9 rounded-lg transition-all duration-300 group overflow-hidden",
                activeTab === item.id
                  ? "bg-primary text-white shadow-sm shadow-primary/30 hover:bg-primary/90"
                  : "hover:bg-white/10 text-white/60 hover:text-white"
              )}
              onClick={() => onTabChange?.(item.id)}
            >
              <item.icon className={cn(
                "w-4 h-4 shrink-0",
                activeTab === item.id ? "text-white" : "text-white/40"
              )} />
              {isOpen && <span className="font-bold text-xs whitespace-nowrap">{item.label}</span>}
            </Button>
          ))}
        </nav>

        {/* FOOTER */}
        <div className="p-3 border-t border-white/5 mt-auto bg-black/20">
          {isOpen && user && (
            <div className="flex items-center gap-2 px-1 py-2 mb-1">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shrink-0 overflow-hidden">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <UserCircle className="w-4 h-4 text-primary" />
                )}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-black truncate leading-tight">{user.name}</p>
                <p className="text-[9px] text-white/40 truncate font-mono uppercase tracking-tighter leading-tight">{user.role}</p>
              </div>
            </div>
          )}

          <Button
            variant="ghost"
            onClick={onLogout}
            className={cn(
              "w-full justify-start gap-2.5 h-9 rounded-lg text-white/40 hover:text-white hover:bg-red-500/20 hover:border-red-500/30 border border-transparent transition-all duration-300 overflow-hidden",
              !isOpen && "px-2"
            )}
            title="Cerrar Sesión"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {isOpen && <span className="font-bold text-xs whitespace-nowrap">Cerrar Sesión</span>}
          </Button>
        </div>
      </aside>
    </>
  );
};
