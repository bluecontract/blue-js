import { Blue, BlueNode } from '@blue-labs/language';

import type { ContractBundle } from './contract-bundle.js';
import type { DocumentProcessingRuntime } from '../runtime/document-processing-runtime.js';
import { RELATIVE_TERMINATED } from '../constants/processor-pointer-constants.js';
import { resolvePointer } from '../util/pointer-utils.js';
import type { TerminationKind } from '../runtime/scope-runtime-context.js';
import { RunTerminationError } from './run-termination-error.js';

const blue = new Blue();

export interface TerminationExecutionAdapter {
  recordPendingTermination(scopePath: string, kind: TerminationKind, reason: string | null): void;
  normalizeScope(scopePath: string): string;
  bundleForScope(scopePath: string): ContractBundle | undefined;
  deliverLifecycle(scopePath: string, bundle: ContractBundle | null, event: BlueNode, finalizeAfter: boolean): void;
  clearPendingTermination(scopePath: string): void;
}

export class TerminationService {
  constructor(private readonly runtime: DocumentProcessingRuntime) {}

  terminateScope(
    execution: TerminationExecutionAdapter,
    scopePath: string,
    bundle: ContractBundle | null,
    kind: TerminationKind,
    reason: string | null,
  ): void {
    execution.recordPendingTermination(scopePath, kind, reason ?? null);

    const normalized = execution.normalizeScope(scopePath);
    const pointer = resolvePointer(normalized, RELATIVE_TERMINATED);
    this.runtime.directWrite(pointer, createTerminationMarker(kind, reason));
    this.runtime.chargeTerminationMarker();

    const bundleRef = bundle ?? execution.bundleForScope(normalized) ?? null;
    const lifecycleEvent = createTerminationLifecycleEvent(kind, reason);
    execution.deliverLifecycle(normalized, bundleRef, lifecycleEvent, false);

    const scopeContext = this.runtime.scope(normalized);
    scopeContext.finalizeTermination(kind, reason ?? null);
    execution.clearPendingTermination(scopePath);

    if (kind === 'FATAL') {
      this.runtime.chargeFatalTerminationOverhead();
    }

    if (kind === 'FATAL' && normalized === '/') {
      this.runtime.recordRootEmission(createFatalOutboxEvent(normalized, reason));
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
  kind: TerminationKind,
  reason: string | null,
): BlueNode {
  const marker = nodeFrom({
    type: { blueId: 'ProcessingTerminatedMarker' },
    cause: kind === 'GRACEFUL' ? 'graceful' : 'fatal',
    ...(reason ? { reason } : {}),
  });
  return marker;
}

function createTerminationLifecycleEvent(
  kind: TerminationKind,
  reason: string | null,
): BlueNode {
  return nodeFrom({
    eventType: 'Document Processing Terminated',
    cause: kind === 'GRACEFUL' ? 'graceful' : 'fatal',
    ...(reason ? { reason } : {}),
  });
}

function createFatalOutboxEvent(scopePath: string, reason: string | null): BlueNode {
  return nodeFrom({
    eventType: 'Document Processing Fatal Error',
    domain: scopePath,
    code: 'RuntimeFatal',
    ...(reason ? { reason } : {}),
  });
}

function nodeFrom(value: unknown): BlueNode {
  return blue.jsonValueToNode(value);
}
