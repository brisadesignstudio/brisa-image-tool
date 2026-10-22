/// <reference lib="webworker" />
import { Zip, ZipPassThrough } from 'fflate';
import { analyze, open, release, render, type Decoded } from './pipeline';
import { FriendlyError, type RenderJob, type WorkerRequest, type WorkerResponse, type ZipEntry } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

/** La última imagen decodificada se guarda para no volver a leerla en cada salida. */
let cache: { imageId: string; decoded: Decoded } | null = null;

function remember(imageId: string, decoded: Decoded) {
  if (cache && cache.imageId !== imageId) release(cache.decoded);
  cache = { imageId, decoded };
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
        const decoded = await decodedFor(msg.job);
        const { output, transfer } = await render(msg.job, decoded);
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
