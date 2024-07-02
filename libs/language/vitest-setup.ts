import Big from 'big.js';
import { beforeAll } from 'vitest';

beforeAll(() => {
  Big.strict = true;
  // maximum recommended exponent value of a Big
  Big.PE = 1000000;
  // minimum recommended exponent value of a Big
  Big.NE = -1000000;
});
