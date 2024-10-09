import { Base58 } from './Base58';
import { JsonBlueValue } from '../../schema';
import { Sha256 } from '@aws-crypto/sha256-universal';
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

  private async sha256(input: string) {
    const hash = new Sha256();
    hash.update(input, 'utf8');
    const result = await hash.digest();

    return result;
  }
}
