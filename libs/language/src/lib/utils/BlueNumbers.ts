import { BigDecimalNumber } from '../model/BigDecimalNumber';
import { BigIntegerNumber } from '../model/BigIntegerNumber';

export class BlueNumbers {
  public static toCanonicalDoubleValue(value: unknown): BigDecimalNumber {
    const numberValue =
      value instanceof BigDecimalNumber || value instanceof BigIntegerNumber
        ? value.toNumber()
        : typeof value === 'number'
          ? value
          : typeof value === 'string'
            ? Number(value)
            : Number.NaN;

    if (!Number.isFinite(numberValue)) {
      throw new Error('Double value must be finite.');
    }

    return new BigDecimalNumber(numberValue.toString());
  }

  public static isExactBinary64Multiple(
    value: unknown,
    multipleOf: unknown,
  ): boolean {
    const valueRational = Binary64Rational.fromNumber(
      this.toFiniteNumber(value),
    );
    const multipleRational = Binary64Rational.fromNumber(
      this.toFiniteNumber(multipleOf),
    );
    return valueRational.dividedByIsInteger(multipleRational);
  }

  private static toFiniteNumber(value: unknown): number {
    const numberValue =
      value instanceof BigDecimalNumber || value instanceof BigIntegerNumber
        ? value.toNumber()
        : typeof value === 'number'
          ? value
          : Number.NaN;
    if (!Number.isFinite(numberValue)) {
      throw new Error('Double value must be finite.');
    }
    return numberValue;
  }
}

class Binary64Rational {
  private constructor(
    private readonly numerator: bigint,
    private readonly denominator: bigint,
  ) {
    if (denominator <= 0n) {
      throw new Error('denominator must be positive');
    }
    const divisor = gcd(abs(numerator), denominator);
    this.numerator = numerator / divisor;
    this.denominator = denominator / divisor;
  }

  static fromNumber(value: number): Binary64Rational {
    if (!Number.isFinite(value)) {
      throw new Error('Double value must be finite.');
    }
    if (Object.is(value, 0) || Object.is(value, -0)) {
      return new Binary64Rational(0n, 1n);
    }

    const bytes = new ArrayBuffer(8);
    const view = new DataView(bytes);
    view.setFloat64(0, value, false);
    const bits = view.getBigUint64(0, false);
    const negative = (bits & (1n << 63n)) !== 0n;
    const exponentBits = Number((bits >> 52n) & 0x7ffn);
    const fraction = bits & 0x000f_ffff_ffff_ffffn;

    let significand: bigint;
    let exponent: number;
    if (exponentBits === 0) {
      significand = fraction;
      exponent = -1074;
    } else {
      significand = (1n << 52n) | fraction;
      exponent = exponentBits - 1023 - 52;
    }
    if (negative) {
      significand = -significand;
    }
    if (exponent >= 0) {
      return new Binary64Rational(significand << BigInt(exponent), 1n);
    }
    return new Binary64Rational(significand, 1n << BigInt(-exponent));
  }

  dividedByIsInteger(divisor: Binary64Rational): boolean {
    if (divisor.numerator === 0n) {
      throw new Error('Division by zero rational.');
    }
    const quotientNumerator = this.numerator * divisor.denominator;
    const quotientDenominator = this.denominator * abs(divisor.numerator);
    return quotientNumerator % quotientDenominator === 0n;
  }
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left;
  let b = right;
  while (b !== 0n) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a === 0n ? 1n : a;
}

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}
