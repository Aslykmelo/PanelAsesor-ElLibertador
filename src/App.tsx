import { useState, useEffect, useMemo, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { DashboardAdmin } from './components/DashboardAdmin';
import { useTheme } from 'next-themes';
import { DashboardAdviser } from './components/DashboardAdvisor';
import { TransferForm } from './components/TransferForm';
import { TransferList } from './components/TransferList';
import { Ranking } from './components/Ranking';
import { Profile } from './components/Profile';
import { UserManagement } from './components/UserManagement';
import { AdvisorManagement } from './components/AdvisorManagement';
import { RecaudoTracking } from './components/RecaudoTracking';
import { Notifications, Notification } from './components/Notifications';
import { UserMenu } from './components/UserMenu';
import { Login } from './components/Login';
import { ThemeToggle } from './components/ThemeToggle';
import { Toaster } from '@/components/ui/sonner';
import { Transfer, User, Advisor } from './types';
import { Search, Menu, X, Loader2, User as UserIcon, Shield } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

import { auth, db, signOut, FirestoreTracer } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, Timestamp, deleteDoc, where, or, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { useAutoSyncAdvisors } from './hooks/useAutoSyncAdvisors';

export default function App() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // 🔥 AUTOMATIC DATA SYNC
  useAutoSyncAdvisors(currentUser);
  const [transfers, setTransfers] = useState<Transfer[]>(() => {
    try {
      const cached = localStorage.getItem('cached_registros');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed.map((t: any) => ({
            ...t,
            createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
            updatedAt: t.updatedAt ? new Date(t.updatedAt) : undefined,
          }));
        }
      }
    } catch (e) {
      console.warn("Error parsing cached_registros on init:", e);
    }
    return [];
  });
  const [advisors, setAdvisors] = useState<Advisor[]>(() => {
    try {
      const cached = localStorage.getItem('cached_asesores');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Error parsing cached_asesores on init:", e);
    }
    return [];
  });
  const [syncError, setSyncError] = useState<string | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });
  const [globalSearch, setGlobalSearch] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // 🔥 NOTIFICATIONS SYNC
  useEffect(() => {
    if (!currentUser || !currentUser.notifications) {
      if (notifications.length > 0 && !currentUser) setNotifications([]);
      return;
    }
    
    const curJson = JSON.stringify(currentUser.notifications);
    const prevJson = JSON.stringify(notifications);
    if (curJson !== prevJson) {
      setNotifications(currentUser.notifications);
    }
  }, [currentUser?.notifications]);

  // 🔥 DATABASE QUOTA EXHAUSTION FALLBACK LAYER
  const loadFallbackData = (collectionName: 'asesores' | 'registros') => {
    setQuotaExceeded(true);
    const cached = localStorage.getItem(`cached_${collectionName}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (collectionName === 'asesores') {
          setAdvisors(Array.isArray(parsed) ? parsed : []);
        } else if (collectionName === 'registros') {
          if (Array.isArray(parsed)) {
            const parsedTransfers = parsed.map((t: any) => ({
              ...t,
              createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
              updatedAt: t.updatedAt ? new Date(t.updatedAt) : undefined,
            })) as Transfer[];
            setTransfers(parsedTransfers);
          }
        }
      } catch (e) {
        console.error(`Error parsing cached_${collectionName}:`, e);
      }
    } else {
      // Direct hard fallback if nothing is cached
      if (collectionName === 'asesores') {
        const initialAdvisors = [
          { id: '1', name: 'Ana María Gómez', email: 'ana.gomez@segurosbolivar.com', role: 'advisor', supervisor: 'Gerencia', active: true, cartera: 'Comercial' },
          { id: '2', name: 'Carlos Mario Ruiz', email: 'carlos.ruiz@segurosbolivar.com', role: 'advisor', supervisor: 'Gerencia', active: true, cartera: 'Soporte' }
        ];
        setAdvisors(initialAdvisors);
        localStorage.setItem('cached_asesores', JSON.stringify(initialAdvisors));
      } else if (collectionName === 'registros') {
        const initialTransfers = [
          {
            id: 'mock-1',
            type: 'regalo',
            requestNumber: '112233',
            fromAdvisorName: 'Asesor Demostración',
            fromAdvisorEmail: currentUser?.email || 'test@gmail.com',
            toAdvisorName: 'Soporte',
            toAdvisorEmail: 'soporte@segurosbolivar.com',
            supervisorName: 'Soporte',
            supervisorEmail: 'soporte@segurosbolivar.com',
            cartera: 'Soporte',
            managementType: 'Llamada Directa',
            canalGestion: 'Llamada',
            observations: 'Ejemplo de registro local (cuota Firebase superada)',
            status: 'pendiente',
            createdAt: new Date(),
          } as any as Transfer
        ];
        setTransfers(initialTransfers);
        localStorage.setItem('cached_registros', JSON.stringify(initialTransfers));
      }
    }
  };

  // Listen for local updates in case of quota exhaustion fallback
  useEffect(() => {
    const handleLocalUpdates = () => {
      console.log("Local registrations updated event received!");
      const cached = localStorage.getItem('cached_registros');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            const parsedTransfers = parsed.map((t: any) => ({
              ...t,
              createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
              updatedAt: t.updatedAt ? new Date(t.updatedAt) : undefined,
            })) as Transfer[];
            setTransfers(parsedTransfers);
          }
        } catch (e) {
          console.error("Local storage update parse error:", e);
        }
      }
    };

    window.addEventListener('local-registros-updated', handleLocalUpdates);

    return () => {
      window.removeEventListener('local-registros-updated', handleLocalUpdates);
    };
  }, []);

  const effectiveRole = useMemo(() => {
    if (!currentUser) return 'asesor';
    const isAdminEmail = (
      currentUser.email?.toLowerCase() === 'taliana.moreno@segurosbolivar.com' || 
      currentUser.email?.toLowerCase() === 'helen.pantoja@segurosbolivar.com'
    );
    return isAdminEmail ? 'admin' : currentUser.role;
  }, [currentUser]);

  // 🔐 AUTH & USER SYNC
  useEffect(() => {
    let userUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // Limpiar cualquier suscripción previa de usuario si existe
      if (userUnsubscribe) {
        userUnsubscribe();
        userUnsubscribe = null;
      }

      if (firebaseUser) {
        setLoading(true);
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        const timeoutId = setTimeout(() => {
          setLoading((prevLoading) => {
            if (prevLoading) {
              console.warn("Timeout waiting for user document (uid: " + firebaseUser.uid + "). Using local info.");
              // Si después de 15s no hay doc en Firestore, dejamos de cargar
              // pero NO forzamos el logout aquí para dar margen al fallback
            }
            return false;
          });
        }, 15000);

        userUnsubscribe = onSnapshot(userRef, (docSnap) => {
          FirestoreTracer.track(`users/${firebaseUser.uid}`, 'App/AuthUserSync', 'onSnapshot');
          if (docSnap.exists()) {
            clearTimeout(timeoutId);
            const userData = { ...docSnap.data(), uid: docSnap.id } as User;
            setCurrentUser(userData);
            setLoading(false);
          } else {
            console.log("Documento de usuario aún no existe para UID:", firebaseUser.uid);
            const isAdmin = firebaseUser.email?.toLowerCase() === 'taliana.moreno@segurosbolivar.com' || 
                           firebaseUser.email?.toLowerCase() === 'helen.pantoja@segurosbolivar.com';
            
            setCurrentUser({
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Asesor',
              email: firebaseUser.email || '',
              role: isAdmin ? 'admin' : 'asesor',
              cartera: 'Actualizando...',
              photoURL: firebaseUser.photoURL || '',
              status: 'online'
            } as User);
            setLoading(false); // IMPORTANTE: dejar de cargar incluso en fallback
          }
        }, (error) => {
          console.error("User sync error (uid: " + firebaseUser.uid + "):", error);
          clearTimeout(timeoutId);
          
          if (error.code === 'permission-denied') {
            console.warn("Permisos insuficientes para sync. Usando info de Google Auth.");
            const isAdmin = firebaseUser.email?.toLowerCase() === 'taliana.moreno@segurosbolivar.com' || 
                           firebaseUser.email?.toLowerCase() === 'helen.pantoja@segurosbolivar.com';
            
            setCurrentUser({
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Usuario',
              email: firebaseUser.email || '',
              role: isAdmin ? 'admin' : 'asesor',
              cartera: 'Cargando...',
              photoURL: firebaseUser.photoURL || '',
              status: 'online'
            } as User);
          }
          setLoading(false);
        });
      } else {
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return () => {
      authUnsubscribe();
      if (userUnsubscribe) userUnsubscribe();
    };
  }, []);

  // 🔥 FIRESTORE DATA SYNC (Advisors)
  useEffect(() => {
    if (!currentUser) {
      setAdvisors([]);
      return;
    }

    const q = query(collection(db, 'asesores'), orderBy('name', 'asc'));
    FirestoreTracer.track('asesores', 'App/AsesoresSync', 'onSnapshot');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Advisor[];
      setAdvisors(data);
      localStorage.setItem('cached_asesores', JSON.stringify(data));
    }, (error) => {
      console.error("Advisors global sync error details:", {
        code: error.code,
        message: error.message,
        uid: auth.currentUser?.uid,
        email: auth.currentUser?.email
      });
      if (error.code === 'resource-exhausted' || error.message?.includes('Quota exceeded') || error.message?.includes('quota-exceeded')) {
        loadFallbackData('asesores');
      } else if (error.code === 'permission-denied') {
        toast.error('Error de permisos al cargar asesores. Si eres administrador, contacta a soporte técnico.');
      }
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);



  useEffect(() => {
    if (!currentUser) return;

    const isAsesor = effectiveRole === 'asesor';
    const userEmail = (currentUser.email || '').toLowerCase();
    
    // Si es admin/supervisor, traemos todo en una sola query
    if (!isAsesor) {
      const q = query(collection(db, 'registros'), orderBy('createdAt', 'desc'));
      FirestoreTracer.track('registros (Admin Global Sync)', 'App/RegistrosSync', 'onSnapshot');
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
          createdAt: doc.data().createdAt?.toDate?.() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate?.()
        })) as Transfer[];
        setTransfers(data);
        localStorage.setItem('cached_registros', JSON.stringify(data));
        setSyncError(null);
      }, (error) => {
        console.error("Admin sync error:", error);
        if (error.code === 'resource-exhausted' || error.message?.includes('Quota exceeded') || error.message?.includes('quota-exceeded')) {
          loadFallbackData('registros');
        } else if (error.code === 'permission-denied') {
          setSyncError(`Acceso restringido: Tus permisos de administrador aún se están sincronizando en la base de datos.`);
          console.warn("TIP: Como administrador, asegúrate de que tu correo esté en la lista blanca de Firebase Rules.");
        } else {
          setSyncError(`Error de conexión al cargar datos globales.`);
        }
      });
      return () => unsubscribe();
    }

    // SI ES ASESOR: Usamos dos queries separadas y las unimos para máxima compatibilidad con las reglas
    // Esto evita el error "permission-denied" que a veces causan los OR complejos con orderBy
    let sentData: Transfer[] = [];
    let receivedData: Transfer[] = [];

    const updateAsesorData = () => {
      const combined = [...sentData, ...receivedData];
      // Eliminar duplicados por ID y ordenar por fecha
      const unique = new Map(combined.map(item => [item.id, item]));
      const sorted = Array.from(unique.values()).sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : (typeof (a.createdAt as any)?.toDate === 'function' ? (a.createdAt as any).toDate() : new Date(a.createdAt));
        const dateB = b.createdAt instanceof Date ? b.createdAt : (typeof (b.createdAt as any)?.toDate === 'function' ? (b.createdAt as any).toDate() : new Date(b.createdAt));
        return dateB.getTime() - dateA.getTime();
      });
      setTransfers(sorted);
      localStorage.setItem('cached_registros', JSON.stringify(sorted));
      setSyncError(null);
    };

    const qSent = query(
      collection(db, 'registros'),
      where('fromAdvisorEmail', '==', userEmail)
    );

    const qReceived = query(
      collection(db, 'registros'),
      where('toAdvisorEmail', '==', userEmail)
    );

    FirestoreTracer.track('registros (Asesor Sent Sync)', 'App/RegistrosSync', 'onSnapshot');
    const unsubSent = onSnapshot(qSent, (snapshot) => {
      sentData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate?.()
      })) as Transfer[];
      updateAsesorData();
    }, (error) => {
      console.error("Sent items sync error:", error);
      if (error.code === 'resource-exhausted' || error.message?.includes('Quota exceeded') || error.message?.includes('quota-exceeded')) {
        loadFallbackData('registros');
      } else {
        setSyncError(`Error al cargar gestiones enviadas. Verifica tu conexión.`);
      }
    });

    FirestoreTracer.track('registros (Asesor Received Sync)', 'App/RegistrosSync', 'onSnapshot');
    const unsubReceived = onSnapshot(qReceived, (snapshot) => {
      receivedData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate?.()
      })) as Transfer[];
      updateAsesorData();
    }, (error) => {
      console.error("Received items sync error:", error);
      if (error.code === 'resource-exhausted' || error.message?.includes('Quota exceeded') || error.message?.includes('quota-exceeded')) {
        loadFallbackData('registros');
      } else {
        setSyncError(`Error al cargar gestiones recibidas. Verifica tu conexión.`);
      }
    });

    return () => {
      unsubSent();
      unsubReceived();
    };
  }, [currentUser?.uid, currentUser?.email, effectiveRole]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const handleNewTransfer = async (data: any) => {
    if (!currentUser) return;

    const isLink = !data.managementType.includes('Mensaje');
    
    const newNotif: Notification = {
      id: Math.random().toString(36).substring(7),
      title: isLink ? '🎁 Link de Pago' : '📞 Transferencia',
      description: isLink 
        ? `Has generado un link de pago exitosamente para la solicitud ${data.requestNumber}.` 
        : `Has realizado una transferencia de llamada para la solicitud ${data.requestNumber}.`,
      type: 'success' as const,
      read: false,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const updatedNotifications = [newNotif, ...(currentUser.notifications || [])].slice(0, 50); // Limit to 50
      
      await updateDoc(userRef, {
        notifications: updatedNotifications
      });
      setActiveTab('history');
    } catch (error) {
      console.error("Error saving notification to user document:", error);
      // Fallback local if server fails
      setNotifications(prev => [newNotif, ...prev]);
      setActiveTab('history');
    }
  };

  const handleStatusChange = async (id: string, status: any) => {
    try {
      await updateDoc(doc(db, 'registros', id), {
        status,
        updatedAt: Timestamp.now()
      });
      toast.success(`Registro marcado como ${status}`);
    } catch (error: any) {
      console.error("Error updates status:", error);
      const isQuota = error.code === 'resource-exhausted' || error.message?.toLowerCase().includes('quota exceeded') || error.message?.toLowerCase().includes('quota-exceeded');
      if (isQuota) {
        try {
          const cached = localStorage.getItem('cached_registros');
          if (cached) {
            const parsed = JSON.parse(cached) as any[];
            const updated = parsed.map(t => t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t);
            localStorage.setItem('cached_registros', JSON.stringify(updated));
            window.dispatchEvent(new CustomEvent('local-registros-updated'));
            toast.success(`Registro marcado como ${status} (Guardado localmente)`);
          }
        } catch (e) {
          console.error("Fallback update error:", e);
        }
      } else {
        toast.error("Error al actualizar estado");
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'registros', id));
      toast.success("Registro eliminado permanentemente");
    } catch (error: any) {
      console.error("Error:", error);
      const isQuota = error.code === 'resource-exhausted' || error.message?.toLowerCase().includes('quota exceeded') || error.message?.toLowerCase().includes('quota-exceeded');
      if (isQuota) {
        try {
          const cached = localStorage.getItem('cached_registros');
          if (cached) {
            const parsed = JSON.parse(cached) as any[];
            const updated = parsed.filter(t => t.id !== id);
            localStorage.setItem('cached_registros', JSON.stringify(updated));
            window.dispatchEvent(new CustomEvent('local-registros-updated'));
            toast.success("Registro eliminado (Localmente)");
          }
        } catch (e) {
          console.error("Fallback delete error:", e);
        }
      } else {
        toast.error("No tienes permisos para eliminar este registro o la cuota de Firebase se excedió.");
      }
    }
  };

  const markNotificationAsRead = async (id: string) => {
    if (!currentUser) return;
    
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const updatedNotifications = (currentUser.notifications || []).map(n => 
        n.id === id ? { ...n, read: true } : n
      );

      await updateDoc(userRef, {
        notifications: updatedNotifications
      });
    } catch (error) {
      console.error("Error marking notification as read in user document:", error);
      // Fallback local
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }
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
    const isAsesor = effectiveRole === 'asesor';

    switch (activeTab) {
      case 'dashboard':
        return isAsesor 
          ? <DashboardAdviser transfers={filteredData} user={currentUser!} onNewTransfer={() => setActiveTab('new-transfer')} />
          : <DashboardAdmin transfers={filteredData} user={currentUser!} advisors={advisors} />;
      
      case 'new-transfer':
        return <TransferForm onSubmit={handleNewTransfer} currentUser={currentUser!} advisors={advisors} />;

      case 'my-tasks':
        return (
          <TransferList
            title="Mis Gestiones"
            transfers={filteredData.filter(t => {
              const creatorEmail = (t.createdByEmail || t.createdBy || '').toLowerCase().trim();
              const fromEmail = (t.fromAdvisorEmail || '').toLowerCase().trim();
              const toEmail = (t.toAdvisorEmail || '').toLowerCase().trim();
              const currentUserEmail = (currentUser?.email || '').toLowerCase().trim();
              const currentUserUid = currentUser?.uid || '';
              return (
                creatorEmail === currentUserEmail || 
                t.createdBy === currentUserUid || 
                fromEmail === currentUserEmail ||
                toEmail === currentUserEmail
              );
            })}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
            userRole={effectiveRole}
            advisors={advisors}
            currentUser={currentUser!}
          />
        );

      case 'history':
        return (
          <TransferList
            transfers={filteredData}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
            userRole={effectiveRole}
            advisors={advisors}
          />
        );

      case 'ranking':
        if (isAsesor) {
          setActiveTab('dashboard');
          return null;
        }
        return <Ranking transfers={filteredData} advisors={advisors} />;

      case 'recaudo':
        if (isAsesor) {
          setActiveTab('dashboard');
          return null;
        }
        return (
          <RecaudoTracking
            transfers={filteredData}
            user={currentUser!}
          />
        );



      case 'profile':
        return <Profile user={currentUser!} transfers={filteredData.filter(t => t.fromAdvisorEmail === currentUser!.email)} />;

      case 'user-management':
        return effectiveRole === 'admin' ? <UserManagement /> : null;

      case 'advisor-management':
        return effectiveRole === 'admin' || effectiveRole === 'supervisor' ? <AdvisorManagement /> : null;

      default:
        return <DashboardAdmin transfers={filteredData} user={currentUser!} advisors={advisors} />;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      
      <Sidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        user={{ ...currentUser!, role: effectiveRole }}
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
                <p className="text-sm font-bold leading-none">{currentUser!.name}</p>
                <p className="text-[10px] text-primary font-bold uppercase tracking-wider mt-1">
                  {effectiveRole === 'admin' ? 'Administrador' : effectiveRole === 'supervisor' ? 'Supervisor' : 'Asesor'}
                </p>
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
              <UserMenu user={{...currentUser!, role: effectiveRole}} onLogout={() => signOut()} />
            </div>
          </div>

        </header>

        {/* MAIN */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          {quotaExceeded && (
            <div className="mb-6 p-4 bg-amber-500/10 border-l-4 border-amber-500 text-amber-800 dark:text-amber-200 rounded-r-xl animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-black text-sm">Base de datos en modo local</p>
                  <p className="text-xs font-medium mt-0.5">
                    La cuota gratuita de base de datos de Firebase se ha completado temporalmente. El aplicativo ha activado automáticamente el <strong>motor de persistencia local</strong> para que puedas seguir de forma fluida agregando, aprobando y consultando registros y enviando correos normalmente.
                  </p>
                </div>
                <div className="text-[10px] bg-amber-500/20 text-amber-850 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0">
                  Modo Local Activo
                </div>
              </div>
            </div>
          )}
          {effectiveRole !== 'asesor' && syncError && (
            <div className="mb-6 p-4 bg-orange-100 border-l-4 border-orange-500 text-orange-700 rounded-r-xl animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5" />
                <div>
                  <p className="font-black text-sm">Aviso de Seguridad / Permisos</p>
                  <p className="text-xs font-medium">{syncError}</p>
                </div>
              </div>
            </div>
          )}
          {renderContent()}
        </main>

      </div>

      <Toaster position="top-right" />
    </div>
  );
}
