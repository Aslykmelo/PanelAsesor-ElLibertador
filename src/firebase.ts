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
  let userSnap;
  try {
    userSnap = await getDoc(userRef);
  } catch (e) {
    console.warn("No se pudo leer el perfil de usuario en el login (posiblemente por falta de permisos en Firestore):", e);
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

  if (!userSnap || !userSnap.exists()) {
    // Si no existe o no pudimos leerlo, intentamos crearlo solo si es necesario (y si podemos)
    try {
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
    } catch (createErr) {
      console.warn("No se pudo crear/inicializar el documento de usuario:", createErr);
    }
  } else {
    // Si ya existe, actualizamos último login y status
    const existingRole = userSnap.data()?.role;
    const isSupervisor = SUPERVISORS.includes(userEmail) || ADVISORS.some(a => a.correo_supervisor.toLowerCase() === userEmail);
    const isAdmin = ADMINS.includes(userEmail);
    const calculatedRole = isAdmin ? 'admin' : (isSupervisor ? 'supervisor' : 'asesor');
    
    const updates: any = { 
      lastLoginAt: serverTimestamp(),
      status: 'online'
    };
    
    if (existingRole !== calculatedRole) {
      updates.role = calculatedRole;
    }
    
    try {
      await updateDoc(userRef, updates);
    } catch (e) {
      console.warn("No se pudo actualizar el perfil completo en el login:", e);
      try {
        await updateDoc(userRef, { lastLoginAt: serverTimestamp(), status: 'online' });
      } catch (innerError) {
        console.warn("Error silenciado al actualizar status de usuario:", innerError);
      }
    }
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
    // Intentamos marcar como offline pero no bloqueamos el logout principal
    // si falla o tarda mucho
    try {
      // Usamos una promesa con un timeout corto para no colgar el botón de cerrar sesión
      const updatePromise = updateDoc(doc(db, 'users', user.uid), { status: 'offline' });
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000));
      
      await Promise.race([updatePromise, timeoutPromise]);
    } catch (e) {
      console.warn("No se pudo actualizar el estado offline (posible cierre de sesión rápido):", e);
    }
  }
  
  return auth.signOut();
};
