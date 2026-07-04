import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, addDoc, getDocFromServer, query, where, getDocs } from 'firebase/firestore';
import { ADVISORS } from './constants';
import { logError, logWarn } from './logger';

// Prioridad: 1. Environment variables (manual or injected by platform)
let firebaseConfig = {
// @ts-ignore
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  // @ts-ignore
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  // @ts-ignore
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  // @ts-ignore
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  // @ts-ignore
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  // @ts-ignore
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Determinamos el databaseId
// @ts-ignore
const configDbId = import.meta.env.VITE_FIREBASE_DATABASE_ID;
// @ts-ignore
const configProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

let finalDbId: string | undefined = undefined;
if (configDbId && configDbId.trim() !== "" && configDbId !== "(default)" && configDbId !== configProjectId) {
  finalDbId = configDbId.trim();
}

export const db = finalDbId ? getFirestore(app, finalDbId) : getFirestore(app);

// 🔥 FIRESTORE MONITOR: Tracks read/write calls to detect redundant patterns
export const FirestoreTracer = {
  counters: {} as Record<string, number>,
  track(queryName: string, component: string, type: 'onSnapshot' | 'getDocs' | 'getDoc' | 'write' | 'delete') {
    const key = `[${type.toUpperCase()}] ${queryName} (Componente: ${component})`;
    this.counters[key] = (this.counters[key] || 0) + 1;
    console.log(
      `%c🔥 [FIRESTORE MONITOR] ${key} | Llamado #${this.counters[key]} en esta sesión`, 
      "color: #ff9900; font-weight: bold; background-color: rgba(255, 153, 0, 0.05); padding: 2px 5px; border-radius: 4px;"
    );
    if (this.counters[key] > 5) {
      console.warn(`%c⚠️ CRITICAL: Consulta ${key} se ha ejecutado ${this.counters[key]} veces. ¡Posible bucle de actualización detectado!`, "color: #ff3333; font-weight: bold; font-size: 13px;");
    }
  }
};

// 🔍 TEST CONNECTION
async function testConnection() {
  if (!firebaseConfig.apiKey) {
    logWarn("Firebase API Key is missing. Login might not work until configured.", "Firebase/testConnection");
    return;
  }
  try {
    FirestoreTracer.track('connection-test', 'firebase.ts/testConnection', 'getDoc');
    await getDocFromServer(doc(db, 'asesores', 'connection-test'));
    console.log("Firestore connection verified");
  } catch (error: any) {
    if (error?.message?.includes('offline') || error?.code === 'failed-precondition') {
      logError(error, "Firebase/testConnectionOffline");
    } else {
      logWarn("Firestore connection test result: " + error.code, "Firebase/testConnection");
    }
  }
}
// testConnection();

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  logError(errInfo, 'Firestore Operation');
  // No lanzamos error para que no rompa el flujo si se catching después, pero logueamos
  return errInfo;
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  hd: 'segurosbolivar.com',
  prompt: 'select_account'
});

