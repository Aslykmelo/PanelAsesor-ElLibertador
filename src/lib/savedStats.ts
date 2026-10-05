import { todayKey } from '@/lib/itbxCache';

// Último dato bueno de llamadas/conversaciones, guardado en el navegador.
// Sirve para que, al recargar la página o si Infobip/ITBX fallan un momento,
// el asesor siga viendo su último dato del día en vez de un guion en blanco.
// Solo se usa si es de HOY (hora de Bogotá): al cambiar de día se descarta.
export type Saved<T> = T & { day: string; at: number };

export function readSaved<T>(key: string): Saved<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return value?.day === todayKey() ? value : null;
  } catch {
    return null;
  }
}

export function writeSaved<T extends object>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({ ...value, day: todayKey(), at: Date.now() }));
  } catch {
    // Sin almacenamiento local (modo privado, bloqueado): la app funciona igual.
  }
}
