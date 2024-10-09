import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import { JsonCanonicalizer } from '../JsonCanonicalizer';

export const calculateCidFromString = async (input: string) => {
  const bytes = new TextEncoder().encode(input);
  const result = await sha256.digest(bytes);
  const cid = CID.create(1, 0x55, result);
  return cid.toString();
};

export const calculateCidFromObject = async (input: object) => {
  const canonicalize = JsonCanonicalizer.canonicalize(input);
  if (typeof canonicalize !== 'string') {
    throw new Error('Canonicalize must be a string');
  }
  const cid = await calculateCidFromString(canonicalize);
  return cid;
};
