import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { ADVISORS } from './constants';

const firebaseConfig = {
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
// @ts-ignore
const dbId = import.meta.env.VITE_FIREBASE_DATABASE_ID;
// @ts-ignore
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

// Lógica de conexión robusta:
// 1. Si dbId es igual al projectId, casi siempre es un error de configuración y debe ser (default)
// 2. Si dbId está vacío, es (default)
// 3. De lo contrario, usamos el dbId proporcionado
let finalDbId: string | undefined = undefined;

if (dbId && dbId.trim() !== "" && dbId !== "(default)" && dbId !== projectId) {
  finalDbId = dbId.trim();
}

export const db = finalDbId ? getFirestore(app, finalDbId) : getFirestore(app);

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
  const userSnap = await getDoc(userRef);

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

  if (!userSnap.exists()) {
    // Buscar info del asesor en la lista precargada
    const advisorInfo = ADVISORS.find(a => a.correo.toLowerCase() === userEmail);
    
    // Si no está en ADVISORS, pero está en la lista de SUPERVISORS, le damos ese rol
    const isSupervisor = SUPERVISORS.includes(userEmail) || ADVISORS.some(a => a.correo_supervisor.toLowerCase() === userEmail);
    const isAdmin = ADMINS.includes(userEmail);

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

    await setDoc(userRef, newUser);
  } else {
    // Si ya existe, actualizamos último login y status, y verificamos si hubo cambio de rol manual o por lista
    const isSupervisor = SUPERVISORS.includes(userEmail) || ADVISORS.some(a => a.correo_supervisor.toLowerCase() === userEmail);
    const isAdmin = ADMINS.includes(userEmail);
    
    const updates: any = { 
      lastLoginAt: serverTimestamp(),
      status: 'online',
      role: isAdmin ? 'admin' : (isSupervisor ? 'supervisor' : 'asesor')
    };
    
    await updateDoc(userRef, updates);
  }

  // REGISTRAR LOG DE ACCESO
  try {
    const logRef = collection(db, 'login_logs');
    await addDoc(logRef, {
      uid: firebaseUser.uid,
      name: firebaseUser.displayName || 'Asesor',
      email: firebaseUser.email,
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent
    });
  } catch (e) {
    // Si falla el log por permisos, no bloqueamos el login del usuario
    console.warn("Log de acceso no registrado (posible falta de reglas en Firebase):", e);
  }

  return result;
};

export const signOut = async () => {
  const user = auth.currentUser;
  if (user) {
    try {
      await updateDoc(doc(db, 'users', user.uid), { status: 'offline' });
    } catch (e) {
      console.error("Error updating status on sign out:", e);
    }
  }
  return auth.signOut();
};
