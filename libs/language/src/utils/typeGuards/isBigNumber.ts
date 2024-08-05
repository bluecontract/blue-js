import Big from 'big.js';
import { BigDecimalNumber, BigIntegerNumber } from '../../lib/model';

export const isBigNumber = (value: unknown): value is Big =>
  value instanceof Big;

export const isBigIntegerNumber = (value: unknown): value is BigIntegerNumber =>
  isBigNumber(value) && value instanceof BigIntegerNumber;

export const isBigDecimalNumber = (value: unknown): value is BigDecimalNumber =>
  isBigNumber(value) && value instanceof BigDecimalNumber;
