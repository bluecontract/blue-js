export class Base58 {
  private static readonly ALPHABET =
    '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  private static readonly BASE_MAP = new Uint8Array(256);
  private static readonly BASE_58 = BigInt(58);

  static {
    for (let i = 0; i < Base58.BASE_MAP.length; i++) {
      Base58.BASE_MAP[i] = 255;
    }
    for (let i = 0; i < Base58.ALPHABET.length; i++) {
      Base58.BASE_MAP[Base58.ALPHABET.charCodeAt(i)] = i;
    }
  }

  public static encode(input: Uint8Array): string {
    if (input.length === 0) return '';

    let zeros = 0;
    while (zeros < input.length && input[zeros] === 0) {
      zeros++;
    }

    const encoded = [];
    let value = BigInt(0);
    for (let i = zeros; i < input.length; i++) {
      value = (value << BigInt(8)) + BigInt(input[i]);
    }

    while (value > 0) {
      const mod = value % Base58.BASE_58;
      encoded.push(Base58.ALPHABET[Number(mod)]);
      value = value / Base58.BASE_58;
    }

    while (zeros-- > 0) {
      encoded.push(Base58.ALPHABET[0]);
    }

    return encoded.reverse().join('');
  }

  public static decode(input: string): Uint8Array {
    if (input.length === 0) return new Uint8Array(0);

    let zeros = 0;
    while (zeros < input.length && input[zeros] === '1') {
      zeros++;
    }

    let value = BigInt(0);
    for (const char of input) {
      const index = Base58.BASE_MAP[char.charCodeAt(0)];
      if (index === 255) {
        throw new Error(`Invalid character found: ${char}`);
      }
      value = value * Base58.BASE_58 + BigInt(index);
    }

    const bytes = [];
    while (value > 0) {
      bytes.push(Number(value & BigInt(0xff)));
      value = value >> BigInt(8);
    }

    while (zeros-- > 0) {
      bytes.push(0);
    }

    return new Uint8Array(bytes.reverse());
  }
}
