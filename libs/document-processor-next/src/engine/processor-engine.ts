import { Blue } from '@blue-labs/language';

import { ChannelRunner } from './channel-runner.js';
import { CheckpointManager } from './checkpoint-manager.js';
import type { ContractBundle } from './contract-bundle.js';
import type { ContractLoader } from './contract-loader.js';
import { ProcessorExecutionContext } from './processor-execution-context.js';
import { ScopeExecutor } from './scope-executor.js';
import { TerminationService } from './termination-service.js';
import type { ExecutionAdapter } from './processor-execution-context.js';
import type { TerminationExecutionAdapter } from './termination-service.js';
import type { DocumentProcessingRuntime } from '../runtime/document-processing-runtime.js';
import { DocumentProcessingRuntime as Runtime } from '../runtime/document-processing-runtime.js';
import type { JsonPatch } from '../model/shared/json-patch.js';
import { canonicalSignature } from '../util/node-canonicalizer.js';
import { normalizeScope } from '../util/pointer-utils.js';
import type { Node } from '../types/index.js';
import { contractProcessorRegistry } from '../registry/index.js';

interface ExecutionHooks extends ExecutionAdapter, TerminationExecutionAdapter {
  bundleForScope(scopePath: string): ContractBundle | undefined;
  deliverLifecycle(scopePath: string, bundle: ContractBundle | null, event: Node, finalizeAfter: boolean): void;
}

export class ProcessorExecution implements ExecutionHooks {
  private readonly runtime: Runtime;
  private readonly bundles = new Map<string, ContractBundle>();
  private readonly pendingTerminations = new Map<string, { kind: 'GRACEFUL' | 'FATAL'; reason: string | null }>();
  private readonly cutOffScopes = new Set<string>();
  private readonly checkpointManager: CheckpointManager;
  private readonly terminationService: TerminationService;
  private readonly channelRunner: ChannelRunner;
  private readonly scopeExecutor: ScopeExecutor;

  constructor(
    private readonly contractLoader: ContractLoader,
    private readonly registry: ReturnType<typeof contractProcessorRegistry>,
    document: Node,
  ) {
    this.runtime = new Runtime(document);
    this.checkpointManager = new CheckpointManager(this.runtime, canonicalSignature);
    this.terminationService = new TerminationService(this.runtime);
    this.channelRunner = new ChannelRunner(this.runtime, this.checkpointManager, {
      evaluateChannel: (contract, bundle, scopePath, event) => this.evaluateChannel(contract, bundle, scopePath, event),
      isScopeInactive: (scopePath) => this.isScopeInactive(scopePath),
      createContext: (scopePath, bundle, event, allowTerminatedWork, allowReserved) =>
        this.createContext(scopePath, bundle, event, allowTerminatedWork, allowReserved),
      executeHandler: (handler, context) => this.executeHandler(handler, context),
    });
    this.scopeExecutor = new ScopeExecutor({
      runtime: this.runtime,
      contractLoader: this.contractLoader,
      channelRunner: this.channelRunner,
      bundles: this.bundles,
      hooks: {
        isScopeInactive: (scopePath) => this.isScopeInactive(scopePath),
        createContext: (scopePath, bundle, event, allowTerminatedWork, lifecycle) =>
          this.createContext(scopePath, bundle, event, allowTerminatedWork, lifecycle ?? false),
        recordLifecycleForBridging: (scopePath, event) => this.recordLifecycleForBridging(scopePath, event),
        enterFatalTermination: (scope, bundle, reason) => this.enterFatalTermination(scope, bundle, reason ?? null),
        fatalReason: (error, label) => (error instanceof Error && error.message) || label,
        markCutOff: (scopePath) => this.markCutOff(scopePath),
      },
      blueId: (node) => new Blue().calculateBlueIdSync(node),
      nodeAt: (scopePath) => this.nodeAt(scopePath),
      createDocumentUpdateEvent: (data, scopePath) => this.createDocumentUpdateEvent(data, scopePath),
      matchesDocumentUpdate: (scopePath, watchPath, changedPath) => this.matchesDocumentUpdate(scopePath, watchPath, changedPath),
    });
  }

  initializeScope(scopePath: string, chargeScopeEntry: boolean): void {
    this.scopeExecutor.initializeScope(scopePath, chargeScopeEntry);
  }

  loadBundles(scopePath: string): void {
    this.scopeExecutor.loadBundles(scopePath);
  }

  processExternalEvent(scopePath: string, event: Node): void {
    this.scopeExecutor.processExternalEvent(scopePath, event);
  }