export const signIn = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  const firebaseUser = result.user;

  if (!firebaseUser.email?.endsWith('@segurosbolivar.com')) {
    await auth.signOut();
    throw new Error('Solo correos corporativos @segurosbolivar.com');
  }

  // Verificar si el usuario ya existe en Firestore
  const userRef = doc(db, 'users', firebaseUser.uid);
  let userSnap;
  try {
    FirestoreTracer.track(`users/${firebaseUser.uid}`, 'firebase.ts/signIn', 'getDoc');
    userSnap = await getDoc(userRef);
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, `users/${firebaseUser.uid}`);
    logWarn("No se pudo leer el perfil de usuario en el login (posiblemente por falta de permisos en Firestore): " + (e instanceof Error ? e.message : String(e)), "Firebase/signInUserRead");
    // Si falla la lectura, asumimos que no podemos acceder y permitimos continuar para que App.tsx use el fallback
  }

  const ADMINS = [
    'taliana.moreno@segurosbolivar.com',
    'helen.pantoja@segurosbolivar.com'
  ];

  const SUPERVISORS = [
    'luis.mondragon@segurosbolivar.com',
    'yulieth.moreno@segurosbolivar.com',
    'ana.gutierrez@segurosbolivar.com',
    'mabel.elizabeth.andrade@segurosbolivar.com',
    'lizeth.osma@segurosbolivar.com',
    'juliana.garcia@segurosbolivar.com'
  ];

  const userEmail = firebaseUser.email?.toLowerCase() || '';

  let advisorInfo = null;
  let isSupervisor = false;

  try {
    const asesoresRef = collection(db, 'asesores');
    const qAsesor = query(asesoresRef, where('email', '==', userEmail));
    FirestoreTracer.track('asesores (Login Lookup)', 'firebase.ts/signIn', 'getDocs');
    const snapAsesor = await getDocs(qAsesor);
    
    if (!snapAsesor.empty) {
      const docData = snapAsesor.docs[0].data();
      advisorInfo = {
        nombre: docData.name,
        correo: docData.email,
        correo_supervisor: docData.supervisorEmail || '',
        supervisor: docData.supervisor || '',
        cartera: docData.cartera || '',
        role: docData.role || 'advisor',
        active: docData.active ?? true
      };
      isSupervisor = docData.role === 'supervisor';
    } else {
      // Fallback a ADVISORS estático si no está en Firestore aún
      const staticMatch = ADVISORS.find(a => a.correo.toLowerCase() === userEmail);
      if (staticMatch) {
        advisorInfo = staticMatch;
      }
    }

    // Chequeamos si su email es supervisor de algún asesor en Firestore
    if (!isSupervisor) {
      const qSuper = query(asesoresRef, where('supervisorEmail', '==', userEmail));
      FirestoreTracer.track('asesores (Login Supervisor Check)', 'firebase.ts/signIn', 'getDocs');
      const snapSuper = await getDocs(qSuper);
      isSupervisor = SUPERVISORS.includes(userEmail) || !snapSuper.empty || ADVISORS.some(a => a.correo_supervisor.toLowerCase() === userEmail);
    }
  } catch (err) {
    logWarn("Error consultando asesores en Firestore para el login, usando fallbacks: " + (err instanceof Error ? err.message : String(err)), "Firebase/signInAdvisorLookup");
    const staticMatch = ADVISORS.find(a => a.correo.toLowerCase() === userEmail);
    if (staticMatch) {
      advisorInfo = staticMatch;
    }
    isSupervisor = SUPERVISORS.includes(userEmail) || ADVISORS.some(a => a.correo_supervisor.toLowerCase() === userEmail);
  }

  const isAdmin = ADMINS.includes(userEmail);

  if (!userSnap || !userSnap.exists()) {
    // Si no existe o no pudimos leerlo, intentamos crearlo solo si es necesario (y si podemos)
    try {
      const newUser = {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName || advisorInfo?.nombre || (isAdmin ? 'Administrador' : isSupervisor ? 'Supervisor' : 'Asesor'),
        email: firebaseUser.email,
        role: isAdmin ? 'admin' : (isSupervisor ? 'supervisor' : 'asesor'),
        supervisorEmail: advisorInfo?.correo_supervisor || '',
        supervisorName: advisorInfo?.supervisor || '',
        cartera: advisorInfo?.cartera || (isAdmin || isSupervisor ? 'Administración' : 'Sin asignar'),
        photoURL: firebaseUser.photoURL,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        status: 'online' as const
      };

      FirestoreTracer.track(`users/${firebaseUser.uid}`, 'firebase.ts/signIn', 'write');
      await setDoc(userRef, newUser);
    } catch (createErr) {
      logWarn("No se pudo crear/inicializar el documento de usuario: " + (createErr instanceof Error ? createErr.message : String(createErr)), "Firebase/signInUserCreate");
    }
  } else {
    // Si ya existe, actualizamos último login, status, y sincronizamos datos del asesor actualizados desde Gestión de Asesores
    const existingRole = userSnap.data()?.role;
    const calculatedRole = isAdmin ? 'admin' : (isSupervisor ? 'supervisor' : 'asesor');
    
    const updates: any = { 
      lastLoginAt: serverTimestamp(),
      status: 'online',
      name: firebaseUser.displayName || advisorInfo?.nombre || userSnap.data()?.name || 'Asesor',
      supervisorEmail: advisorInfo?.correo_supervisor || userSnap.data()?.supervisorEmail || '',
      supervisorName: advisorInfo?.supervisor || userSnap.data()?.supervisorName || '',
      cartera: advisorInfo?.cartera || userSnap.data()?.cartera || 'Sin asignar'
    };
    
    if (existingRole !== calculatedRole) {
      updates.role = calculatedRole;
    }
    
    try {
      FirestoreTracer.track(`users/${firebaseUser.uid}`, 'firebase.ts/signIn', 'write');
      await updateDoc(userRef, updates);
    } catch (e) {
      logWarn("No se pudo actualizar el perfil completo en el login: " + (e instanceof Error ? e.message : String(e)), "Firebase/signInUserUpdate");
      try {
        FirestoreTracer.track(`users/${firebaseUser.uid}`, 'firebase.ts/signIn(fallback)', 'write');
        await updateDoc(userRef, { lastLoginAt: serverTimestamp(), status: 'online' });
      } catch (innerError) {
        logWarn("Error silenciado al actualizar status de usuario: " + (innerError instanceof Error ? innerError.message : String(innerError)), "Firebase/signInUserUpdateFallback");
      }
    }
  }

  // REGISTRAR LOG DE ACCESO
  try {
    const logRef = collection(db, 'login_logs');
    FirestoreTracer.track('login_logs', 'firebase.ts/signIn', 'write');
    await addDoc(logRef, {
      uid: firebaseUser.uid,
      name: firebaseUser.displayName || 'Asesor',
      email: firebaseUser.email,
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent
    });
  } catch (e) {
    handleFirestoreError(e, OperationType.CREATE, 'login_logs');
    // Si falla el log por permisos, no bloqueamos el login del usuario
    logWarn("Log de acceso no registrado (posible falta de reglas en Firebase): " + (e instanceof Error ? e.message : String(e)), "Firebase/signInLog");
  }

  return result;
};

export const signOut = async () => {
  const user = auth.currentUser;
  
  if (user) {
    // Intentamos marcar como offline pero no bloqueamos el logout principal
    // si falla o tarda mucho
    try {
      // Usamos una promesa con un timeout corto para no colgar el botón de cerrar sesión
      FirestoreTracer.track(`users/${user.uid}`, 'firebase.ts/signOut', 'write');
      const updatePromise = updateDoc(doc(db, 'users', user.uid), { status: 'offline' });
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000));
      
      await Promise.race([updatePromise, timeoutPromise]);
    } catch (e) {
      logWarn("No se pudo actualizar el estado offline (posible cierre de sesión rápido): " + (e instanceof Error ? e.message : String(e)), "Firebase/signOutOfflineStatus");
    }
  }
  
  return auth.signOut();
};
