// Versión de archivo único (`npm run build:archivo`): el worker va dentro del propio HTML.
import ProcessorWorker from './processor.worker.ts?worker&inline';

export function spawnWorker(name: string): Worker {
  return new ProcessorWorker({ name });
}