  handlePatch(scopePath: string, bundle: ContractBundle, patch: JsonPatch, allowReservedMutation: boolean): void {
    this.scopeExecutor.handlePatch(scopePath, bundle, patch, allowReservedMutation);
  }

  createContext(
    scopePath: string,
    bundle: ContractBundle,
    event: Node,
    allowTerminatedWork = false,
    allowReservedMutation = false,
  ): ProcessorExecutionContext {
    return new ProcessorExecutionContext(
      this,
      bundle,
      scopePath,
      event.clone(),
      allowTerminatedWork,
      allowReservedMutation,
    );
  }

  runtime(): DocumentProcessingRuntime {
    return this.runtime;
  }

  bundleForScope(scopePath: string): ContractBundle | undefined {
    return this.bundles.get(normalizeScope(scopePath));
  }

  isScopeInactive(scopePath: string): boolean {
    const normalized = normalizeScope(scopePath);
    return (
      this.cutOffScopes.has(normalized) ||
      this.pendingTerminations.has(normalized) ||
      this.runtime.isScopeTerminated(normalized)
    );
  }

  handlePatch(scopePath: string, bundle: ContractBundle, patch: JsonPatch, allowReservedMutation: boolean): void {
    this.scopeExecutor.handlePatch(scopePath, bundle, patch, allowReservedMutation);
  }

  resolvePointer(scopePath: string, relativePointer: string): string {
    return resolvePointer(scopePath, relativePointer);
  }

  enterGracefulTermination(scopePath: string, bundle: ContractBundle, reason: string | null): void {
    this.terminate(scopePath, bundle, 'GRACEFUL', reason);
  }

  enterFatalTermination(scopePath: string, bundle: ContractBundle, reason: string | null): void {
    this.terminate(scopePath, bundle, 'FATAL', reason);
  }

  recordPendingTermination(scopePath: string, kind: 'GRACEFUL' | 'FATAL', reason: string | null): void {
    this.pendingTerminations.set(normalizeScope(scopePath), { kind, reason });
  }

  clearPendingTermination(scopePath: string): void {
    this.pendingTerminations.delete(normalizeScope(scopePath));
  }

  markCutOff(scopePath: string): void {
    const normalized = normalizeScope(scopePath);
    if (this.cutOffScopes.add(normalized)) {
      const context = this.runtime.existingScope(normalized);
      context?.markCutOff();
    }
  }

  deliverLifecycle(scopePath: string, bundle: ContractBundle | null, event: Node, finalizeAfter: boolean): void {
    this.scopeExecutor.deliverLifecycle(scopePath, bundle, event, finalizeAfter);
  }

  recordLifecycleForBridging(scopePath: string, event: Node): void {
    const context = this.runtime.scope(scopePath);
    context.recordBridgeable(event.clone());
    if (scopePath === '/') {
      this.runtime.recordRootEmission(event.clone());
    }
  }

  private terminate(scopePath: string, bundle: ContractBundle, kind: 'GRACEFUL' | 'FATAL', reason: string | null): void {
    const normalized = normalizeScope(scopePath);
    if (this.pendingTerminations.has(normalized) || this.runtime.isScopeTerminated(normalized)) {
      return;
    }
    this.pendingTerminations.set(normalized, { kind, reason });
    this.terminationService.terminateScope(this, scopePath, bundle, kind, reason);
  }

  private nodeAt(scopePath: string): Node | null {
    if (scopePath === '/') {
      return this.runtime.document();
    }
    const node = this.runtime.document().get(scopePath);
    return node instanceof BlueNode ? node : null;
  }

  private evaluateChannel(
    contract: ChannelContract,
    bundle: ContractBundle,
    scopePath: string,
    event: Node,
  ): ChannelMatch {
    const processor = this.registry.lookupChannel(contract.blueId);
    if (!processor) {
      return { matches: false };
    }
    const matches = processor.matches(contract, {
      scopePath,
      event,
      eventObject: null,
      markers: new Map(bundle.markerEntries()),
    });
    if (!matches) {
      return { matches: false };
    }
    const eventId = processor.eventId?.(contract, {
      scopePath,
      event,
      eventObject: null,
      markers: new Map(bundle.markerEntries()),
    }) ?? null;
    return { matches: true, eventId, eventNode: event.clone() };
  }

  private executeHandler(contract: HandlerContract, context: ProcessorExecutionContext): void {
    const processor = this.registry.lookupHandler(contract.blueId);
    processor?.execute(contract, context);
  }
}
