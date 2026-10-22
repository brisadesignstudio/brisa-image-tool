import type { WorkerRequest, WorkerResponse } from './protocol';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type Payload = DistributiveOmit<WorkerRequest, 'id'>;

interface Task {
  id: number;
  payload: Payload;
  imageId?: string;
  priority: number;
  tag?: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

interface Slot {
  worker: Worker;
  busy: Task | null;
  lastImage?: string;
}

export class CancelledError extends Error {}

export interface RunOptions {
  imageId?: string;
  priority?: number;
  /** Etiqueta para poder cancelar o repriorizar la tarea mientras espera. */
  tag?: string;
}

/** Reparte el trabajo entre varios Web Workers para no bloquear la interfaz. */
export class WorkerPool {
  private slots: Slot[] = [];
  private queue: Task[] = [];
  private nextId = 1;

  constructor(size: number) {
    for (let i = 0; i < size; i++) this.slots.push(this.spawn(i));
  }

  private spawn(index: number): Slot {
    const worker = new Worker(new URL('./processor.worker.ts', import.meta.url), {
      type: 'module',
      name: `brisa-proceso-${index + 1}`,
    });
    const slot: Slot = { worker, busy: null };
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.settle(slot, event.data);
    worker.onerror = (event) => {
      event.preventDefault();
      // Un worker que falla (p. ej. sin memoria) se sustituye por uno nuevo.
      worker.terminate();
      slot.busy?.reject(new Error('El proceso se detuvo inesperadamente. Vuelve a intentarlo.'));
      const position = this.slots.indexOf(slot);
      if (position >= 0) this.slots[position] = this.spawn(index);
      this.pump();
    };
    return slot;
  }

  run<T>(payload: Payload, options: RunOptions = {}): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        id: this.nextId++,
        payload,
        imageId: options.imageId,
        priority: options.priority ?? 0,
        tag: options.tag,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.pump();
    });
  }

  /** Cancela las tareas en espera cuya etiqueta cumpla la condición. */
  cancel(match: (tag: string | undefined) => boolean): void {
    this.queue = this.queue.filter((task) => {
      if (!match(task.tag)) return true;
      task.reject(new CancelledError());
      return false;
    });
  }

  reprioritize(tag: string, priority: number): void {
    for (const task of this.queue) if (task.tag === tag) task.priority = priority;
  }

  /** Mensaje para todos los workers que no espera respuesta (p. ej. liberar memoria). */
  broadcast(payload: Payload): void {
    for (const slot of this.slots) slot.worker.postMessage({ ...payload, id: 0 });
  }

  get pending(): number {
    return this.queue.length + this.slots.filter((s) => s.busy).length;
  }

  private settle(slot: Slot, msg: WorkerResponse) {
    const task = slot.busy;
    if (!task || msg.id !== task.id) return;
    slot.busy = null;
    if (msg.ok) task.resolve(msg.result);
    else task.reject(new Error(msg.error));
    this.pump();
  }

  private pick(slot: Slot): Task {
    let best = 0;
    for (let i = 1; i < this.queue.length; i++) {
      if (this.queue[i].priority > this.queue[best].priority) best = i;
    }
    const top = this.queue[best].priority;
    // Entre las más urgentes, mejor la imagen que este worker ya tiene en memoria.
    const affine = slot.lastImage
      ? this.queue.findIndex((t) => t.priority === top && t.imageId === slot.lastImage)
      : -1;
    return this.queue.splice(affine >= 0 ? affine : best, 1)[0];
  }

  private pump() {
    for (const slot of this.slots) {
      if (slot.busy || this.queue.length === 0) continue;
      const task = this.pick(slot);
      slot.busy = task;
      if (task.imageId) slot.lastImage = task.imageId;
      slot.worker.postMessage({ ...task.payload, id: task.id });
    }
  }
}

export function defaultPoolSize(): number {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  return Math.max(1, Math.min(3, cores - 1));
}
