import { CID } from 'multiformats/cid';
import { Base58 } from './Base58';

export class CidToBlueId {
  static convert(cidString: string): string {
    let cid: CID;
    try {
      cid = CID.parse(cidString);
    } catch (error) {
      throw new Error('Invalid CID');
    }

    if (cid.version !== 1) {
      throw new Error('Unsupported CID version');
    }

    const multihash = cid.multihash;

    if (multihash.code !== 0x12) {
      throw new Error('Unsupported hash function');
    }

    const sha256Bytes = multihash.digest;
    const blueId = Base58.encode(sha256Bytes);

    return blueId;
  }
}
