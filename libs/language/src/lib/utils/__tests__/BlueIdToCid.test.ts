import { BlueIdToCid } from '../BlueIdToCid';
import { CidToBlueId } from '../CidToBlueId';

describe('BlueIdToCid', () => {
  test('should convert blueId to CID correctly', () => {
    const sampleBlueId = '9mGcQeKTSDTrAdD9bJ1kDSxhRbPqKLudvX937Fvxm1Qs';
    const expectedCid =
      'bafkreiecgsz2wsewq5d34oslw57u75gvqdxt4h6vze3z2tytqnrkevdvla';

    const result = BlueIdToCid.convert(sampleBlueId);

    expect(result).toBe(expectedCid);
  });

  test('should convert blueId to CID correctly for different blueId lengths', () => {
    const sampleBlueId = 'gVX8re5joC7U7MWa2Mzx8jAxwEny41bns7T9aPqdJdP';
    const expectedCid =
      'bafkreiakdxtbh5mcnv4dwfvcjzgtvwut7zn52pxhx6w6vijmtjrqsuemii';

    const result = BlueIdToCid.convert(sampleBlueId);

    expect(result).toBe(expectedCid);
  });

  test('should throw an error for invalid blueId', () => {
    expect(() => BlueIdToCid.convert('invalidBlueId')).toThrow(
      'Invalid character found: l'
    );
  });

  test('should round trip conversion between blueId and CID', () => {
    const sampleBlueId = '9mGcQeKTSDTrAdD9bJ1kDSxhRbPqKLudvX937Fvxm1Qs';
    const cid = BlueIdToCid.convert(sampleBlueId);
    const blueId = CidToBlueId.convert(cid);

    expect(blueId).toBe(sampleBlueId);
  });
});
