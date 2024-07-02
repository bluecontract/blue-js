import { JsonCanonicalizer } from './JsonCanonicalizer';
import { Base58 } from './Base58';
import { JsonBlueValue } from '../../types';
import { Sha256 } from '@aws-crypto/sha256-universal';

export class Base58Sha256Provider {
  async apply(object: JsonBlueValue) {
    const canonized = JsonCanonicalizer.canonicalize(object);

    const hash = await this.sha256(canonized);
    return Base58.encode(Buffer.from(hash));
  }

  private async sha256(input: string) {
    const hash = new Sha256();
    hash.update(input, 'utf8');
    const result = await hash.digest();

    return result;
  }
}
