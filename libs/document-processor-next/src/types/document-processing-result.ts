import type { BlueNode } from '@blue-labs/language';

import type { TerminationKind } from '../runtime/scope-runtime-context.js';

export interface ScopeTerminationSummary {
  readonly scopePath: string;
  readonly kind: TerminationKind;
  readonly reason: string | null;
}

export interface DocumentProcessingResult {
  readonly document: BlueNode;
  readonly triggeredEvents: readonly BlueNode[];
  readonly totalGas: number;
  readonly terminatedScopes: readonly ScopeTerminationSummary[];
  readonly runTerminated: boolean;
}
