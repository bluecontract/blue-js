export class Base58 {
  private static readonly ALPHABET =
    '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'.split('');
  private static readonly BASE_58 = BigInt(58);

  public static encode(input: Uint8Array) {
    let value = BigInt('0x' + Buffer.from(input).toString('hex'));
    let base58 = '';

    while (value > BigInt(0)) {
      const divmod = value / Base58.BASE_58;
      const mod = value % Base58.BASE_58;
      base58 = Base58.ALPHABET[Number(mod)] + base58;
      value = divmod;
    }

    // Encode leading zeros as '1's.
    for (let i = 0; i < input.length && input[i] === 0; i++) {
      base58 = Base58.ALPHABET[0] + base58;
    }

    return base58;
  }

  public static decode(input: string) {
    let num = BigInt(0);
    for (const char of input) {
      const index = Base58.ALPHABET.indexOf(char);
      if (index === -1) {
        throw new Error(`Invalid character found: ${char}`);
      }
      num = num * Base58.BASE_58 + BigInt(index);
    }

    let bytes = Buffer.from(num.toString(16), 'hex');
    if (bytes[0] === 0) {
      bytes = bytes.slice(1);
    }

    let leadingZeros = 0;
    for (const char of input) {
      if (char === Base58.ALPHABET[0]) {
        leadingZeros++;
      } else {
        break;
      }
    }

    const result = new Uint8Array(leadingZeros + bytes.length);
    result.set(bytes, leadingZeros);
    return result;
  }
}
