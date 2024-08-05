import Big from 'big.js';

/**
 * BigDecimalNumber class extends the Big.js library to handle large float values.
 * Created to make it similar to Java's implementation in the Blue language.
 */
export class BigDecimalNumber extends Big {
  constructor(value: number | string) {
    super(value);
  }
}
