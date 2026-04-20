import React, { useState, useEffect } from 'react';
import { db } from '@/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { User } from '../types';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Users as UsersIcon, 
  Search, 
  Mail, 
  Shield, 
  Calendar, 
  Activity,
  Circle,
  Clock,
  History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'users' | 'history'>('users');
  const [permissionError, setPermissionError] = useState<boolean>(false);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('lastLoginAt', 'desc'));
    const unsubscribeUsers = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        uid: doc.id
      })) as User[];
      setUsers(data);
      setLoading(false);
      setPermissionError(false);
    }, (error) => {
      console.error("Users sync error:", error);
      if (error.code === 'permission-denied') {
        setPermissionError(true);
      }
      setLoading(false);
    });

    const lq = query(collection(db, 'login_logs'), orderBy('timestamp', 'desc'));
    const unsubscribeLogs = onSnapshot(lq, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        timestamp: doc.data().timestamp?.toDate?.() || new Date()
      }));
      setLogs(data);
      setPermissionError(false);
    }, (error) => {
      console.error("Logs sync error:", error);
      if (error.code === 'permission-denied') {
        setPermissionError(true);
      }
    });

    return () => {
      unsubscribeUsers();
      unsubscribeLogs();
    };
  }, []);

  const filteredUsers = users.filter(user => 
    (user.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.role || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.cartera || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: users.length,
    online: users.filter(u => u.status === 'online').length,
    admins: users.filter(u => u.role === 'admin').length,
    asesores: users.filter(u => u.role === 'asesor').length
  };

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
      
      {permissionError && (
        <Card className="border-red-500/20 bg-red-500/5 overflow-hidden rounded-[2.5rem] border-2">
          <CardContent className="p-8 flex flex-col md:flex-row items-center gap-6">
            <div className="w-16 h-16 rounded-3xl bg-red-500/10 flex items-center justify-center shrink-0">
               <Shield className="w-8 h-8 text-red-500" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-xl font-black text-secondary tracking-tight">Acceso Restringido a Datos</h3>
              <p className="text-secondary/70 font-medium mt-1 leading-relaxed">
                El sistema detectó un error de permisos en Firebase. Por favor, asegúrate de haber actualizado las 
                <span className="font-bold text-secondary mx-1">Reglas de Seguridad (Rules)</span> 
                en la Consola de Firebase para permitir la lectura del historial y usuarios.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-secondary tracking-tight">Gestión de Usuarios</h2>
          <p className="text-muted-foreground font-medium">Control de acceso y actividad de asesores</p>
        </div>
        
        <div className="flex items-center gap-4 bg-card px-6 py-3 rounded-2xl shadow-sm border border-border/50">
          <div className="text-center px-4 border-r border-border/50">
            <p className="text-2xl font-black text-secondary">{stats.total}</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Total</p>
          </div>
          <div className="text-center px-4 border-r border-border/50">
            <p className="text-2xl font-black text-green-500">{stats.online}</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Online</p>
          </div>
          <div className="text-center px-4">
            <p className="text-2xl font-black text-primary">{stats.admins}</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Admins</p>
          </div>
        </div>
      </div>

      {/* VIEW SELECTOR */}
      <div className="flex p-1.5 bg-card border border-border/50 rounded-2xl w-fit">
        <Button 
          variant={activeView === 'users' ? 'default' : 'ghost'}
          onClick={() => setActiveView('users')}
          className={cn("rounded-xl font-bold h-10 px-6", activeView === 'users' && "shadow-lg shadow-primary/20")}
        >
          <UsersIcon className="w-4 h-4 mr-2" />
          Directorio
        </Button>
        <Button 
          variant={activeView === 'history' ? 'default' : 'ghost'}
          onClick={() => setActiveView('history')}
          className={cn("rounded-xl font-bold h-10 px-6", activeView === 'history' && "shadow-lg shadow-primary/20")}
        >
          <History className="w-4 h-4 mr-2" />
          Historial de Logins
        </Button>
      </div>

      {activeView === 'users' ? (
        <>
          {/* SEARCH BAR */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
              <Search className="w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            </div>
            <Input 
              placeholder="Buscar usuarios por nombre, correo, rol o cartera..." 
              className="pl-14 h-16 bg-card border-none rounded-[2rem] shadow-sm text-lg font-medium focus-visible:ring-2 focus-visible:ring-primary/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* USERS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredUsers.map((user, i) => (
                <motion.div
                  key={user.uid}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="rounded-[2.5rem] border-none shadow-md hover:shadow-xl transition-all duration-500 overflow-hidden group">
                    <div className="h-24 bg-gradient-to-br from-secondary/10 to-secondary/5 relative">
                      <div className="absolute top-4 right-4">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5",
                            user.status === 'online' ? "bg-green-500/10 text-green-600" : "bg-slate-500/10 text-slate-500"
                          )}>
                            <Circle className={cn("w-2 h-2 fill-current", user.status === 'online' && "animate-pulse")} />
                            {user.status === 'online' ? 'En línea' : 'Desconectado'}
                          </span>
                      </div>
                    </div>

                    <CardContent className="px-8 pb-8 -mt-10 relative">
                      <div className="flex flex-col items-center text-center">
                        <div className="w-20 h-20 rounded-3xl bg-card border-4 border-card shadow-lg overflow-hidden mb-4 group-hover:scale-110 transition-transform duration-500">
                          {user.photoURL ? (
                            <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted">
                              <UsersIcon className="w-10 h-10 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>
                        
                        <h3 className="text-xl font-black text-secondary tracking-tight">{user.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn(
                            "text-[10px] font-black px-3 py-0.5 rounded-full uppercase tracking-widest",
                            user.role === 'admin' ? "bg-primary text-white" : "bg-secondary/10 text-secondary"
                          )}>
                            {user.role}
                          </span>
                        </div>

                        <div className="w-full mt-6 space-y-4 pt-6 border-t border-border/50">
                          <div className="flex items-center gap-3 text-left">
                            <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0">
                              <Mail className="w-4 h-4 text-primary" />
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-[9px] font-bold text-muted-foreground uppercase">Email</p>
                              <p className="text-xs font-bold text-secondary truncate">{user.email}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-left">
                            <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0">
                              <Shield className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-muted-foreground uppercase">Cartera</p>
                              <p className="text-xs font-bold text-secondary">{user.cartera}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-left">
                            <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0">
                              <Clock className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-muted-foreground uppercase">Último Acceso</p>
                              <p className="text-xs font-bold text-secondary">
                                {user.lastLoginAt ? format(user.lastLoginAt.toDate?.() || user.lastLoginAt, "d MMM, HH:mm", { locale: es }) : 'Nunca'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {!loading && filteredUsers.length === 0 && (
            <div className="text-center py-20 bg-card rounded-[3rem] border border-dashed border-border transition-all animate-in fade-in zoom-in-95">
              <Activity className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-xl font-bold text-muted-foreground">No se encontraron usuarios</p>
            </div>
          )}
        </>
      ) : (
        <div className="bg-card rounded-[2.5rem] border border-border/50 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="p-10 border-b border-border/10 bg-muted/10">
            <CardTitle className="text-xl font-black text-secondary flex items-center gap-3 uppercase tracking-tight">
              <History className="w-6 h-6 text-primary" />
              Historial Completo de Accesos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="px-10 py-6 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] w-80">Asesor</th>
                    <th className="px-10 py-6 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Correo de Acceso</th>
                    <th className="px-10 py-6 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] text-right">Fecha y Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/10">
                  <AnimatePresence mode="popLayout">
                    {logs.map((log, i) => (
                      <motion.tr 
                        key={log.id} 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="hover:bg-muted/10 transition-colors group"
                      >
                        <td className="px-10 py-6">
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-black text-xs text-primary">
                                {log.name.charAt(0)}
                              </div>
                              <span className="font-bold text-secondary group-hover:text-primary transition-colors">{log.name}</span>
                           </div>
                        </td>
                        <td className="px-10 py-6">
                           <span className="text-sm font-medium text-muted-foreground font-mono">{log.email}</span>
                        </td>
                        <td className="px-10 py-6 text-right">
                           <span className="text-sm font-black text-secondary">
                             {format(log.timestamp, "d 'de' MMMM, HH:mm:ss", { locale: es })}
                           </span>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
            
            {logs.length === 0 && (
              <div className="p-20 text-center text-muted-foreground italic opacity-50">
                Aún no hay registros de acceso en el sistema.
              </div>
            )}
          </CardContent>
        </div>
      )}
    </div>
  );
}
