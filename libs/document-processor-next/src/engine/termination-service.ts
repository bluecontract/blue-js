import { Blue, BlueNode } from '@blue-labs/language';
import { blueIds } from '@blue-repository/core';

import type { ContractBundle } from './contract-bundle.js';
import type { DocumentProcessingRuntime } from '../runtime/document-processing-runtime.js';
import { RELATIVE_TERMINATED } from '../constants/processor-pointer-constants.js';
import { resolvePointer } from '../util/pointer-utils.js';
import type { TerminationKind } from '../runtime/scope-runtime-context.js';
import { RunTerminationError } from './run-termination-error.js';
const PROCESSING_TERMINATED_MARKER_BLUE_ID =
  blueIds['Processing Terminated Marker'];
const DOCUMENT_PROCESSING_TERMINATED_BLUE_ID =
  blueIds['Document Processing Terminated'];

export interface TerminationExecutionAdapter {
  recordPendingTermination(
    scopePath: string,
    kind: TerminationKind,
    reason: string | null,
  ): void;
  normalizeScope(scopePath: string): string;
  bundleForScope(scopePath: string): ContractBundle | undefined;
  deliverLifecycle(
    scopePath: string,
    bundle: ContractBundle | null,
    event: BlueNode,
    finalizeAfter: boolean,
  ): Promise<void>;
  clearPendingTermination(scopePath: string): void;
}

export class TerminationService {
  constructor(private readonly runtime: DocumentProcessingRuntime) {}

  async terminateScope(
    execution: TerminationExecutionAdapter,
    scopePath: string,
    bundle: ContractBundle | null,
    kind: TerminationKind,
    reason: string | null,
  ): Promise<void> {
    execution.recordPendingTermination(scopePath, kind, reason ?? null);

    const normalized = execution.normalizeScope(scopePath);
    const pointer = resolvePointer(normalized, RELATIVE_TERMINATED);
    this.runtime.directWrite(
      pointer,
      createTerminationMarker(this.runtime.blue(), kind, reason),
    );
    this.runtime.gasMeter().chargeTerminationMarker();

    const bundleRef = bundle ?? execution.bundleForScope(normalized) ?? null;
    const lifecycleEvent = createTerminationLifecycleEvent(kind, reason);
    await execution.deliverLifecycle(
      normalized,
      bundleRef,
      lifecycleEvent,
      false,
    );

    const scopeContext = this.runtime.scope(normalized);
    scopeContext.finalizeTermination(kind, reason ?? null);
    execution.clearPendingTermination(scopePath);

    if (kind === 'FATAL') {
      this.runtime.gasMeter().chargeFatalTerminationOverhead();
    }

    if (kind === 'FATAL' && normalized === '/') {
      this.runtime.markRunTerminated();
      throw new RunTerminationError(true);
    }

    if (kind === 'GRACEFUL' && normalized === '/') {
      this.runtime.markRunTerminated();
      throw new RunTerminationError(false);
    }
  }
}

function createTerminationMarker(
  blue: Blue,
  kind: TerminationKind,
  reason: string | null,
): BlueNode {
  const marker = nodeFrom(blue, {
    type: { blueId: PROCESSING_TERMINATED_MARKER_BLUE_ID },
    cause: kind === 'GRACEFUL' ? 'graceful' : 'fatal',
    ...(reason ? { reason } : {}),
  });
  return marker;
}

function createTerminationLifecycleEvent(
  kind: TerminationKind,
  reason: string | null,
): BlueNode {
  const event = new BlueNode().setType(
    new BlueNode().setBlueId(DOCUMENT_PROCESSING_TERMINATED_BLUE_ID),
  );
  event.addProperty(
    'cause',
    new BlueNode().setValue(kind === 'GRACEFUL' ? 'graceful' : 'fatal'),
  );
  if (reason) {
    event.addProperty('reason', new BlueNode().setValue(reason));
  }
  return event;
}

function nodeFrom(blue: Blue, value: unknown): BlueNode {
  return blue.jsonValueToNode(value);
}
