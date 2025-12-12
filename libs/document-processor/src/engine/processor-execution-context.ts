import { Blue, BlueNode } from '@blue-labs/language';
import type { ContractBundle } from './contract-bundle.js';
import type { JsonPatch } from '../model/shared/json-patch.js';
import { ProcessorErrors } from '../types/errors.js';
import { ProcessorEngine } from './processor-engine.js';
import { DocumentProcessingRuntime } from '../runtime/document-processing-runtime.js';
import { ProcessorFatalError } from './processor-fatal-error.js';
import type { GasMeter } from '../runtime/gas-meter.js';

export interface ExecutionAdapter {
  runtime(): DocumentProcessingRuntime;
  isScopeInactive(scopePath: string): boolean;
  handlePatch(
    scopePath: string,
    bundle: ContractBundle,
    patch: JsonPatch,
    allowReservedMutation: boolean,
  ): Promise<void>;
  resolvePointer(scopePath: string, relativePointer: string): string;
  enterGracefulTermination(
    scopePath: string,
    bundle: ContractBundle,
    reason: string | null,
  ): Promise<void>;
  enterFatalTermination(
    scopePath: string,
    bundle: ContractBundle,
    reason: string | null,
  ): Promise<void>;
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

  gasMeter(): GasMeter {
    return this.execution.runtime().gasMeter();
  }

  event(): BlueNode {
    return this.eventNode;
  }

  async applyPatch(patch: JsonPatch): Promise<void> {
    if (this.shouldSkipTerminatedWork()) {
      return;
    }
    await this.execution.handlePatch(
      this.scopePathValue,
      this.bundle,
      patch,
      this.allowReservedMutation,
    );
  }

  emitEvent(emission: BlueNode): void {
    if (this.shouldSkipTerminatedWork()) {
      return;
    }
    const runtime = this.execution.runtime();
    const scopeContext = runtime.scope(this.scopePathValue);
    runtime.gasMeter().chargeEmitEvent(emission);
    const queued = emission.clone();
    scopeContext.enqueueTriggered(queued);
    scopeContext.recordBridgeable(queued.clone());
    if (this.scopePathValue === '/') {
      runtime.recordRootEmission(queued.clone());
    }
  }

  consumeGas(units: number): void {
    if (this.shouldSkipTerminatedWork()) {
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
          {
            calculateBlueId: (node) =>
              this.execution.runtime().blue().calculateBlueIdSync(node),
          },
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
      {
        calculateBlueId: (node) =>
          this.execution.runtime().blue().calculateBlueIdSync(node),
      },
    );
    return node instanceof BlueNode ? node : null;
  }

  async terminateGracefully(reason: string | null): Promise<void> {
    await this.execution.enterGracefulTermination(
      this.scopePathValue,
      this.bundle,
      reason ?? null,
    );
  }

  async terminateFatally(reason: string | null): Promise<void> {
    await this.execution.enterFatalTermination(
      this.scopePathValue,
      this.bundle,
      reason ?? null,
    );
  }

  private shouldSkipTerminatedWork(): boolean {
    return (
      !this.allowTerminatedWork &&
      this.execution.isScopeInactive(this.scopePathValue)
    );
  }
}
