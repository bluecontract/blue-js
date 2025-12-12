import { describe, it, expect } from 'vitest';

import {
  ProcessorPointerConstants,
  RELATIVE_CONTRACTS,
  RELATIVE_INITIALIZED,
  RELATIVE_TERMINATED,
  RELATIVE_EMBEDDED,
  RELATIVE_CHECKPOINT,
  relativeContractsEntry,
  relativeCheckpointLastEvent,
} from '../constants/processor-pointer-constants.js';

describe('ProcessorPointerConstantsTest', () => {
  it('reservedPointersMatchExpectedPaths', () => {
    expect(RELATIVE_CONTRACTS).toBe('/contracts');
    expect(RELATIVE_INITIALIZED).toBe('/contracts/initialized');
    expect(RELATIVE_TERMINATED).toBe('/contracts/terminated');
    expect(RELATIVE_EMBEDDED).toBe('/contracts/embedded');
    expect(RELATIVE_CHECKPOINT).toBe('/contracts/checkpoint');
    expect(ProcessorPointerConstants.RELATIVE_CONTRACTS).toBe(
      RELATIVE_CONTRACTS,
    );
  });

  it('contractsEntryAppendsKeyWithoutDuplicatingSeparators', () => {
    expect(relativeContractsEntry('custom')).toBe('/contracts/custom');
  });

  it('checkpointLastEventPointerIncludesChannelKey', () => {
    const pointer = relativeCheckpointLastEvent('checkpoint', 'channelA');
    expect(pointer).toBe('/contracts/checkpoint/lastEvents/channelA');
  });
});
