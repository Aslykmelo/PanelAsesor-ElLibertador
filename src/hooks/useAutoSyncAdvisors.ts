import { useEffect, useRef } from 'react';
import { db, FirestoreTracer } from '@/firebase';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  writeBatch, 
  serverTimestamp,
  addDoc,
  doc
} from 'firebase/firestore';
import { toast } from 'sonner';

export function useAutoSyncAdvisors(currentUser: any) {
  const hasSynced = useRef(false);

  useEffect(() => {
    if (!currentUser || hasSynced.current) return;
    
    // 🔥 SOLO ADMINISTRADORES PUEDEN SINCRONIZAR/CORREGIR DATOS MASIVAMENTE
    const isAdmin = currentUser.role === 'admin' || 
                    currentUser.email?.toLowerCase() === 'taliana.moreno@segurosbolivar.com' ||
                    currentUser.email?.toLowerCase() === 'helen.pantoja@segurosbolivar.com' ||
                    currentUser.email?.toLowerCase() === 'asly.camelo@segurosbolivar.com';
    
    if (!isAdmin) return;

    const syncKey = `advisors_auto_synced_${currentUser.uid}`;
    if (typeof window !== 'undefined' && sessionStorage.getItem(syncKey) === 'true') {
      console.log("Automatic Sync: Already complete for this session. Skipping queries.");
      hasSynced.current = true;
      return;
    }

    const performSync = async () => {
      hasSynced.current = true;
      try {
        const advisorsRef = collection(db, 'asesores');
        
        // 1. AUTO-SYNC & CLEANUP DUPLICATES
        console.log("Automatic Sync: Checking advisors and cleaning duplicates...");
        FirestoreTracer.track('asesores (AutoSync List)', 'useAutoSyncAdvisors', 'getDocs');
        const snapshot = await getDocs(advisorsRef);
        
        const finalBatch = writeBatch(db);
        const finalBatchOps: Array<{ collection: string; docId: string; operation: string; data?: any }> = [];
        const syncedCount = 0;
        let deletedCount = 0;

        // --- B. CLEANUP ACTUAL DUPLICATES IN FIRESTORE ---
        const emailMap = new Map();
        snapshot.docs.forEach(docSnap => {
          const email = docSnap.data().email?.toLowerCase();
          if (!email) return;
          if (!emailMap.has(email)) {
            emailMap.set(email, docSnap);
          } else {
            // Already have one, delete this one
            finalBatch.delete(docSnap.ref);
            finalBatchOps.push({ collection: 'asesores', docId: docSnap.id, operation: 'delete' });
            deletedCount++;
          }
        });

        // Ya NO se vuelven a crear asesores desde el listado fijo del código: la
        // lista viva es la de "Gestión Asesores". Antes, cada vez que un
        // administrador entraba, los asesores que faltaban en Firestore
        // (incluidos los que se habían eliminado a propósito) reaparecían.

        if (syncedCount > 0 || deletedCount > 0) {
          console.log("=== FIRESTORE BATCH SYNC COMMIT INICIO ===");
          console.log("Usuario autenticado:", currentUser?.email, "UID:", currentUser?.uid);
          finalBatchOps.forEach((op, index) => {
            console.log(`[Operación ${index + 1}/${finalBatchOps.length}]`, {
              colección: op.collection,
              documento: op.docId,
              operación: op.operation,
              datos: op.data
            });
          });
          console.log("==========================================");
          await finalBatch.commit();
          if (deletedCount > 0) console.log(`Automatic Sync: Deleted ${deletedCount} duplicate advisors.`);
          if (syncedCount > 0) console.log(`Automatic Sync: Added ${syncedCount} new advisors from constants.`);
        }

        if (typeof window !== 'undefined') {
          sessionStorage.setItem(syncKey, 'true');
        }
      } catch (error) {
        console.error("Automatic Sync Error:", error);
      }
    };

    performSync();
  }, [currentUser?.uid]);
}
