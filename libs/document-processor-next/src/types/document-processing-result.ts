import type { BlueNode } from '@blue-labs/language';

export interface DocumentProcessingResult {
  readonly document: BlueNode;
  readonly triggeredEvents: readonly BlueNode[];
  readonly totalGas: number;
  readonly capabilityFailure: boolean;
  readonly failureReason: string | null;
}

function freezeEvents(events: readonly BlueNode[]): readonly BlueNode[] {
  return Object.freeze([...events]);
}

const factories = {
  of(
    document: BlueNode,
    triggeredEvents: readonly BlueNode[],
    totalGas: number
  ): DocumentProcessingResult {
    return {
      document,
      triggeredEvents: freezeEvents(triggeredEvents),
      totalGas,
      capabilityFailure: false,
      failureReason: null,
    };
  },

  capabilityFailure(
    document: BlueNode,
    reason: string | null
  ): DocumentProcessingResult {
    return {
      document,
      triggeredEvents: Object.freeze([]),
      totalGas: 0,
      capabilityFailure: true,
      failureReason: reason ?? null,
    };
  },
} as const;

export const DocumentProcessingResult = factories;
