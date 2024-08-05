import Big from 'big.js';

/**
 * BigIntegerNumber class extends the Big.js library to handle large integer values.
 * Created to make it similar to Java's implementation in the Blue language.
 */
export class BigIntegerNumber extends Big {
  constructor(value: number | string) {
    super(value);
  }
}
