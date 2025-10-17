/**
 * 1:1 port tests for {@code blue.language.processor.util.ProcessorContractConstants}.
 */
import { describe, expect, it } from 'vitest';

import {
  KEY_CHECKPOINT,
  KEY_EMBEDDED,
  KEY_INITIALIZED,
  KEY_TERMINATED,
  RESERVED_CONTRACT_KEYS,
  isProcessorManagedChannel,
  isReservedKey,
} from '../processor-contract-constants.js';

describe('ProcessorContractConstants', () => {
  it('flags reserved keys correctly', () => {
    expect(isReservedKey(KEY_EMBEDDED)).toBe(true);
    expect(isReservedKey(KEY_INITIALIZED)).toBe(true);
    expect(isReservedKey(KEY_TERMINATED)).toBe(true);
    expect(isReservedKey(KEY_CHECKPOINT)).toBe(true);
    expect(isReservedKey('other')).toBe(false);
    expect(isReservedKey(null)).toBe(false);
    expect(isReservedKey(undefined)).toBe(false);
  });

  it('preserves reserved key iteration order', () => {
    expect(Array.from(RESERVED_CONTRACT_KEYS)).toEqual([
      KEY_EMBEDDED,
      KEY_INITIALIZED,
      KEY_TERMINATED,
      KEY_CHECKPOINT,
    ]);
  });

  it('uses placeholder processor managed channel check', () => {
    expect(isProcessorManagedChannel({})).toBe(false);
    expect(isProcessorManagedChannel(null)).toBe(false);
  });
});
