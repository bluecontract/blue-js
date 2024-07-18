import base32 from 'base32.js';
import { Base58 } from './Base58';

export class CidToBlueId {
  static convert(cid: string): string {
    const encoded = cid.slice(1);
    const decoder = new base32.Decoder({ type: 'rfc4648', lc: true });
    const cidBytes = decoder.write(encoded).finalize();

    if (cidBytes[0] !== 0x01) {
      throw new Error('Unsupported CID version');
    }

    if (cidBytes[1] !== 0x55) {
      throw new Error('Unsupported CID codec');
    }

    const multihash = cidBytes.slice(2);
    if (multihash[0] !== 0x12 || multihash[1] !== 0x20) {
      throw new Error('Unsupported multihash format');
    }

    const sha256Bytes = multihash.slice(2);
    const blueId = Base58.encode(sha256Bytes);

    return blueId;
  }
}
