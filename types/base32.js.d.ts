declare module 'base32.js' {
  export class Encoder {
    constructor(options?: { type?: string; lc?: boolean });
    write(buffer: Uint8Array): Encoder;
    finalize(): string;
  }

  export class Decoder {
    constructor(options?: { type?: string; lc?: boolean });
    write(buffer: string): Decoder;
    finalize(): Uint8Array;
  }
}
