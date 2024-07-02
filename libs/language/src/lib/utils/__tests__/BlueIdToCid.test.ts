import { BlueIdToCid } from '../BlueIdToCid';

describe('BlueIdToCid', () => {
  test('should convert blueId to CID correctly', () => {
    const sampleBlueId = '9mGcQeKTSDTrAdD9bJ1kDSxhRbPqKLudvX937Fvxm1Qs';

    const expectedCid =
      'bafkreiecgsz2wsewq5d34oslw57u75gvqdxt4h6vze3z2tytqnrkevdvla';

    const result = BlueIdToCid.convert(sampleBlueId);

    expect(result).toBe(expectedCid);
  });

  test('should throw an error for invalid blueId', () => {
    expect(() => BlueIdToCid.convert('invalidBlueId')).toThrow(
      'Invalid character found: l'
    );
  });
});
