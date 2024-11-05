import nodeCrypto from 'crypto';

type Crypto = typeof import('crypto');
type GlobalWithCrypto = {
  crypto: Crypto;
};

const isNode =
  typeof process !== 'undefined' &&
  process.versions != null &&
  process.versions.node != null;

export class CryptoEnvironment {
  private static instance: CryptoEnvironment;
  private readonly browserCrypto: Crypto | null;

  private constructor() {
    this.browserCrypto = this.initBrowserCrypto();
  }

  static getInstance(): CryptoEnvironment {
    if (!this.instance) {
      this.instance = new CryptoEnvironment();
    }
    return this.instance;
  }

  private initBrowserCrypto(): Crypto | null {
    if (isNode) return null;
    return 'crypto' in globalThis
      ? (globalThis as unknown as GlobalWithCrypto).crypto
      : null;
  }

  hasNodeCrypto(): boolean {
    return !!nodeCrypto.createHash;
  }

  getBrowserCrypto(): Crypto | null {
    return this.browserCrypto;
  }

  getNodeCrypto(): Crypto | null {
    return nodeCrypto;
  }
}
