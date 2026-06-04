export interface ProcessorTimingSink {
  mark(
    name: string,
    durationMs: number,
    meta?: Readonly<Record<string, unknown>>,
  ): void;
}

export class ProcessorTimer {
  static readonly disabled = new ProcessorTimer(null);

  constructor(private readonly sink: ProcessorTimingSink | null | undefined) {}

  enabled(): boolean {
    return this.sink != null;
  }

  mark(
    name: string,
    durationMs: number,
    meta?: Readonly<Record<string, unknown>>,
  ): void {
    this.sink?.mark(name, durationMs, meta);
  }

  measure<T>(
    name: string,
    work: () => T,
    meta?: Readonly<Record<string, unknown>>,
  ): T {
    if (!this.sink) {
      return work();
    }
    const startedAt = now();
    try {
      return work();
    } finally {
      this.mark(name, now() - startedAt, meta);
    }
  }

  async measureAsync<T>(
    name: string,
    work: () => Promise<T>,
    meta?: Readonly<Record<string, unknown>>,
  ): Promise<T> {
    if (!this.sink) {
      return work();
    }
    const startedAt = now();
    try {
      return await work();
    } finally {
      this.mark(name, now() - startedAt, meta);
    }
  }
}

function now(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}
