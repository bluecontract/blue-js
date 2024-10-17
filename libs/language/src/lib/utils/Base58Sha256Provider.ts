import { Base58 } from './Base58';
import { JsonBlueValue } from '../../schema';
import { JsonCanonicalizer } from './JsonCanonicalizer';
import { sha256 } from 'js-sha256';

type NodeCrypto = {
  createHash(algorithm: string): {
    update(data: string): {
      digest(): Buffer;
    };
  };
};

function supportsCryptoModule(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return !!require('crypto').createHash;
  } catch {
    return false;
  }
}

export class Base58Sha256Provider {
  private isNode: boolean;
  private nodeCrypto: NodeCrypto | null;

  constructor() {
    this.isNode =
      typeof window === 'undefined' && typeof process !== 'undefined';

    if (supportsCryptoModule()) {
      this.nodeCrypto = require('crypto');
    } else {
      this.nodeCrypto = null;
    }
  }

  public applySync(object: JsonBlueValue): string {
    const canonized = JsonCanonicalizer.canonicalize(object);
    if (typeof canonized !== 'string') {
      throw new Error('Canonized value must be a string');
    }

    let hash: ArrayBuffer | Buffer;

    if (this.isNode && this.nodeCrypto) {
      hash = this.sha256Sync(canonized);
    } else {
      hash = this.sha256SyncBrowser(canonized);
    }

    return Base58.encode(new Uint8Array(hash));
  }

  public async apply(object: JsonBlueValue): Promise<string> {
    const canonized = JsonCanonicalizer.canonicalize(object);
    if (typeof canonized !== 'string') {
      throw new Error('Canonized value must be a string');
    }

    let hash: ArrayBuffer | Buffer;

    if (this.isNode && this.nodeCrypto) {
      hash = this.sha256Sync(canonized);
    } else {
      hash = await this.sha256Async(canonized);
    }

    return Base58.encode(new Uint8Array(hash));
  }

  private sha256Sync(input: string): Buffer {
    if (!this.isNode || !this.nodeCrypto) {
      throw new Error(
        'Synchronous SHA-256 is not available in this environment'
      );
    }

    return this.nodeCrypto.createHash('sha256').update(input).digest();
  }

  private sha256SyncBrowser(input: string): ArrayBuffer {
    return sha256.arrayBuffer(input);
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
