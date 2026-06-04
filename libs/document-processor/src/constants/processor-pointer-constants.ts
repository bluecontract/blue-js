import {
  KEY_CHECKPOINT,
  KEY_EMBEDDED,
  KEY_INITIALIZED,
  KEY_TERMINATED,
} from './processor-contract-constants.js';

export const RELATIVE_CONTRACTS = '/contracts';
export const RELATIVE_INITIALIZED = `${RELATIVE_CONTRACTS}/${KEY_INITIALIZED}`;
export const RELATIVE_TERMINATED = `${RELATIVE_CONTRACTS}/${KEY_TERMINATED}`;
export const RELATIVE_EMBEDDED = `${RELATIVE_CONTRACTS}/${KEY_EMBEDDED}`;
export const RELATIVE_CHECKPOINT = `${RELATIVE_CONTRACTS}/${KEY_CHECKPOINT}`;

const LAST_EVENTS_SUFFIX = '/lastEvents';

export function relativeContractsEntry(key: string): string {
  return `${RELATIVE_CONTRACTS}/${escapePointerSegment(key)}`;
}

export function relativeCheckpointLastEvent(
  markerKey: string,
  channelKey: string,
): string {
  return `${relativeContractsEntry(markerKey)}${LAST_EVENTS_SUFFIX}/${escapePointerSegment(channelKey)}`;
}

export const ProcessorPointerConstants = {
  RELATIVE_CONTRACTS,
  RELATIVE_INITIALIZED,
  RELATIVE_TERMINATED,
  RELATIVE_EMBEDDED,
  RELATIVE_CHECKPOINT,
  LAST_EVENTS_SUFFIX,
  relativeContractsEntry,
  relativeCheckpointLastEvent,
} as const;

function escapePointerSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}
