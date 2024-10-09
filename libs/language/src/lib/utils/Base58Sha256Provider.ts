import { Base58 } from './Base58';
import { JsonBlueValue } from '../../schema';
import { sha256 } from 'multiformats/hashes/sha2';
import { JsonCanonicalizer } from './JsonCanonicalizer';

export class Base58Sha256Provider {
  async apply(object: JsonBlueValue) {
    try {
      const canonized = JsonCanonicalizer.canonicalize(object);
      if (typeof canonized !== 'string') {
        throw new Error('canonized must be a string');
      }

      const hash = await this.sha256(canonized);
      return Base58.encode(Buffer.from(hash));
    } catch (e) {
      throw new Error('Problem when generating canonized json.');
    }
  }

  private async sha256(input: string): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hash = await sha256.digest(data);
    return hash.digest;
  }
}
