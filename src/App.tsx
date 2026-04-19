import { useState, useEffect, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { DashboardAdmin } from './components/DashboardAdmin';
import { useTheme } from 'next-themes';
import { DashboardAdviser } from './components/DashboardAdvisor';
import { TransferForm } from './components/TransferForm';
import { TransferList } from './components/TransferList';
import { Ranking } from './components/Ranking';
import { Profile } from './components/Profile';
import { UserManagement } from './components/UserManagement';
import { Notifications, Notification } from './components/Notifications';
import { UserMenu } from './components/UserMenu';
import { Login } from './components/Login';
import { ThemeToggle } from './components/ThemeToggle';
import { Toaster } from '@/components/ui/sonner';
import { Transfer, User } from './types';
import { Search, Menu, X, Loader2, User as UserIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

import { auth, db, signOut } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, Timestamp, deleteDoc } from 'firebase/firestore';

export default function App() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });
  const [globalSearch, setGlobalSearch] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      title: 'Bienvenido a El Libertador',
      description: 'Panel de gestión unificado activo.',
      time: 'Ahora',
      type: 'info',
      read: false
    }
  ]);

  // 🔐 AUTH & USER SYNC
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Escuchar cambios en el documento del usuario en tiempo real
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        // Timeout para evitar colgarse si el documento nunca se crea
        const timeoutId = setTimeout(() => {
          if (loading) {
            console.error("Timeout waiting for user document");
            setLoading(false);
            signOut();
            toast.error("Error de sesión: Perfil no encontrado");
          }
        }, 10000);

        const userUnsubscribe = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            clearTimeout(timeoutId);
            setCurrentUser(docSnap.data() as User);
            setLoading(false);
          } else {
            // Si no existe el documento pero el usuario está autenticado,
            // puede ser que el proceso de creación en firebase.ts aún esté corriendo.
            // Esperamos un poco más en lugar de cerrar sesión inmediatamente.
            console.log("Documento de usuario no encontrado aún...");
            // No hacemos setLoading(false) aquí todavía para mantener el spinner
          }
        }, (error) => {
          console.error("User sync error:", error);
          setLoading(false);
          if (error.code === 'permission-denied') {
            toast.error("Error de permisos: No se pudo cargar tu perfil");
            signOut(); 
          }
        });

        return () => userUnsubscribe();
      } else {
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // 🔥 FIRESTORE DATA SYNC
  useEffect(() => {
    if (!currentUser) return;

    let q = query(collection(db, 'registros'), orderBy('createdAt', 'desc'));
    
    // Si es asesor, solo ve sus gestiones (enviadas o recibidas)
    // Nota: Firestore v9 query limitations apply if we use multiple where. 
    // Para simplificar y permitir filtrado complejo en el cliente, traemos lo necesario.
    // En producción usaríamos índices compuestos y filtrado de servidor.

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate?.()
      })) as Transfer[];

      setTransfers(data);
    }, (error) => {
      console.error("Firestore error:", error);
      toast.error("Error al sincronizar datos");
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const handleNewTransfer = (data: any) => {
    const newNotif: Notification = {
      id: Math.random().toString(36),
      title: data.managementType.includes('Mensaje') ? 'Nueva Transferencia' : 'Nuevo Link',
      description: `${data.toAdvisorName} registrado`,
      time: 'Recién',
      type: 'success',
      read: false
    };

    setNotifications([newNotif, ...notifications]);
    setActiveTab('history');
  };

  const handleStatusChange = async (id: string, status: any) => {
    try {
      await updateDoc(doc(db, 'registros', id), {
        status,
        updatedAt: Timestamp.now()
      });
      toast.success(`Registro marcado como ${status}`);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al actualizar estado");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'registros', id));
      toast.success("Registro eliminado permanentemente");
    } catch (error) {
      console.error("Error:", error);
      toast.error("No tienes permisos para eliminar este registro");
    }
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };
  
  // 🔎 GLOBAL SEARCH FILTER
  const filteredData = useMemo(() => {
    if (!globalSearch) return transfers;
    const searchLower = globalSearch.toLowerCase();
    return transfers.filter(t => 
      t.customerName.toLowerCase().includes(searchLower) ||
      t.requestNumber.toLowerCase().includes(searchLower) ||
      t.fromAdvisorName.toLowerCase().includes(searchLower) ||
      t.toAdvisorName.toLowerCase().includes(searchLower) ||
      t.cartera?.toLowerCase().includes(searchLower)
    );
  }, [transfers, globalSearch]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Validando credenciales...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return currentUser.role === 'asesor' 
          ? <DashboardAdviser transfers={filteredData.filter(t => t.fromAdvisorEmail === currentUser.email || t.toAdvisorEmail === currentUser.email)} user={currentUser} onNewTransfer={() => setActiveTab('new-transfer')} />
          : <DashboardAdmin transfers={filteredData} user={currentUser} />;
      
      case 'new-transfer':
        return <TransferForm onSubmit={handleNewTransfer} currentUser={currentUser} />;

      case 'my-tasks':
        {
          const effectiveRole = (currentUser.email?.toLowerCase() === 'taliana.moreno@segurosbolivar.com' || 
                                 currentUser.email?.toLowerCase() === 'helen.pantoja@segurosbolivar.com') 
                                 ? 'admin' : currentUser.role;
          return (
            <TransferList
              transfers={filteredData.filter(t => t.fromAdvisorEmail === currentUser.email || t.toAdvisorEmail === currentUser.email)}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              userRole={effectiveRole}
            />
          );
        }

      case 'history':
        {
          const effectiveRole = (currentUser.email?.toLowerCase() === 'taliana.moreno@segurosbolivar.com' || 
                                 currentUser.email?.toLowerCase() === 'helen.pantoja@segurosbolivar.com') 
                                 ? 'admin' : currentUser.role;
          return (
            <TransferList
              transfers={currentUser.role === 'asesor' 
                ? filteredData.filter(t => t.fromAdvisorEmail === currentUser.email || t.toAdvisorEmail === currentUser.email)
                : filteredData}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              userRole={effectiveRole}
            />
          );
        }

      case 'ranking':
        return <Ranking transfers={filteredData} />;

      case 'profile':
        return <Profile user={currentUser} transfers={filteredData.filter(t => t.fromAdvisorEmail === currentUser.email)} />;

      case 'user-management':
        return currentUser.role === 'admin' ? <UserManagement /> : null;

      default:
        return <DashboardAdmin transfers={filteredData} user={currentUser} />;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      
      <Sidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        user={currentUser}
        onLogout={() => signOut()}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <div className="flex-1 flex flex-col relative overflow-hidden">

        {/* HEADER */}
        <header className="h-20 bg-card flex items-center justify-between px-4 md:px-8 border-b border-border/50 sticky top-0 z-30">

          <div className="flex items-center gap-2 md:gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className="md:hidden text-secondary hover:bg-secondary/5 rounded-xl transition-all h-10 w-10"
            >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>

            <div className="flex items-center gap-3">
              <img 
                src="/ellibertador.png" 
                alt="Logo" 
                className="h-8 w-auto rounded-xl" 
                referrerPolicy="no-referrer" 
              />
              <div className="relative w-48 lg:w-96 group hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input 
                  placeholder="Búsqueda global (Cliente, ID, Asesor)..." 
                  className="pl-10 h-10 bg-muted/50 border-none rounded-xl focus-visible:ring-1 focus-visible:ring-primary shadow-none w-full font-medium" 
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                />
                {globalSearch && (
                  <button 
                    onClick={() => setGlobalSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            <ThemeToggle />
            <Notifications notifications={notifications} onMarkAsRead={markNotificationAsRead} />
            <div className="h-8 w-px bg-border hidden md:block" />
            <div 
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity hidden md:flex" 
              onClick={() => setActiveTab('profile')}
            >
              <div className="text-right">
                <p className="text-sm font-bold leading-none">{currentUser.name}</p>
                <p className="text-[10px] text-primary font-bold uppercase tracking-wider mt-1">{currentUser.role === 'admin' ? 'Administrador' : currentUser.role === 'supervisor' ? 'Supervisor' : 'Asesor'}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20 overflow-hidden">
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt={currentUser.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <UserIcon className="w-6 h-6 text-primary" />
                )}
              </div>
            </div>
            <div className="md:hidden">
              <UserMenu user={currentUser} onLogout={() => signOut()} />
            </div>
          </div>

        </header>

        {/* MAIN */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          {renderContent()}
        </main>

      </div>

      <Toaster position="top-right" />
    </div>
  );
}
