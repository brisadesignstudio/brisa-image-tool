/// <reference lib="webworker" />
import { Zip, ZipPassThrough } from 'fflate';
import { analyze, finish, open, prepare, release, type Decoded, type Prepared } from './pipeline';
import { ByteCache } from './memo';
import { FriendlyError, type RenderJob, type WorkerRequest, type WorkerResponse, type ZipEntry } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

/** La última imagen decodificada se guarda para no volver a leerla en cada salida. */
let cache: { imageId: string; decoded: Decoded } | null = null;

function remember(imageId: string, decoded: Decoded) {
  if (cache && cache.imageId !== imageId) release(cache.decoded);
  cache = { imageId, decoded };
}

/**
 * Píxeles ya preparados y archivos ya codificados: al cambiar solo la calidad o el peso
 * máximo no se vuelve a leer ni a redimensionar, y una calidad ya probada no se repite.
 */
const preparedCache = new ByteCache<Prepared>(32_000_000, (p) => p.image.data.byteLength);
const encodedCache = new ByteCache<Uint8Array>(16_000_000, (b) => b.byteLength);

function geometryKey(job: RenderJob): string {
  const { sx, sy, sw, sh, iw, ih, cw, ch, ox, oy } = job.layout;
  const surface = job.format === 'jpeg' ? 'plano' : 'alfa';
  return `${job.imageId}|${[sx, sy, sw, sh, iw, ih, cw, ch, ox, oy].join(',')}|${job.background}|${surface}`;
}

async function decodedFor(job: RenderJob): Promise<Decoded> {
  if (cache?.imageId === job.imageId) return cache.decoded;
  const { decoded } = await open(job.file);
  remember(job.imageId, decoded);
  return decoded;
}

/** ZIP sin recomprimir (las imágenes ya están comprimidas), archivo a archivo. */
async function buildZip(entries: ZipEntry[]): Promise<Blob> {
  const parts: Uint8Array[] = [];
  await new Promise<void>((resolve, reject) => {
    const zip = new Zip((error, chunk, final) => {
      if (error) return reject(error);
      parts.push(chunk);
      if (final) resolve();
    });
    (async () => {
      for (const entry of entries) {
        const file = new ZipPassThrough(entry.path);
        zip.add(file);
        file.push(new Uint8Array(await entry.blob.arrayBuffer()), true);
      }
      zip.end();
    })().catch(reject);
  });
  return new Blob(parts as Uint8Array<ArrayBuffer>[], { type: 'application/zip' });
}

function reply(id: number, result: unknown, transfer: Transferable[] = []) {
  self.postMessage({ id, ok: true, result } satisfies WorkerResponse, transfer);
}

function describe(error: unknown): string {
  if (error instanceof FriendlyError) return error.message;
  if (error instanceof RangeError) {
    return 'La imagen es demasiado grande para procesarla en este navegador.';
  }
  return 'Algo falló al procesar la imagen. Vuelve a intentarlo.';
}

async function handle(msg: WorkerRequest) {
  try {
    switch (msg.type) {
      case 'analyze': {
        const { result, decoded } = await analyze(msg.file);
        remember(msg.imageId, decoded);
        reply(msg.id, result);
        break;
      }
      case 'render': {
        const key = geometryKey(msg.job);
        let ready = preparedCache.get(key);
        if (!ready) {
          ready = await prepare(msg.job, await decodedFor(msg.job));
          preparedCache.set(key, ready);
        }
        const { output, transfer } = await finish(msg.job, ready, { cache: encodedCache, prefix: key });
        reply(msg.id, output, transfer);
        break;
      }
      case 'zip': {
        reply(msg.id, await buildZip(msg.entries));
        break;
      }
      case 'forget': {
        if (cache?.imageId === msg.imageId) {
          release(cache.decoded);
          cache = null;
        }
        preparedCache.forget(`${msg.imageId}|`);
        encodedCache.forget(`${msg.imageId}|`);
        reply(msg.id, null);
        break;
      }
    }
  } catch (error) {
    console.error(error);
    self.postMessage({ id: msg.id, ok: false, error: describe(error) } satisfies WorkerResponse);
  }
}

// Un trabajo detrás de otro: así la imagen en memoria nunca cambia a mitad de uno.
let chain: Promise<void> = Promise.resolve();
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  chain = chain.then(() => handle(msg));
};
