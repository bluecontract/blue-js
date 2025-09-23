import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getEnvFlag, getEnvVar, getRuntimeInfo } from '../runtimeEnv';

const ORIGINAL_ENV = { ...process.env };
const globalThisTyped = globalThis as { __BLUE_ENV__?: Record<string, string | undefined> };

describe('getEnvVar', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete globalThisTyped.__BLUE_ENV__;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete globalThisTyped.__BLUE_ENV__;
  });

  it('reads values from process.env when available', () => {
    process.env.TEST_FLAG = 'hello';
    expect(getEnvVar('TEST_FLAG')).toBe('hello');
  });

  it('falls back to global __BLUE_ENV__ when value is not set in process.env', () => {
    delete process.env.TEST_FLAG;

    globalThisTyped.__BLUE_ENV__ = { TEST_FLAG: 'global-value' };

    expect(getEnvVar('TEST_FLAG')).toBe('global-value');
  });

  it('returns undefined when the variable is not present', () => {
    expect(getEnvVar('NON_EXISTENT_FLAG')).toBeUndefined();
  });

  it('interprets truthy environment flags', () => {
    process.env.FLAG_TRUE = 'true';
    process.env.FLAG_ONE = '1';
    process.env.FLAG_FALSE = 'false';

    expect(getEnvFlag('FLAG_TRUE')).toBe(true);
    expect(getEnvFlag('FLAG_ONE')).toBe(true);
    expect(getEnvFlag('FLAG_FALSE')).toBe(false);
    expect(getEnvFlag('FLAG_MISSING')).toBe(false);
  });

  it('provides runtime information with sensible fallbacks', () => {
    const info = getRuntimeInfo();
    expect(info.version).toBeTypeOf('string');
    expect(info.platform).toBeTypeOf('string');
    expect(info.arch).toBeTypeOf('string');
  });
});
