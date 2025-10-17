import { JsonBlueValue } from '../../schema';
import { JsonCanonicalizer } from './JsonCanonicalizer';
import { sha256 } from 'js-sha256';
import { bs58 } from '../../utils/bs58';
import { CryptoEnvironment } from './CryptoEnvironment';

export class Base58Sha256Provider {
  private readonly cryptoEnv = CryptoEnvironment.getInstance();

  public applySync(object: JsonBlueValue): string {
    const canonized = this.canonicalizeInput(object);
    const hash = this.cryptoEnv.hasNodeCrypto()
      ? this.sha256Sync(canonized)
      : this.sha256SyncBrowser(canonized);

    return bs58.encode(new Uint8Array(hash));
  }

  public async apply(object: JsonBlueValue): Promise<string> {
    const canonized = this.canonicalizeInput(object);
    const hash = this.cryptoEnv.hasNodeCrypto()
      ? this.sha256Sync(canonized)
      : await this.sha256Async(canonized);

    return bs58.encode(new Uint8Array(hash));
  }

  private canonicalizeInput(object: JsonBlueValue): string {
    const canonized = JsonCanonicalizer.canonicalize(object);
    if (typeof canonized !== 'string') {
      throw new Error('Canonized value must be a string');
    }
    return canonized;
  }

  private sha256Sync(input: string): Buffer {
    const nodeCrypto = this.cryptoEnv.getNodeCrypto();
    if (!nodeCrypto) {
      throw new Error(
        'Synchronous SHA-256 is not available in this environment'
      );
    }
    return nodeCrypto.createHash('sha256').update(input).digest();
  }

  private sha256SyncBrowser(input: string): ArrayBuffer {
    return sha256.arrayBuffer(input);
  }

  private async sha256Async(input: string): Promise<ArrayBuffer> {
    if (this.cryptoEnv.hasNodeCrypto()) {
      return await this.sha256Async(input);
    }

    const browserCrypto = this.cryptoEnv.getBrowserCrypto();
    if (!browserCrypto) {
      throw new Error('crypto is not available in this environment');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    return browserCrypto.subtle.digest('SHA-256', data);
  }
}
