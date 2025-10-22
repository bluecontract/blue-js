import type { Node } from '../types/index.js';

export type TerminationKind = 'GRACEFUL' | 'FATAL';

export class ScopeRuntimeContext {
  private readonly triggeredQueue: Node[] = [];
  private readonly bridgeableEvents: Node[] = [];
  private terminated = false;
  private terminationKindValue: TerminationKind | null = null;
  private terminationReasonValue: string | null = null;
  private cutOff = false;
  private triggeredLimit = -1;
  private bridgeableLimit = -1;

  constructor(private readonly path: string) {}

  scopePath(): string {
    return this.path;
  }

  enqueueTriggered(node: Node): void {
    if (this.cutOff && this.triggeredLimit >= 0 && this.triggeredQueue.length >= this.triggeredLimit) {
      return;
    }
    this.triggeredQueue.push(node);
  }

  pollTriggered(): Node | undefined {
    return this.triggeredQueue.shift();
  }

  peekTriggered(): Node | undefined {
    return this.triggeredQueue[0];
  }

  clearTriggered(): void {
    this.triggeredQueue.length = 0;
  }

  triggeredSize(): number {
    return this.triggeredQueue.length;
  }

  triggeredIsEmpty(): boolean {
    return this.triggeredQueue.length === 0;
  }

  triggeredSnapshot(): readonly Node[] {
    return [...this.triggeredQueue];
  }

  recordBridgeable(node: Node): void {
    if (this.cutOff && this.bridgeableLimit >= 0 && this.bridgeableEvents.length >= this.bridgeableLimit) {
      return;
    }
    this.bridgeableEvents.push(node);
  }

  drainBridgeableEvents(): Node[] {
    let drained: Node[];
    if (this.cutOff && this.bridgeableLimit >= 0 && this.bridgeableLimit < this.bridgeableEvents.length) {
      drained = this.bridgeableEvents.slice(0, this.bridgeableLimit);
    } else {
      drained = [...this.bridgeableEvents];
    }
    this.bridgeableEvents.length = 0;
    return drained;
  }

  isTerminated(): boolean {
    return this.terminated;
  }

  terminationKind(): TerminationKind | null {
    return this.terminationKindValue;
  }

  terminationReason(): string | null {
    return this.terminationReasonValue;
  }

  finalizeTermination(kind: TerminationKind, reason: string | null = null): void {
    if (this.terminated) {
      return;
    }
    this.terminated = true;
    this.terminationKindValue = kind;
    this.terminationReasonValue = reason ?? null;
    this.clearTriggered();
  }

  markCutOff(): void {
    if (this.cutOff) {
      return;
    }
    this.cutOff = true;
    this.triggeredLimit = this.triggeredQueue.length;
    this.bridgeableLimit = this.bridgeableEvents.length;
  }

  isCutOff(): boolean {
    return this.cutOff;
  }
}
