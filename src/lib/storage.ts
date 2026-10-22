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

/** Guarda un ajuste; devuelve false si el navegador no lo permite (modo privado, cuota llena…). */
export function saveSetting(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** ¿Se puede guardar en este navegador? Se comprueba escribiendo y borrando una marca. */
export function storageAvailable(): boolean {
  try {
    localStorage.setItem(`${PREFIX}prueba`, '1');
    localStorage.removeItem(`${PREFIX}prueba`);
    return true;
  } catch {
    return false;
  }
}
