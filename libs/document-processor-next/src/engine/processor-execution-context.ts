import type { ContractBundle } from './contract-bundle.js';
import type { JsonPatch } from '../model/shared/json-patch.js';
import { DocumentProcessingRuntime } from '../runtime/document-processing-runtime.js';
import { ProcessorFatalError } from './processor-fatal-error.js';
import { Blue, BlueNode } from '@blue-labs/language';
import { ProcessorErrors } from '../types/errors.js';
import { ProcessorEngine } from './processor-engine.js';

export interface ExecutionAdapter {
  runtime(): DocumentProcessingRuntime;
  isScopeInactive(scopePath: string): boolean;
  handlePatch(
    scopePath: string,
    bundle: ContractBundle,
    patch: JsonPatch,
    allowReservedMutation: boolean,
  ): void;
  resolvePointer(scopePath: string, relativePointer: string): string;
  enterGracefulTermination(
    scopePath: string,
    bundle: ContractBundle,
    reason: string | null,
  ): void;
  enterFatalTermination(
    scopePath: string,
    bundle: ContractBundle,
    reason: string | null,
  ): void;
}

export class ProcessorExecutionContext {
  constructor(
    private readonly execution: ExecutionAdapter,
    private readonly bundle: ContractBundle,
    private readonly scopePathValue: string,
    private readonly eventNode: BlueNode,
    private readonly allowTerminatedWork: boolean,
    private readonly allowReservedMutation: boolean,
  ) {}

  get scopePath(): string {
    return this.scopePathValue;
  }

  get blue(): Blue {
    return this.execution.runtime().blue();
  }

  event(): BlueNode {
    return this.eventNode;
  }

  applyPatch(patch: JsonPatch): void {
    if (
      !this.allowTerminatedWork &&
      this.execution.isScopeInactive(this.scopePathValue)
    ) {
      return;
    }
    this.execution.handlePatch(
      this.scopePathValue,
      this.bundle,
      patch,
      this.allowReservedMutation,
    );
  }

  emitEvent(emission: BlueNode): void {
    if (
      !this.allowTerminatedWork &&
      this.execution.isScopeInactive(this.scopePathValue)
    ) {
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
    if (
      !this.allowTerminatedWork &&
      this.execution.isScopeInactive(this.scopePathValue)
    ) {
      return;
    }
    this.execution.runtime().addGas(units);
  }

  throwFatal(reason: string): never {
    throw new ProcessorFatalError(reason, ProcessorErrors.runtimeFatal(reason));
  }

  resolvePointer(relativePointer: string): string {
    return this.execution.resolvePointer(this.scopePathValue, relativePointer);
  }

  documentAt(absolutePointer: string): BlueNode | null {
    if (!absolutePointer) {
      return null;
    }
    try {
      const node = this.documentNodeAt(absolutePointer);
      return node ? node.clone() : null;
    } catch {
      return null;
    }
  }

  documentContains(absolutePointer: string): boolean {
    if (!absolutePointer) {
      return false;
    }
    try {
      return (
        ProcessorEngine.nodeAt(
          this.execution.runtime().document(),
          absolutePointer,
        ) != null
      );
    } catch {
      return false;
    }
  }

  private documentNodeAt(absolutePointer: string): BlueNode | null {
    const node = ProcessorEngine.nodeAt(
      this.execution.runtime().document(),
      absolutePointer,
    );
    return node instanceof BlueNode ? node : null;
  }

  terminateGracefully(reason: string | null): void {
    this.execution.enterGracefulTermination(
      this.scopePathValue,
      this.bundle,
      reason ?? null,
    );
  }

  terminateFatally(reason: string | null): void {
    this.execution.enterFatalTermination(
      this.scopePathValue,
      this.bundle,
      reason ?? null,
    );
  }
}
