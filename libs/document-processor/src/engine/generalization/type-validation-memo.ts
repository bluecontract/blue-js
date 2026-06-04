import { normalizePointer } from '../../util/pointer-utils.js';
import { descendantOrEqual } from './type-generalization-pointer-utils.js';

const DEFAULT_MAX_ENTRIES = 4096;
const KEY_SEPARATOR = '\u0000';

export interface TypeValidationMemoOptions {
  readonly maxEntries?: number;
}

export class TypeValidationMemo {
  private readonly maxEntries: number;
  private readonly entries = new Map<string, boolean>();

  constructor(options: TypeValidationMemoOptions = {}) {
    this.maxEntries = Math.max(
      0,
      Math.floor(options.maxEntries ?? DEFAULT_MAX_ENTRIES),
    );
  }

  get(pointer: string, expectedTypeBlueId: string): boolean | undefined {
    if (this.maxEntries === 0) {
      return undefined;
    }
    return this.entries.get(this.key(pointer, expectedTypeBlueId));
  }

  set(pointer: string, expectedTypeBlueId: string, value: boolean): void {
    if (this.maxEntries === 0) {
      return;
    }
    const key = this.key(pointer, expectedTypeBlueId);
    if (!this.entries.has(key) && this.entries.size >= this.maxEntries) {
      this.entries.clear();
    }
    this.entries.set(key, value);
  }

  invalidateForMutation(pointer: string): void {
    if (this.maxEntries === 0 || this.entries.size === 0) {
      return;
    }

    const changedPointer = normalizePointer(pointer);
    for (const key of [...this.entries.keys()]) {
      const entryPointer = this.pointerFromKey(key);
      if (
        descendantOrEqual(entryPointer, changedPointer) ||
        descendantOrEqual(changedPointer, entryPointer)
      ) {
        this.entries.delete(key);
      }
    }
  }

  clear(): void {
    this.entries.clear();
  }

  size(): number {
    return this.entries.size;
  }

  private key(pointer: string, expectedTypeBlueId: string): string {
    return `${normalizePointer(pointer)}${KEY_SEPARATOR}${expectedTypeBlueId}`;
  }

  private pointerFromKey(key: string): string {
    return key.slice(0, key.indexOf(KEY_SEPARATOR));
  }
}
