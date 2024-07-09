import { isPreciseNumberString } from '../isPreciseNumberString';

describe('isPreciseNumberString', () => {
  test('should return true for precisely represented numbers', () => {
    expect(isPreciseNumberString('123.456')).toBe(true);
    expect(isPreciseNumberString('1e+21')).toBe(true);
    expect(isPreciseNumberString('0.1')).toBe(true);
    expect(isPreciseNumberString('0')).toBe(true);
    expect(isPreciseNumberString('999')).toBe(true);
  });

  test('should return false for numbers that lose precision', () => {
    expect(isPreciseNumberString('12345678901234567890.1234567890')).toBe(
      false
    );
    expect(isPreciseNumberString('0.12345678901234567890')).toBe(false);
    expect(
      isPreciseNumberString('1234567890123456789012345678901234567890')
    ).toBe(false);
  });

  test('should return false for non-numeric strings', () => {
    expect(isPreciseNumberString('Hello World')).toBe(false);
    expect(isPreciseNumberString('123abc')).toBe(false);
    expect(isPreciseNumberString('abc')).toBe(false);
  });

  test('should return false for special numeric values', () => {
    expect(isPreciseNumberString('NaN')).toBe(false);
    expect(isPreciseNumberString('Infinity')).toBe(false);
    expect(isPreciseNumberString('-Infinity')).toBe(false);
  });
});
