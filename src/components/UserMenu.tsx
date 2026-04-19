import React from 'react';
import { 
  UserCircle, 
  LogOut, 
  Settings, 
  User as UserIcon,
  Shield
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { User } from '../types';

interface UserMenuProps {
  user: User;
  onLogout: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ user, onLogout }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-3 px-3 h-12 hover:bg-muted/50 rounded-xl transition-all outline-none">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-black text-secondary leading-none">{user.name}</p>
          <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest mt-1">En línea</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20 overflow-hidden">
          {user.photoURL ? (
            <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <UserCircle className="w-6 h-6 text-primary" />
          )}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-2 rounded-2xl shadow-2xl border-border bg-card">
        <DropdownMenuLabel className="px-3 py-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">{user.role}</span>
            <span className="text-sm font-black text-secondary truncate">{user.name}</span>
            <span className="text-[10px] font-medium text-muted-foreground truncate">{user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-3 h-11 rounded-xl cursor-pointer focus:bg-primary/5 focus:text-primary">
          <UserIcon className="w-4 h-4 opacity-70" />
          <span className="font-bold text-sm">Mi Perfil</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-3 h-11 rounded-xl cursor-pointer focus:bg-primary/5 focus:text-primary">
          <Shield className="w-4 h-4 opacity-70" />
          <span className="font-bold text-sm">Seguridad</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-3 h-11 rounded-xl cursor-pointer focus:bg-primary/5 focus:text-primary">
          <Settings className="w-4 h-4 opacity-70" />
          <span className="font-bold text-sm">Ajustes</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          className="gap-3 h-11 rounded-xl cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/5 font-black" 
          onClick={onLogout}
        >
          <LogOut className="w-4 h-4" />
          <span className="font-bold text-sm">Cerrar Sesión</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
