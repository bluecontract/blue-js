import { CidToBlueId } from '../CidToBlueId';

describe('CidToBlueId', () => {
  test('should convert CID to blueId correctly', () => {
    const sampleCid =
      'bafkreiecgsz2wsewq5d34oslw57u75gvqdxt4h6vze3z2tytqnrkevdvla';
    const expectedBlueId = '9mGcQeKTSDTrAdD9bJ1kDSxhRbPqKLudvX937Fvxm1Qs';

    const result = CidToBlueId.convert(sampleCid);

    expect(result).toBe(expectedBlueId);
  });

  test('should convert CID to blueId correctly for different CID', () => {
    const sampleCid =
      'bafkreiakdxtbh5mcnv4dwfvcjzgtvwut7zn52pxhx6w6vijmtjrqsuemii';
    const expectedBlueId = 'gVX8re5joC7U7MWa2Mzx8jAxwEny41bns7T9aPqdJdP';

    const result = CidToBlueId.convert(sampleCid);

    expect(result).toBe(expectedBlueId);
  });

  test('should throw an error for invalid CID', () => {
    expect(() => CidToBlueId.convert('invalidCid')).toThrow(
      'Unsupported CID version',
    );
  });
});
