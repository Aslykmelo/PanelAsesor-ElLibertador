import React, { useState } from 'react';
import { useTheme } from 'next-themes';
import { 
  LayoutDashboard, 
  PhoneForwarded, 
  ClipboardList, 
  Trophy,
  LogOut,
  UserCircle,
  History,
  ShieldCheck,
  ChevronLeft,
  X,
  Menu
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { User } from '../types';

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
    { id: 'new-transfer', label: 'Nueva Gestión', icon: PhoneForwarded },
    { id: 'my-tasks', label: 'Mis Gestiones', icon: ClipboardList },
    { id: 'ranking', label: 'Clasificación', icon: Trophy, role: ['admin', 'supervisor'] },
    { id: 'user-management', label: 'Usuarios', icon: UserCircle, role: ['admin'] },
    { id: 'history', label: 'Historial', icon: History, role: ['admin', 'supervisor'] } as const,
  ];

  const filteredMenu = menuItems.filter(item => 
    !item.role || (user && item.role.includes(user.role))
  );

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
        "fixed md:relative top-0 left-0 h-screen bg-sidebar text-white flex flex-col transition-all duration-500 z-50 overflow-hidden shadow-2xl",
        isOpen ? "w-72 translate-x-0" : "-translate-x-full md:translate-x-0 md:w-24",
        "border-r border-white/5"
      )}>
        
        {/* TOGGLE AREA (ARRIBA DEL LOGO) */}
        <div className="p-4 flex items-center justify-center border-b border-white/5">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onToggle} 
            className="text-white/60 hover:text-white hover:bg-white/10 rounded-2xl w-12 h-12 transition-all active:scale-95"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </div>

        {/* LOGO AREA */}
        <div className="p-8 flex flex-col items-center justify-center border-b border-white/5">
          <div className={cn(
            "transition-all duration-500 rounded-3xl p-4 flex items-center justify-center overflow-hidden",
            isOpen ? "w-32 h-32" : "w-14 h-14 p-2"
          )}>
            <div className="w-full h-full relative group flex items-center justify-center">
              {!logoError ? (
                <img 
                  src="/public/ellibertador.png" 
                  alt="Logo El Libertador" 
                  className={cn("w-full h-full object-contain transition-all duration-500 rounded-xl", !isOpen ? "p-1" : "")} 
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    setLogoError(true);
                  }}
                />
              ) : (
                <ShieldCheck className={cn("text-secondary transition-all", isOpen ? "w-16 h-16" : "w-8 h-8")} />
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-xl transition-colors cursor-pointer flex items-center justify-center">
                 <ShieldCheck className="text-secondary w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>
          {isOpen && (
            <div className="mt-4 text-center animate-in fade-in slide-in-from-top-2 duration-500">
               <p className="text-[10px] uppercase font-black text-white/30 tracking-[0.4em] whitespace-nowrap">Área Corporativa</p>
            </div>
          )}
        </div>

        {/* NAVIGATION */}
        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto custom-scrollbar">
          
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-4 h-12 rounded-xl transition-all duration-300 group overflow-hidden",
              activeTab === 'profile' 
                ? "bg-primary text-white shadow-lg shadow-primary/30" 
                : "hover:bg-white/10 text-white/60 hover:text-white"
            )}
            onClick={() => onTabChange?.('profile')}
          >
            <UserCircle className={cn(
              "w-5 h-5 shrink-0 transition-transform duration-300 group-hover:scale-110",
              activeTab === 'profile' ? "text-white" : "text-white/40"
            )} />
            {isOpen && <span className="font-bold text-sm whitespace-nowrap">Mi Perfil</span>}
          </Button>

          <div className="my-4 h-px bg-white/5 mx-2" />

          {filteredMenu.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              className={cn(
                "w-full justify-start gap-4 h-12 rounded-xl transition-all duration-300 group overflow-hidden",
                activeTab === item.id 
                  ? "bg-primary text-white shadow-lg shadow-primary/30 hover:bg-primary/90" 
                  : "hover:bg-white/10 text-white/60 hover:text-white"
              )}
              onClick={() => onTabChange?.(item.id)}
            >
              <item.icon className={cn(
                "w-5 h-5 shrink-0 transition-transform duration-300 group-hover:scale-110",
                activeTab === item.id ? "text-white" : "text-white/40"
              )} />
              {isOpen && <span className="font-bold text-sm whitespace-nowrap">{item.label}</span>}
            </Button>
          ))}
        </nav>

        {/* FOOTER */}
        <div className="p-6 border-t border-white/5 mt-auto bg-black/20">
          {isOpen && user && (
            <div className="flex items-center gap-3 px-2 py-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shrink-0 overflow-hidden">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <UserCircle className="w-6 h-6 text-primary" />
                )}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-black truncate">{user.name}</p>
                <p className="text-[10px] text-white/40 truncate font-mono uppercase tracking-tighter">{user.role}</p>
              </div>
            </div>
          )}
          
          <Button 
            variant="ghost" 
            onClick={onLogout}
            className={cn(
              "w-full justify-start gap-4 h-12 rounded-xl text-white/40 hover:text-white hover:bg-red-500/20 hover:border-red-500/30 border border-transparent transition-all duration-300 overflow-hidden",
              !isOpen && "px-3"
            )}
            title="Cerrar Sesión"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {isOpen && <span className="font-bold text-sm whitespace-nowrap">Cerrar Sesión</span>}
          </Button>
        </div>
      </aside>
    </>
  );
};
