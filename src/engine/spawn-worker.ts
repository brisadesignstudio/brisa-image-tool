/** Crea un worker de procesado (archivo aparte, servido junto al sitio). */
export function spawnWorker(name: string): Worker {
  return new Worker(new URL('./processor.worker.ts', import.meta.url), { type: 'module', name });
}
