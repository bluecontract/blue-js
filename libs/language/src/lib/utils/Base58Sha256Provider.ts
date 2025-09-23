import { JsonBlueValue } from '../../schema';
import { JsonCanonicalizer } from './JsonCanonicalizer';
import { sha256 } from 'js-sha256';
import { bs58 } from '../../utils/bs58';
export class Base58Sha256Provider {
  public applySync(object: JsonBlueValue): string {
    const canonized = this.canonicalizeInput(object);
    const hashBytes = this.sha256Bytes(canonized);
    return bs58.encode(hashBytes);
  }

  public async apply(object: JsonBlueValue): Promise<string> {
    const canonized = this.canonicalizeInput(object);
    const hashBytes = this.sha256Bytes(canonized);
    return bs58.encode(hashBytes);
  }

  private canonicalizeInput(object: JsonBlueValue): string {
    const canonized = JsonCanonicalizer.canonicalize(object);
    if (typeof canonized !== 'string') {
      throw new Error('Canonized value must be a string');
    }
    return canonized;
  }

  private sha256Bytes(input: string): Uint8Array {
    const hash = sha256.create();
    hash.update(input);
    return Uint8Array.from(hash.array());
  }
}
