import { NodeDeserializer } from '../../model';
import { BlueIdCalculator } from '../BlueIdCalculator';
import { BlueIdToCid } from '../BlueIdToCid';

export const calculateCidFromString = async (input: string) => {
  const { CID } = await import('multiformats/cid');
  const { sha256 } = await import('multiformats/hashes/sha2');

  const bytes = new TextEncoder().encode(input);
  const result = await sha256.digest(bytes);
  const cid = CID.create(1, 0x55, result);
  return cid.toString();
};

export const calculateCidFromObject = async (input: object) => {
  const blueId = await BlueIdCalculator.calculateBlueId(
    NodeDeserializer.deserialize(input),
  );
  return BlueIdToCid.convert(blueId);
};
