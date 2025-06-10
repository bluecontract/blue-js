import { EventNodePayload } from '../types';

/**
 * Factory functions for creating common event payloads
 */

/**
 * Document Update event operations
 */
export type DocumentUpdateOp = 'add' | 'remove' | 'replace' | 'move' | 'copy';

/**
 * Options for creating a Document Update event
 */
export interface DocumentUpdateEventOptions {
  /** The JSON Patch operation type */
  op: DocumentUpdateOp;
  /** The JSON Pointer path where the operation is applied */
  path: string;
  /** The value to set (for add/replace operations) */
  val?: unknown;
  /** The source path (for move/copy operations) */
  from?: string;
}

/**
 * Creates a Document Update event payload
 */
export function createDocumentUpdateEvent(
  options: DocumentUpdateEventOptions
): EventNodePayload {
  const { op, path, val, from } = options;

  if ((op === 'move' || op === 'copy') && !from) {
    throw new Error(`${op} operation requires 'from' path`);
  }

  if ((op === 'add' || op === 'replace') && val === undefined) {
    throw new Error(`${op} operation requires 'val' property`);
  }

  const payload: EventNodePayload = { type: 'Document Update', op, path };

  if (val !== undefined) payload.val = val;
  if (from !== undefined) payload.from = from;

  return payload;
}

/**
 * Creates a Timeline Entry event payload
 */
export function createTimelineEntryEvent(
  timelineId: string,
  message: unknown
): EventNodePayload {
  return {
    type: 'Timeline Entry',
    timeline: { timelineId },
    message,
  };
}
