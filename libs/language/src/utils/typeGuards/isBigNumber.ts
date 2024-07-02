import Big from 'big.js';

export const isBigNumber = (value: unknown): value is Big =>
  value instanceof Big;
