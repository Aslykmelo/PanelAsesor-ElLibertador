/**
 * Centralized logging helper for professional error handling.
 * Captures and prints all technical information to the developer console,
 * while keeping user-facing interfaces clean and completely free of technical jargon,
 * codes, and stack traces.
 */
export function logError(error: any, contexto: string) {
  console.error(`[${contexto}]`, error);
}

export function logWarn(warning: any, contexto: string) {
  console.warn(`[${contexto}]`, warning);
}
