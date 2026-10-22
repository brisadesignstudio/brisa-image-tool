/**
 * Ajustes guardados en este dispositivo (localStorage). Nunca se guardan
 * imágenes. Si el navegador bloquea el almacenamiento, la herramienta sigue
 * funcionando con los valores por defecto.
 */
const PREFIX = 'brisa-imagenes:v1:';

export function loadSetting<T>(key: string, fallback: T, validate: (raw: unknown) => T | null): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    const value = validate(JSON.parse(raw));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveSetting(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Sin almacenamiento disponible (modo privado, cuota llena…): no pasa nada.
  }
}
