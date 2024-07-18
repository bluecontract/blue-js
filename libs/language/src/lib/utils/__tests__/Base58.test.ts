import { Base58 } from '../Base58';

const correctInput = new Uint8Array([
  130, 52, 179, 171, 72, 150, 135, 71, 190, 58, 75, 183, 127, 79, 244, 213, 128,
  239, 62, 31, 213, 201, 55, 157, 79, 19, 131, 98, 162, 84, 117, 88,
]);

const correctExpectedBase58String =
  '9mGcQeKTSDTrAdD9bJ1kDSxhRbPqKLudvX937Fvxm1Qs';

const correctBase58String = '9mGcQeKTSDTrAdD9bJ1kDSxhRbPqKLudvX937Fvxm1Qs';
const correctExpectedBytes = new Uint8Array([
  130, 52, 179, 171, 72, 150, 135, 71, 190, 58, 75, 183, 127, 79, 244, 213, 128,
  239, 62, 31, 213, 201, 55, 157, 79, 19, 131, 98, 162, 84, 117, 88,
]);

describe('Base58', () => {
  test('should encode Base58 correctly', () => {
    const result = Base58.encode(correctInput);
    expect(result).toBe(correctExpectedBase58String);
  });

  test('should decode Base58 correctly', () => {
    const result = Base58.decode(correctBase58String);
    expect(result).toEqual(correctExpectedBytes);
  });

  test('should throw an error for invalid Base58 string', () => {
    expect(() => Base58.decode('invalidBlueId')).toThrow(
      'Invalid character found: l'
    );
  });

  it('should encode an empty Uint8Array to an empty string', () => {
    const input = new Uint8Array([]);
    const encoded = Base58.encode(input);
    expect(encoded).toBe('');
  });

  it('should decode an empty string to an empty Uint8Array', () => {
    const input = '';
    const decoded = Base58.decode(input);
    expect(decoded).toEqual(new Uint8Array([]));
  });

  it('should encode a Uint8Array correctly', () => {
    const input = new Uint8Array([104, 101, 108, 108, 111]); // "hello" in ASCII
    const encoded = Base58.encode(input);
    expect(encoded).toBe('Cn8eVZg');
  });

  it('should decode a string correctly', () => {
    const input = 'Cn8eVZg';
    const decoded = Base58.decode(input);
    expect(decoded).toEqual(new Uint8Array([104, 101, 108, 108, 111])); // "hello" in ASCII
  });

  it('should handle leading zeros in encoding', () => {
    const input = new Uint8Array([0, 0, 1, 2, 3]);
    const encoded = Base58.encode(input);
    expect(encoded).toBe('11Ldp');
  });

  it('should handle leading zeros in decoding', () => {
    const input = '11Ldp';
    const decoded = Base58.decode(input);
    expect(decoded).toEqual(new Uint8Array([0, 0, 1, 2, 3]));
  });
});
