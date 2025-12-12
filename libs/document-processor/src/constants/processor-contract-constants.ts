import { blueIds } from '@blue-repository/core';

const reservedContractKeysList = [
  'embedded',
  'initialized',
  'terminated',
  'checkpoint',
] as const;

const processorManagedChannelBlueIdsList = [
  blueIds['Document Update Channel'],
  blueIds['Triggered Event Channel'],
  blueIds['Lifecycle Event Channel'],
  blueIds['Embedded Node Channel'],
] as const;

export type ReservedContractKey = (typeof reservedContractKeysList)[number];

export type ProcessorManagedChannelBlueId =
  (typeof processorManagedChannelBlueIdsList)[number];

export const KEY_EMBEDDED: ReservedContractKey = 'embedded';
export const KEY_INITIALIZED: ReservedContractKey = 'initialized';
export const KEY_TERMINATED: ReservedContractKey = 'terminated';
export const KEY_CHECKPOINT: ReservedContractKey = 'checkpoint';

export const RESERVED_CONTRACT_KEYS: ReadonlySet<ReservedContractKey> = new Set(
  reservedContractKeysList,
);

export const PROCESSOR_MANAGED_CHANNEL_BLUE_IDS: ReadonlySet<ProcessorManagedChannelBlueId> =
  new Set(processorManagedChannelBlueIdsList);

export function isReservedContractKey(
  key: string | undefined | null,
): key is ReservedContractKey {
  return key != null && RESERVED_CONTRACT_KEYS.has(key as ReservedContractKey);
}

export function isProcessorManagedChannelBlueId(
  blueId: string | undefined | null,
): blueId is ProcessorManagedChannelBlueId {
  return (
    blueId != null &&
    PROCESSOR_MANAGED_CHANNEL_BLUE_IDS.has(
      blueId as ProcessorManagedChannelBlueId,
    )
  );
}

export const ProcessorContractConstants = {
  KEY_EMBEDDED,
  KEY_INITIALIZED,
  KEY_TERMINATED,
  KEY_CHECKPOINT,
  RESERVED_CONTRACT_KEYS,
  PROCESSOR_MANAGED_CHANNEL_BLUE_IDS,
  isReservedContractKey,
  isProcessorManagedChannelBlueId,
} as const;
