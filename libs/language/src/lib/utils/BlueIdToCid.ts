import { CID } from 'multiformats/cid';
import * as raw from 'multiformats/codecs/raw';
import { sha256 } from 'multiformats/hashes/sha2';
import { Base58 } from './Base58';
import { create } from 'multiformats/hashes/digest';

export class BlueIdToCid {
  static convert(blueId: string): string {
    const sha256Bytes: Uint8Array = Base58.decode(blueId);
    const multihash = create(sha256.code, sha256Bytes);
    const cid = CID.create(1, raw.code, multihash);

    return cid.toString();
  }
}
