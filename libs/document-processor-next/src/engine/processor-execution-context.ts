import type { Node } from '../types/index.js';
import type { ContractBundle } from './contract-bundle.js';
import type { JsonPatch } from '../model/shared/json-patch.js';
import { DocumentProcessingRuntime } from '../runtime/document-processing-runtime.js';
import { normalizePointer } from '../util/pointer-utils.js';
import { ProcessorFatalError } from './processor-fatal-error.js';
import { BlueNode } from '@blue-labs/language';
import { ProcessorErrors } from '../types/errors.js';

export interface ExecutionAdapter {
  runtime(): DocumentProcessingRuntime;
  isScopeInactive(scopePath: string): boolean;
  handlePatch(scopePath: string, bundle: ContractBundle, patch: JsonPatch, allowReservedMutation: boolean): void;
  resolvePointer(scopePath: string, relativePointer: string): string;
  enterGracefulTermination(scopePath: string, bundle: ContractBundle, reason: string | null): void;
  enterFatalTermination(scopePath: string, bundle: ContractBundle, reason: string | null): void;
}

export class ProcessorExecutionContext {
  constructor(
    private readonly execution: ExecutionAdapter,
    private readonly bundle: ContractBundle,
    private readonly scopePathValue: string,
    private readonly eventNode: Node,
    private readonly allowTerminatedWork: boolean,
    private readonly allowReservedMutation: boolean,
  ) {}

  get scopePath(): string {
    return this.scopePathValue;
  }

  event(): Node {
    return this.eventNode;
  }

  applyPatch(patch: JsonPatch): void {
    if (!this.allowTerminatedWork && this.execution.isScopeInactive(this.scopePathValue)) {
      return;
    }
    this.execution.handlePatch(this.scopePathValue, this.bundle, patch, this.allowReservedMutation);
  }

  emitEvent(emission: Node): void {
    if (!this.allowTerminatedWork && this.execution.isScopeInactive(this.scopePathValue)) {
      return;
    }
    const runtime = this.execution.runtime();
    const scopeContext = runtime.scope(this.scopePathValue);
    runtime.chargeEmitEvent(emission);
    const queued = emission.clone();
    scopeContext.enqueueTriggered(queued);
    scopeContext.recordBridgeable(queued.clone());
    if (this.scopePathValue === '/') {
      runtime.recordRootEmission(queued.clone());
    }
  }

  consumeGas(units: number): void {
    if (!this.allowTerminatedWork && this.execution.isScopeInactive(this.scopePathValue)) {
      return;
    }
    this.execution.runtime().addGas(units);
  }

  throwFatal(reason: string): never {
    throw new ProcessorFatalError(
      reason,
      ProcessorErrors.runtimeFatal(reason),
    );
  }

  resolvePointer(relativePointer: string): string {
    return this.execution.resolvePointer(this.scopePathValue, relativePointer);
  }

  documentAt(absolutePointer: string): Node | null {
    if (!absolutePointer) {
      return null;
    }
    const normalized = normalizePointer(absolutePointer);
    const value = this.execution.runtime().document().get(normalized);
    if (value instanceof BlueNode) {
      return value.clone() as Node;
    }
    if (value === undefined) {
      return null;
    }
    const node = new BlueNode();
    node.setValue(value as unknown as number | string | boolean | null);
    return node;
  }

  documentContains(absolutePointer: string): boolean {
    if (!absolutePointer) {
      return false;
    }
    const normalized = normalizePointer(absolutePointer);
    const value = this.execution.runtime().document().get(normalized);
    return value != null;
  }

  terminateGracefully(reason: string | null): void {
    this.execution.enterGracefulTermination(this.scopePathValue, this.bundle, reason ?? null);
  }

  terminateFatally(reason: string | null): void {
    this.execution.enterFatalTermination(this.scopePathValue, this.bundle, reason ?? null);
  }
}
