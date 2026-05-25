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
}
