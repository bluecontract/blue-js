import base32 from 'base32.js';
import { Base58 } from './Base58';

export class BlueIdToCid {
  static convert(blueId: string): string {
    const sha256Bytes: Uint8Array = Base58.decode(blueId);

    // Create the multihash bytes for SHA-256 (0x12 for the hash function and 0x20 for the length)
    const multihash: Uint8Array = new Uint8Array(2 + sha256Bytes.length);
    multihash[0] = 0x12; // SHA-256
    multihash[1] = 0x20; // 32 bytes (256 bits)
    multihash.set(sha256Bytes, 2);

    // Create the CIDv1 bytes with version byte (0x01) and codec for raw (0x55)
    const cidBytes: Uint8Array = new Uint8Array(2 + multihash.length);
    cidBytes[0] = 0x01; // CIDv1
    cidBytes[1] = 0x55; // raw binary data
    cidBytes.set(multihash, 2);

    // Encode the CIDv1 with Base32
    const encoder = new base32.Encoder({ type: 'rfc4648', lc: true });
    const cid = 'b' + encoder.write(cidBytes).finalize().replace(/=/g, '');

    return cid;
  }
}
