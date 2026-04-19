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

  if (!userSnap.exists()) {
    // Buscar info del asesor en la lista precargada
    const advisorInfo = ADVISORS.find(a => a.correo.toLowerCase() === firebaseUser.email?.toLowerCase());

    const newUser = {
      uid: firebaseUser.uid,
      name: firebaseUser.displayName || advisorInfo?.nombre || 'Asesor',
      email: firebaseUser.email,
      role: advisorInfo ? 'asesor' : 'supervisor', // Default logic: if in list -> asesor, else supervisor (can be changed manually by admin)
      supervisorEmail: advisorInfo?.correo_supervisor || '',
      supervisorName: advisorInfo?.supervisor || '',
      cartera: advisorInfo?.cartera || 'Sin asignar',
      photoURL: firebaseUser.photoURL,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      status: 'online' as const
    };

    // Forzar admin si es el correo específico de la petición o uno designado
    if (firebaseUser.email?.toLowerCase() === 'taliana.moreno@segurosbolivar.com' || firebaseUser.email?.toLowerCase() === 'helen.pantoja@segurosbolivar.com') {
      newUser.role = 'admin';
    }

    await setDoc(userRef, newUser);
  } else {
    // Si ya existe, actualizamos último login y status
    const updates: any = { 
      lastLoginAt: serverTimestamp(),
      status: 'online'
    };
    
    if (firebaseUser.email?.toLowerCase() === 'taliana.moreno@segurosbolivar.com' || firebaseUser.email?.toLowerCase() === 'helen.pantoja@segurosbolivar.com') {
      updates.role = 'admin';
    }
    
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
