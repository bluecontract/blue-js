/* eslint-disable @typescript-eslint/no-explicit-any */
import { yamlBlueParse } from '../parse';
import Big from 'big.js';

describe('yamlBlueParse - BigNumber Handling', () => {
  it('handles precise number types', () => {
    const yamlString =
      `integer: 42\n` +
      `float: 0.1234\n` +
      `big_integer: 123456789012345678901234567890\n` +
      `big_float: 0.123467891011121131`;
    const result = yamlBlueParse(yamlString) as any;
    expect(result.integer).toEqual(42);
    expect(result.integer).not.toBeInstanceOf(Big);
    expect(result.float).toEqual(0.1234);
    expect(result.float).not.toBeInstanceOf(Big);
  });

  it('parses large integers correctly using Big.js', () => {
    const largeInteger = '123456789012345678901234567890';
    const yamlString = `big_int: ${largeInteger}`;
    const result = yamlBlueParse(yamlString) as any;
    expect(result).toHaveProperty('big_int');
    expect(result?.big_int).toBeInstanceOf(Big);
    expect(result?.big_int.toString()).toBe(largeInteger);
  });

  it('parses large floating-point numbers correctly using Big.js', () => {
    const largeFloat = '1234567890.1234567890123456789';
    const yamlString = `big_float: ${largeFloat}`;
    const result = yamlBlueParse(yamlString) as any;
    expect(result).toHaveProperty('big_float');
    expect(result.big_float).toBeInstanceOf(Big);
    expect(result.big_float.toString()).toBe(largeFloat);
  });

  it('handles large numbers with underscores correctly', () => {
    const yamlString = `big_int: 1_234_567_890_123_456_789_012_345_678_901_234_567_890`;
    const result = yamlBlueParse(yamlString) as any;
    expect(result).toHaveProperty('big_int');
    expect(result.big_int).toBeInstanceOf(Big);
    expect(result.big_int.toString()).toBe(
      '1234567890123456789012345678901234567890'
    );
  });

  it('ensures accuracy with very small floating point numbers', () => {
    const smallFloat = '0.0000000000000000000123456789';
    const yamlString = `small_float: ${smallFloat}`;
    const result = yamlBlueParse(yamlString) as any;
    expect(result).toHaveProperty('small_float');
    expect(result.small_float).toBeInstanceOf(Big);
    expect(result.small_float.toString()).toBe(smallFloat);
  });

  it('handles numbers near floating point precision limits', () => {
    const highPrecisionFloat = '0.0000000000000000000000000001';
    const yamlString = `precise_float: ${highPrecisionFloat}`;
    const result = yamlBlueParse(yamlString) as any;
    expect(result).toHaveProperty('precise_float');
    expect(result.precise_float).toBeInstanceOf(Big);
    expect(result.precise_float.toString()).toBe(highPrecisionFloat);
  });
});
