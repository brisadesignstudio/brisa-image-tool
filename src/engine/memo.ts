/**
 * Caché pequeña con límite de memoria: al llenarse sale lo usado hace más tiempo.
 * Los workers la usan para no repetir redimensionados ni codificaciones idénticas.
 */
export class ByteCache<V> {
  private entries = new Map<string, { value: V; bytes: number }>();
  private total = 0;

  constructor(
    private readonly limit: number,
    private readonly sizeOf: (value: V) => number,
  ) {}

  get(key: string): V | undefined {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    this.entries.delete(key);
    this.entries.set(key, hit);
    return hit.value;
  }

  set(key: string, value: V): void {
    const bytes = this.sizeOf(value);
    // Lo que ocupa más de la mitad de la caché no se guarda: echaría todo lo demás.
    if (bytes > this.limit / 2) return;
    this.delete(key);
    this.entries.set(key, { value, bytes });
    this.total += bytes;
    for (const [oldest, entry] of this.entries) {
      if (this.total <= this.limit) break;
      this.entries.delete(oldest);
      this.total -= entry.bytes;
    }
  }

  delete(key: string): void {
    const hit = this.entries.get(key);
    if (!hit) return;
    this.entries.delete(key);
    this.total -= hit.bytes;
  }

  /** Olvida todo lo que empiece por un prefijo (p. ej., una imagen quitada). */
  forget(prefix: string): void {
    for (const key of [...this.entries.keys()]) if (key.startsWith(prefix)) this.delete(key);
  }
}
