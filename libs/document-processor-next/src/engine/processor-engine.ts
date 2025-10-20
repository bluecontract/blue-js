import { Blue, BlueNode } from '@blue-labs/language';

import { ChannelRunner, type ChannelMatch } from './channel-runner.js';
import { CheckpointManager } from './checkpoint-manager.js';
import type {
  ChannelBinding,
  ContractBundle,
  HandlerBinding,
} from './contract-bundle.js';
import type { ContractLoader } from './contract-loader.js';
import { ProcessorExecutionContext } from './processor-execution-context.js';
import { ScopeExecutor } from './scope-executor.js';
import { TerminationService } from './termination-service.js';
import type { ExecutionAdapter } from './processor-execution-context.js';
import type { TerminationExecutionAdapter } from './termination-service.js';
import {
  DocumentProcessingRuntime as Runtime,
  type DocumentProcessingRuntime,
  type DocumentUpdateData,
} from '../runtime/document-processing-runtime.js';
import type { JsonPatch } from '../model/shared/json-patch.js';
import { canonicalSignature } from '../util/node-canonicalizer.js';
import {
  normalizePointer,
  normalizeScope,
  relativizePointer,
  resolvePointer,
} from '../util/pointer-utils.js';
import type { Node } from '../types/index.js';
import type { ContractProcessorRegistry } from '../registry/contract-processor-registry.js';
import type { ChannelContract } from '../model/index.js';
import type { ChannelEvaluationContext } from '../registry/types.js';
import type { TerminationKind } from '../runtime/scope-runtime-context.js';

interface ExecutionHooks
  extends ExecutionAdapter,
    TerminationExecutionAdapter {
  bundleForScope(scopePath: string): ContractBundle | undefined;
  deliverLifecycle(
    scopePath: string,
    bundle: ContractBundle | null,
    event: Node,
    finalizeAfter: boolean,
  ): void;
}

export class ProcessorExecution implements ExecutionHooks {
  private readonly runtimeRef: Runtime;
  private readonly bundles = new Map<string, ContractBundle>();
  private readonly pendingTerminations = new Map<
    string,
    { kind: TerminationKind; reason: string | null }
  >();
  private readonly cutOffScopes = new Set<string>();
  private readonly checkpointManager: CheckpointManager;
  private readonly terminationService: TerminationService;
  private readonly channelRunner: ChannelRunner;
  private readonly scopeExecutor: ScopeExecutor;
  private readonly blue = new Blue();

