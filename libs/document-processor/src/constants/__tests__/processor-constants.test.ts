import { blueIds } from '@blue-repository/types/packages/core/blue-ids';
import {
  KEY_CHECKPOINT,
  KEY_EMBEDDED,
  KEY_INITIALIZED,
  KEY_TERMINATED,
  ProcessorContractConstants,
  PROCESSOR_MANAGED_CHANNEL_BLUE_IDS,
  RESERVED_CONTRACT_KEYS,
  isProcessorManagedChannelBlueId,
  isReservedContractKey,
} from '../processor-contract-constants.js';
import {
  RELATIVE_CHECKPOINT,
  RELATIVE_CONTRACTS,
  RELATIVE_EMBEDDED,
  RELATIVE_INITIALIZED,
  RELATIVE_TERMINATED,
  relativeCheckpointLastEvent,
  relativeCheckpointLastSignature,
  relativeContractsEntry,
} from '../processor-pointer-constants.js';

describe('processor constants', () => {
  it('exposes reserved contract keys', () => {
    expect(
      [...RESERVED_CONTRACT_KEYS].sort((a, b) => a.localeCompare(b)),
    ).toEqual([KEY_CHECKPOINT, KEY_EMBEDDED, KEY_INITIALIZED, KEY_TERMINATED]);
  });

  it('checks reserved contract keys', () => {
    expect(isReservedContractKey(KEY_EMBEDDED)).toBe(true);
    expect(isReservedContractKey('custom')).toBe(false);
  });

  it('checks processor-managed channel blue ids', () => {
    expect(
      isProcessorManagedChannelBlueId(blueIds['Core/Lifecycle Event Channel']),
    ).toBe(true);
    expect(isProcessorManagedChannelBlueId('CustomChannel')).toBe(false);
  });

  it('provides pointer constants', () => {
    expect(RELATIVE_CONTRACTS).toBe('/contracts');
    expect(RELATIVE_INITIALIZED).toBe(`/contracts/${KEY_INITIALIZED}`);
    expect(RELATIVE_TERMINATED).toBe(`/contracts/${KEY_TERMINATED}`);
    expect(RELATIVE_EMBEDDED).toBe(`/contracts/${KEY_EMBEDDED}`);
    expect(RELATIVE_CHECKPOINT).toBe(`/contracts/${KEY_CHECKPOINT}`);
  });

  it('builds pointer helpers', () => {
    expect(relativeContractsEntry('foo')).toBe('/contracts/foo');
    expect(relativeCheckpointLastEvent('checkpoint', 'channel')).toBe(
      '/contracts/checkpoint/lastEvents/channel',
    );
    expect(relativeCheckpointLastSignature('checkpoint', 'channel')).toBe(
      '/contracts/checkpoint/lastSignatures/channel',
    );
  });

  it('keeps legacy namespace compatibility object for ease of porting', () => {
    expect(ProcessorContractConstants.KEY_EMBEDDED).toBe(KEY_EMBEDDED);
    expect(Array.from(PROCESSOR_MANAGED_CHANNEL_BLUE_IDS)).not.toContain(
      ProcessorContractConstants.KEY_EMBEDDED,
    );
  });
});
