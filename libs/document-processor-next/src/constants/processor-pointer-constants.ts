/**
 * 1:1 port of {@code blue.language.processor.util.ProcessorPointerConstants}.
 */
import {
  KEY_CHECKPOINT,
  KEY_EMBEDDED,
  KEY_INITIALIZED,
  KEY_TERMINATED,
} from './processor-contract-constants.js';

export const RELATIVE_CONTRACTS = '/contracts' as const;
export const RELATIVE_INITIALIZED = `${RELATIVE_CONTRACTS}/${KEY_INITIALIZED}` as const;
export const RELATIVE_TERMINATED = `${RELATIVE_CONTRACTS}/${KEY_TERMINATED}` as const;
export const RELATIVE_EMBEDDED = `${RELATIVE_CONTRACTS}/${KEY_EMBEDDED}` as const;
export const RELATIVE_CHECKPOINT = `${RELATIVE_CONTRACTS}/${KEY_CHECKPOINT}` as const;

const LAST_EVENTS_SUFFIX = '/lastEvents';
const LAST_SIGNATURES_SUFFIX = '/lastSignatures';

export function relativeContractsEntry(key: string): string {
  return `${RELATIVE_CONTRACTS}/${key}`;
}

export function relativeCheckpointLastEvent(
  markerKey: string,
  channelKey: string
): string {
  return `${relativeContractsEntry(markerKey)}${LAST_EVENTS_SUFFIX}/${channelKey}`;
}

export function relativeCheckpointLastSignature(
  markerKey: string,
  channelKey: string
): string {
  return `${relativeContractsEntry(markerKey)}${LAST_SIGNATURES_SUFFIX}/${channelKey}`;
}