  constructor(
    private readonly contractLoader: ContractLoader,
    private readonly registry: ContractProcessorRegistry,
    document: Node,
  ) {
    this.runtimeRef = new Runtime(document);
    this.checkpointManager = new CheckpointManager(
      this.runtimeRef,
      canonicalSignature,
    );
    this.terminationService = new TerminationService(this.runtimeRef);
    this.channelRunner = new ChannelRunner(
      this.runtimeRef,
      this.checkpointManager,
      {
        evaluateChannel: (channel, bundle, scopePath, event) =>
          this.evaluateChannel(channel, bundle, scopePath, event),
        isScopeInactive: (scopePath) => this.isScopeInactive(scopePath),
        createContext: (scopePath, bundle, event, allowTerminatedWork) =>
          this.createContext(
            scopePath,
            bundle,
            event,
            allowTerminatedWork,
            false,
          ),
        executeHandler: (handler, context) =>
          this.executeHandler(handler, context),
      },
    );
    this.scopeExecutor = new ScopeExecutor({
      runtime: this.runtimeRef,
      contractLoader: this.contractLoader,
      channelRunner: this.channelRunner,
      bundles: this.bundles,
      hooks: {
        isScopeInactive: (scopePath) => this.isScopeInactive(scopePath),
        createContext: (
          scopePath,
          bundle,
          event,
          allowTerminatedWork,
          allowReserved,
        ) =>
          this.createContext(
            scopePath,
            bundle,
            event,
            allowTerminatedWork,
            allowReserved ?? false,
          ),
        recordLifecycleForBridging: (scopePath, event) =>
          this.recordLifecycleForBridging(scopePath, event),
        enterFatalTermination: (scope, bundle, reason) =>
          this.enterFatalTermination(scope, bundle, reason ?? null),
        fatalReason: (error, label) =>
          (error instanceof Error && error.message) || label,
        markCutOff: (scopePath) => this.markCutOff(scopePath),
      },
      blueId: (node) => this.blue.calculateBlueIdSync(node),
      nodeAt: (scopePath) => this.nodeAt(scopePath),
      createDocumentUpdateEvent: (data, scopePath) =>
        this.createDocumentUpdateEvent(data, scopePath),
      matchesDocumentUpdate: (scopePath, watchPath, changedPath) =>
        this.matchesDocumentUpdate(scopePath, watchPath, changedPath),
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

  handlePatch(
    scopePath: string,
    bundle: ContractBundle,
    patch: JsonPatch,
    allowReservedMutation: boolean,
  ): void {
    this.scopeExecutor.handlePatch(
      scopePath,
      bundle,
      patch,
      allowReservedMutation,
    );
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
    return this.runtimeRef;
  }

  bundleForScope(scopePath: string): ContractBundle | undefined {
    return this.bundles.get(normalizeScope(scopePath));
  }

  isScopeInactive(scopePath: string): boolean {
    const normalized = normalizeScope(scopePath);
    return (
      this.cutOffScopes.has(normalized) ||
      this.pendingTerminations.has(normalized) ||
      this.runtimeRef.isScopeTerminated(normalized)
    );
  }

  enterGracefulTermination(
    scopePath: string,
    bundle: ContractBundle | null,
    reason: string | null,
  ): void {
    this.terminate(scopePath, bundle, 'GRACEFUL', reason);
  }

  enterFatalTermination(
    scopePath: string,
    bundle: ContractBundle | null,
    reason: string | null,
  ): void {
    this.terminate(scopePath, bundle, 'FATAL', reason);
  }

  recordPendingTermination(
    scopePath: string,
    kind: TerminationKind,
    reason: string | null,
  ): void {
    this.pendingTerminations.set(normalizeScope(scopePath), { kind, reason });
  }

  clearPendingTermination(scopePath: string): void {
    this.pendingTerminations.delete(normalizeScope(scopePath));
  }

  markCutOff(scopePath: string): void {
    const normalized = normalizeScope(scopePath);
    if (this.cutOffScopes.add(normalized)) {
      const context = this.runtimeRef.existingScope(normalized);
      context?.markCutOff();
    }
  }

  deliverLifecycle(
    scopePath: string,
    bundle: ContractBundle | null,
    event: Node,
    finalizeAfter: boolean,
  ): void {
    this.scopeExecutor.deliverLifecycle(scopePath, bundle, event, finalizeAfter);
  }

  recordLifecycleForBridging(scopePath: string, event: Node): void {
    const context = this.runtimeRef.scope(scopePath);
    context.recordBridgeable(event.clone());
    if (scopePath === '/') {
      this.runtimeRef.recordRootEmission(event.clone());
    }
  }

  normalizeScope(scopePath: string): string {
    return normalizeScope(scopePath);
  }

  resolvePointer(scopePath: string, relativePointer: string): string {
    return resolvePointer(scopePath, relativePointer);
  }

  private terminate(
    scopePath: string,
    bundle: ContractBundle | null,
    kind: TerminationKind,
    reason: string | null,
  ): void {
    const normalized = normalizeScope(scopePath);
    if (
      this.pendingTerminations.has(normalized) ||
      this.runtimeRef.isScopeTerminated(normalized)
    ) {
      return;
    }
    this.pendingTerminations.set(normalized, { kind, reason });
    this.terminationService.terminateScope(
      this,
      scopePath,
      bundle,
      kind,
      reason,
    );
  }

  private nodeAt(scopePath: string): Node | null {
    const normalized = normalizeScope(scopePath);
    if (normalized === '/') {
      return this.runtimeRef.document();
    }

    const segments = normalized.slice(1).split('/');
    let current: Node | null = this.runtimeRef.document();

    for (const segment of segments) {
      if (!current) {
        return null;
      }
      if (!segment) {
        continue;
      }

      const items = current.getItems();
      if (items && /^\d+$/.test(segment)) {
        const index = Number.parseInt(segment, 10);
        current = items[index] ?? null;
        continue;
      }

      const properties = current.getProperties() as
        | Record<string, Node>
        | undefined;
      if (!properties) {
        return null;
      }
      const nextNode = properties[segment] as Node | undefined;
      if (!(nextNode instanceof BlueNode)) {
        return null;
      }
      current = nextNode;
    }

    return current;
  }

  private evaluateChannel(
    channel: ChannelBinding,
    bundle: ContractBundle,
    scopePath: string,
    event: Node,
  ): ChannelMatch {
    const processor = this.registry.lookupChannel(channel.blueId());
    if (!processor) {
      return { matches: false };
    }

    const eventClone = event.clone();
    const evaluationContext: ChannelEvaluationContext = {
      scopePath,
      event: eventClone,
      eventObject: undefined,
      markers: new Map<string, unknown>(bundle.markerEntries()),
    };

    const matchesResult = processor.matches(
      channel.contract() as ChannelContract,
      evaluationContext,
    );
    if (matchesResult instanceof Promise) {
      throw new Error('Async channel processors are not supported');
    }
    if (!matchesResult) {
      return { matches: false };
    }

    const eventIdResult = processor.eventId?.(
      channel.contract() as ChannelContract,
      evaluationContext,
    );
    if (eventIdResult instanceof Promise) {
      throw new Error('Async channel processors are not supported');
    }

    return {
      matches: true,
      eventId: eventIdResult ?? null,
      eventNode: eventClone.clone(),
    };
  }

  private executeHandler(
    handler: HandlerBinding,
    context: ProcessorExecutionContext,
  ): void {
    const processor = this.registry.lookupHandler(handler.blueId());
    processor?.execute(handler.contract(), context);
  }

  private createDocumentUpdateEvent(
    data: DocumentUpdateData,
    scopePath: string,
  ): Node {
    const relativePath = relativizePointer(scopePath, data.path);

    const beforeNode =
      data.before != null ? data.before.clone() : new BlueNode().setValue(null);
    const afterNode =
      data.after != null ? data.after.clone() : new BlueNode().setValue(null);

    const eventNode = new BlueNode();
    eventNode.setProperties({
      type: new BlueNode().setValue('Document Update'),
      op: new BlueNode().setValue(data.op),
      path: new BlueNode().setValue(relativePath),
      before: beforeNode,
      after: afterNode,
    });
    return eventNode;
  }

  private matchesDocumentUpdate(
    scopePath: string,
    watchPath: string | null | undefined,
    changedPath: string,
  ): boolean {
    if (!watchPath || watchPath.length === 0) {
      return false;
    }
    const watch = normalizePointer(resolvePointer(scopePath, watchPath));
    const changed = normalizePointer(changedPath);
    if (watch === '/') {
      return true;
    }
    if (changed === watch) {
      return true;
    }
    return changed.startsWith(`${watch}/`);
  }
}
