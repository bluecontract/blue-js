import { Blue, BlueNode } from '@blue-labs/language';
import { canonicalSize } from '../util/node-canonicalizer.js';
import {
  ceil100,
  documentSnapshotAmount,
  expressionAmount,
  jsCodeBaseAmount,
  templateAmount,
  updateDocumentBaseAmount,
} from './gas-helpers.js';
import { normalizeScope } from '../util/pointer-utils.js';

const INITIALIZATION = 1_000;
const CHANNEL_MATCH_ATTEMPT = 5;
const HANDLER_OVERHEAD = 50;
const BOUNDARY_CHECK = 2;
const PATCH_REMOVE = 10;
const BRIDGE_NODE = 10;
const DRAIN_EVENT = 10;
const CHECKPOINT_UPDATE = 20;
const TERMINATION_MARKER = 20;
const LIFECYCLE_DELIVERY = 30;
const TRIGGER_EVENT_BASE = 30;
const FATAL_TERMINATION_OVERHEAD = 100;

function scopeEntryCharge(depth: number): number {
  return 50 + 10 * depth;
}

function patchAddOrReplaceCharge(sizeCharge: number): number {
  return 20 + sizeCharge;
}

function cascadeRoutingCharge(scopeCount: number): number {
  return 10 * scopeCount;
}

function emitEventCharge(sizeCharge: number): number {
  return 20 + sizeCharge;
}

export class GasMeter {
  private total = 0;

  constructor(private readonly blue: Blue) {}

  totalGas(): number {
    return this.total;
  }

  add(amount: number): void {
    this.total += amount;
  }

  chargeScopeEntry(scopePath: string): void {
    this.add(scopeEntryCharge(this.scopeDepth(scopePath)));
  }

  chargeInitialization(): void {
    this.add(INITIALIZATION);
  }

  chargeChannelMatchAttempt(): void {
    this.add(CHANNEL_MATCH_ATTEMPT);
  }

  chargeHandlerOverhead(): void {
    this.add(HANDLER_OVERHEAD);
  }

  chargeBoundaryCheck(): void {
    this.add(BOUNDARY_CHECK);
  }

  chargePatchAddOrReplace(value: BlueNode | null | undefined): void {
    this.add(patchAddOrReplaceCharge(this.payloadSizeCharge(value)));
  }

  chargePatchRemove(): void {
    this.add(PATCH_REMOVE);
  }

  chargeCascadeRouting(scopeCount: number): void {
    if (scopeCount > 0) {
      this.add(cascadeRoutingCharge(scopeCount));
    }
  }

  chargeEmitEvent(event: BlueNode | null | undefined): void {
    this.add(emitEventCharge(this.payloadSizeCharge(event)));
  }

  chargeBridge(): void {
    this.add(BRIDGE_NODE);
  }

  chargeDrainEvent(): void {
    this.add(DRAIN_EVENT);
  }

  chargeCheckpointUpdate(): void {
    this.add(CHECKPOINT_UPDATE);
  }

  chargeTerminationMarker(): void {
    this.add(TERMINATION_MARKER);
  }

  chargeLifecycleDelivery(): void {
    this.add(LIFECYCLE_DELIVERY);
  }

  chargeFatalTerminationOverhead(): void {
    this.add(FATAL_TERMINATION_OVERHEAD);
  }

  chargeJavaScriptCodeBase(code: string): void {
    this.add(jsCodeBaseAmount(code));
  }

  chargeTriggerEventBase(): void {
    this.add(TRIGGER_EVENT_BASE);
  }

  chargeUpdateDocumentBase(changesLen: number): void {
    this.add(updateDocumentBaseAmount(changesLen));
  }

  chargeExpression(expression: string): void {
    this.add(expressionAmount(expression));
  }

  chargeTemplate(placeholderCount: number, template: string): void {
    this.add(templateAmount(placeholderCount, template));
  }

  chargeDocumentSnapshot(
    absPointer: string,
    snapshot: BlueNode | null | undefined,
  ): void {
    const bytes = snapshot ? canonicalSize(this.blue, snapshot) : 0;
    this.add(documentSnapshotAmount(absPointer, bytes));
  }

  chargeWasmGas(amount: bigint | number): void {
    const numeric = typeof amount === 'bigint' ? Number(amount) : amount;
    if (Number.isFinite(numeric) && numeric > 0) {
      this.add(numeric);
    }
  }

  private payloadSizeCharge(node: BlueNode | null | undefined): number {
    if (!node) {
      return 0;
    }
    const bytes = canonicalSize(this.blue, node);
    return ceil100(bytes);
  }

  private scopeDepth(scopePath: string): number {
    const normalized = normalizeScope(scopePath);
    if (normalized === '/' || normalized.length <= 1) {
      return 0;
    }
    let depth = 1;
    for (let i = 1; i < normalized.length; i += 1) {
      if (normalized.charAt(i) === '/') {
        depth += 1;
      }
    }
    return depth;
  }
}
