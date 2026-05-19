import { useEffect, useRef } from 'react';
import { db } from '@/firebase';
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
import { ADVISORS } from '@/constants';
import { toast } from 'sonner';

export function useAutoSyncAdvisors(currentUser: any) {
  const hasSynced = useRef(false);

  useEffect(() => {
    if (!currentUser || hasSynced.current) return;
    
    // 🔥 SOLO ADMINISTRADORES PUEDEN SINCRONIZAR/CORREGIR DATOS MASIVAMENTE
    const isAdmin = currentUser.role === 'admin' || 
                    currentUser.email?.toLowerCase() === 'taliana.moreno@segurosbolivar.com' ||
                    currentUser.email?.toLowerCase() === 'helen.pantoja@segurosbolivar.com';
    
    if (!isAdmin) return;

    const performSync = async () => {
      hasSynced.current = true;
      try {
        const advisorsRef = collection(db, 'asesores');
        
        // 1. AUTO-SYNC & CLEANUP DUPLICATES
        console.log("Automatic Sync: Checking advisors and cleaning duplicates...");
        const snapshot = await getDocs(advisorsRef);
        
        const finalBatch = writeBatch(db);
        let syncedCount = 0;
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
            deletedCount++;
          }
        });

        // --- B. SYNC FROM CONSTANTS ---
        for (const adv of ADVISORS) {
          const advEmail = adv.correo.toLowerCase();
          const existingDoc = emailMap.get(advEmail);
          
          const advisorData = {
            name: adv.nombre,
            email: advEmail,
            supervisor: adv.supervisor,
            supervisorEmail: adv.correo_supervisor.toLowerCase(),
            cartera: adv.cartera,
            role: 'advisor',
            active: true,
            updatedAt: serverTimestamp()
          };

          if (existingDoc) {
            // Update if changed
            const currentData = existingDoc.data();
            const hasChanged = 
              currentData.name !== advisorData.name ||
              currentData.supervisor !== advisorData.supervisor ||
              currentData.supervisorEmail !== advisorData.supervisorEmail ||
              currentData.cartera !== advisorData.cartera;

            if (hasChanged) {
              finalBatch.update(existingDoc.ref, advisorData);
              syncedCount++;
            }
          } else {
            // Create new
            const newPartnerRef = doc(advisorsRef);
            finalBatch.set(newPartnerRef, {
              ...advisorData,
              createdAt: serverTimestamp()
            });
            syncedCount++;
          }
        }

        if (syncedCount > 0 || deletedCount > 0) {
          await finalBatch.commit();
          if (deletedCount > 0) console.log(`Automatic Sync: Deleted ${deletedCount} duplicate advisors.`);
          if (syncedCount > 0) console.log(`Automatic Sync: Added/Updated ${syncedCount} advisors from constants.`);
        }

        // 2. AUTO-CORRECT LUIS G. EMAILS
        const targetEmail = 'luis.gonzalez@segurosbolivar.com';
        const correctionBatch = writeBatch(db);
        let correctionsCount = 0;

        const luisVariants = ['Luis Alejandro González Piñeros', 'Luis Alejandro González'];
        
        for (const variant of luisVariants) {
          const q = query(advisorsRef, where('supervisor', '==', variant));
          const snap = await getDocs(q);
          
          snap.docs.forEach(docSnap => {
            const data = docSnap.data();
            if (data.supervisorEmail !== targetEmail) {
              correctionBatch.update(docSnap.ref, { supervisorEmail: targetEmail });
              correctionsCount++;
            }
          });
        }

        if (correctionsCount > 0) {
          await correctionBatch.commit();
          console.log(`Automatic Sync: Corrected ${correctionsCount} supervisor emails for Luis G.`);
        }

      } catch (error) {
        console.error("Automatic Sync Error:", error);
      }
    };

    performSync();
  }, [currentUser]);
}
