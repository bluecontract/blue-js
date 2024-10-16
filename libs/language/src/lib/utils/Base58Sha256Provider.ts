import { Base58 } from './Base58';
import { JsonBlueValue } from '../../schema';
import { JsonCanonicalizer } from './JsonCanonicalizer';

// Type definition for the subset of Node.js crypto module we're using
type NodeCrypto = {
  createHash(algorithm: string): {
    update(data: string): {
      digest(): Buffer;
    };
  };
};

export class Base58Sha256Provider {
  private isNode: boolean;
  private nodeCrypto: NodeCrypto | null;

  constructor() {
    this.isNode =
      typeof window === 'undefined' && typeof process !== 'undefined';

    if (this.isNode) {
      try {
        this.nodeCrypto = require('crypto');
      } catch (e) {
        this.nodeCrypto = null;

        console.warn(
          'Node.js crypto module not available. Falling back to async operations.'
        );
      }
    } else {
      this.nodeCrypto = null;
    }
  }

  apply(object: JsonBlueValue): string | Promise<string> {
    try {
      const canonized = JsonCanonicalizer.canonicalize(object);
      if (typeof canonized !== 'string') {
        throw new Error('canonized must be a string');
      }

      if (this.isNode && this.nodeCrypto) {
        const hash = this.sha256Sync(canonized);
        return Base58.encode(new Uint8Array(hash));
      } else {
        return this.sha256Async(canonized).then((hash) =>
          Base58.encode(new Uint8Array(hash))
        );
      }
    } catch (e) {
      throw new Error('Problem when generating canonized json.');
    }
  }

  private sha256Sync(input: string): Buffer {
    if (!this.isNode || !this.nodeCrypto) {
      throw new Error(
        'Synchronous SHA-256 is only available in Node.js environment'
      );
    }
    return this.nodeCrypto.createHash('sha256').update(input).digest();
  }

  private async sha256Async(input: string): Promise<ArrayBuffer> {
    if (this.isNode && this.nodeCrypto) {
      return this.sha256Sync(input);
    } else {
      const encoder = new TextEncoder();
      const data = encoder.encode(input);
      return window.crypto.subtle.digest('SHA-256', data);
    }
  }
}
