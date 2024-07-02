declare module 'base32.js' {
  export class Encoder {
    constructor(options?: { type?: string; lc?: boolean });
    write(buffer: Uint8Array): Encoder;
    finalize(): string;
  }
}
