import { JsonBlueValue } from '../../schema';
import { JsonCanonicalizer } from './JsonCanonicalizer';
import { bs58 } from '../../utils/bs58';

export class Base58XXHashProvider {
  private static hasher: { h64: (input: string) => bigint } | null = null;
  private static initPromise: Promise<void> | null = null;

  // ... existing code ...
  private static async initializeHasher(): Promise<void> {
    const { default: xxhash } = await import('xxhash-wasm');
    const hasher = await xxhash();
    Base58XXHashProvider.hasher = hasher;
  }

  private async ensureInitialized(): Promise<void> {
    if (Base58XXHashProvider.hasher) return;

    if (!Base58XXHashProvider.initPromise) {
      Base58XXHashProvider.initPromise =
        Base58XXHashProvider.initializeHasher();
    }

    await Base58XXHashProvider.initPromise;
  }

  public applySync(object: JsonBlueValue): string {
    if (!Base58XXHashProvider.hasher) {
      throw new Error(
        'XXHash not initialized. Use apply() for async initialization'
      );
    }

    const canonized = this.canonicalizeInput(object);
    const hashBigInt = Base58XXHashProvider.hasher.h64(canonized);
    const hashBuffer = this.bigIntToBuffer(hashBigInt);

    return bs58.encode(new Uint8Array(hashBuffer));
  }

  public async apply(object: JsonBlueValue): Promise<string> {
    await this.ensureInitialized();
    return this.applySync(object);
  }

  private canonicalizeInput(object: JsonBlueValue): string {
    const canonized = JsonCanonicalizer.canonicalize(object);
    if (typeof canonized !== 'string') {
      throw new Error('Canonized value must be a string');
    }
    return canonized;
  }

  private bigIntToBuffer(hashBigInt: bigint): ArrayBuffer {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    const lower32Bits = Number(hashBigInt & BigInt('0xFFFFFFFF'));
    const upper32Bits = Number(hashBigInt >> BigInt(32));
    view.setUint32(0, upper32Bits, false);
    view.setUint32(4, lower32Bits, false);
    return buffer;
  }
}
