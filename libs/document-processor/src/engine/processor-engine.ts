import { Blue, BlueIdCalculator, BlueNode } from '@blue-labs/language';
import { blueIds } from '@blue-repository/core';

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
import type { ContractProcessorRegistry } from '../registry/contract-processor-registry.js';
import type { ChannelContract } from '../model/index.js';
import type { ChannelEvaluationContext } from '../registry/types.js';
import type { TerminationKind } from '../runtime/scope-runtime-context.js';
import { ProcessorErrors } from '../types/errors.js';
import { DocumentProcessingResult } from '../types/document-processing-result.js';
import { RunTerminationError } from './run-termination-error.js';
import { ProcessorFatalError } from './processor-fatal-error.js';
import { MustUnderstandFailure } from './must-understand-failure.js';
import { IllegalStateException } from './illegal-state-exception.js';

const PROCESSING_INITIALIZED_MARKER_BLUE_ID =
  blueIds['Processing Initialized Marker'];
const DOCUMENT_UPDATE_BLUE_ID = blueIds['Document Update'];

interface ExecutionHooks extends ExecutionAdapter, TerminationExecutionAdapter {
  bundleForScope(scopePath: string): ContractBundle | undefined;
  deliverLifecycle(
    scopePath: string,
    bundle: ContractBundle | null,
    event: BlueNode,
    finalizeAfter: boolean,
  ): Promise<void>;
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

  constructor(
    private readonly contractLoader: ContractLoader,
    private readonly registry: ContractProcessorRegistry,
    blue: Blue,
    document: BlueNode,
  ) {
    this.runtimeRef = new Runtime(document, blue);
    const signatureFn = (node: BlueNode | null): string | null =>
      canonicalSignature(this.runtimeRef.blue(), node);
    this.checkpointManager = new CheckpointManager(
      this.runtimeRef,
      signatureFn,
    );
    this.terminationService = new TerminationService(this.runtimeRef);
    this.channelRunner = new ChannelRunner(
      this.runtimeRef,
      this.checkpointManager,
      {
        evaluateChannel: async (channel, bundle, scopePath, event) =>
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
        shouldRunHandler: async (handler, context) => {
          const processor = this.registry.lookupHandler(handler.blueId());
          if (!processor) {
            const reason = `No processor registered for handler contract ${handler.blueId()}`;
            throw new ProcessorFatalError(
              reason,
              ProcessorErrors.illegalState(reason),
            );
          }
          const matchesFn = processor.matches;
          if (typeof matchesFn !== 'function') {
            return true;
          }
          return await matchesFn.call(processor, handler.contract(), context);
        },
        executeHandler: async (handler, context) =>
          this.executeHandler(handler, context),
        handleHandlerError: async (scope, bundle, error) =>
          this.handleHandlerError(scope, bundle, error),
        canonicalSignature: signatureFn,
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
        fatalReason: (error, label) => this.fatalReason(error, label),
        markCutOff: (scopePath) => this.markCutOff(scopePath),
      },
      blueId: (node) => this.runtimeRef.blue().calculateBlueIdSync(node),
      nodeAt: (scopePath) => this.nodeAt(scopePath),
      createDocumentUpdateEvent: (data, scopePath) =>
        this.createDocumentUpdateEvent(data, scopePath),
      matchesDocumentUpdate: (scopePath, watchPath, changedPath) =>
        this.matchesDocumentUpdate(scopePath, watchPath, changedPath),
    });
  }

  async initializeScope(
    scopePath: string,
    chargeScopeEntry: boolean,
  ): Promise<void> {
    await this.scopeExecutor.initializeScope(scopePath, chargeScopeEntry);
  }

  loadBundles(scopePath: string): void {
    this.scopeExecutor.loadBundles(scopePath);
  }

  async processExternalEvent(
    scopePath: string,
    event: BlueNode,
  ): Promise<void> {
    await this.scopeExecutor.processExternalEvent(scopePath, event);
  }

  async handlePatch(
    scopePath: string,
    bundle: ContractBundle,
    patch: JsonPatch,
    allowReservedMutation: boolean,
  ): Promise<void> {
    await this.scopeExecutor.handlePatch(
      scopePath,
      bundle,
      patch,
      allowReservedMutation,
    );
  }

  createContext(
    scopePath: string,
    bundle: ContractBundle,
    event: BlueNode,
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

  result(): DocumentProcessingResult {
    const document = (this.runtimeRef.document() as BlueNode).clone();
    const triggeredEvents = this.runtimeRef
      .rootEmissions()
      .map((event) => (event as BlueNode).clone());
    return DocumentProcessingResult.of(
      document,
      triggeredEvents as readonly BlueNode[],
      this.runtimeRef.totalGas(),
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

  async enterGracefulTermination(
    scopePath: string,
    bundle: ContractBundle | null,
    reason: string | null,
  ): Promise<void> {
    await this.terminate(scopePath, bundle, 'GRACEFUL', reason);
  }

  async enterFatalTermination(
    scopePath: string,
    bundle: ContractBundle | null,
    reason: string | null,
  ): Promise<void> {
    await this.terminate(scopePath, bundle, 'FATAL', reason);
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

  async markCutOff(scopePath: string): Promise<void> {
    const normalized = normalizeScope(scopePath);
    if (this.cutOffScopes.add(normalized)) {
      const context = this.runtimeRef.existingScope(normalized);
      context?.markCutOff();
    }
  }

  async deliverLifecycle(
    scopePath: string,
    bundle: ContractBundle | null,
    event: BlueNode,
    finalizeAfter: boolean,
  ): Promise<void> {
    await this.scopeExecutor.deliverLifecycle(
      scopePath,
      bundle,
      event,
      finalizeAfter,
    );
  }

  async recordLifecycleForBridging(
    scopePath: string,
    event: BlueNode,
  ): Promise<void> {
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

  private async terminate(
    scopePath: string,
    bundle: ContractBundle | null,
    kind: TerminationKind,
    reason: string | null,
  ): Promise<void> {
    const normalized = normalizeScope(scopePath);
    if (
      this.pendingTerminations.has(normalized) ||
      this.runtimeRef.isScopeTerminated(normalized)
    ) {
      return;
    }
    this.pendingTerminations.set(normalized, { kind, reason });
    await this.terminationService.terminateScope(
      this,
      scopePath,
      bundle,
      kind,
      reason,
    );
  }

  private nodeAt(scopePath: string): BlueNode | null {
    const normalized = normalizeScope(scopePath);
    return ProcessorEngine.nodeAt(this.runtimeRef.document(), normalized, {
      calculateBlueId: (node) =>
        this.runtimeRef.blue().calculateBlueIdSync(node),
    });
  }

  private async evaluateChannel(
    channel: ChannelBinding,
    bundle: ContractBundle,
    scopePath: string,
    event: BlueNode,
  ): Promise<ChannelMatch> {
    const processor = this.registry.lookupChannel(channel.blueId());
    if (!processor) {
      return { matches: false };
    }

    const eventBlueId = this.runtimeRef.blue().calculateBlueIdSync(event);

    const eventClone = event.clone();
    const evaluationContext: ChannelEvaluationContext = {
      scopePath,
      blue: this.runtimeRef.blue(),
      event: eventClone,
      markers: bundle.markers(),
      bindingKey: channel.key(),
    };

    const matchesResult = await processor.matches(
      channel.contract() as ChannelContract,
      evaluationContext,
    );
    if (!matchesResult) {
      return { matches: false };
    }

    // allow channel to provide a separate, channelized event for handlers
    const channelizedFn = processor.channelize;
    const channelizedResult = channelizedFn
      ? channelizedFn.call(processor, channel.contract(), evaluationContext)
      : undefined;

    return {
      matches: true,
      eventId: eventBlueId,
      eventNode: channelizedResult ?? eventClone.clone(),
    };
  }

  private async executeHandler(
    handler: HandlerBinding,
    context: ProcessorExecutionContext,
  ): Promise<void> {
    const processor = this.registry.lookupHandler(handler.blueId());
    if (!processor) {
      const reason = `No processor registered for handler contract ${handler.blueId()}`;
      throw new ProcessorFatalError(
        reason,
        ProcessorErrors.illegalState(reason),
      );
    }
    await processor.execute(handler.contract(), context);
  }

  /**
   * Converts unexpected handler failures into fatal terminations while allowing
   * sentinel errors (RunTerminationError/MustUnderstandFailure) to propagate so
   * the outer run logic can react according to spec (§22).
   */
  private async handleHandlerError(
    scopePath: string,
    bundle: ContractBundle,
    error: unknown,
  ): Promise<void> {
    if (error instanceof RunTerminationError) {
      throw error;
    }
    if (error instanceof MustUnderstandFailure) {
      throw error;
    }
    const reason = this.fatalReason(error, 'Runtime fatal');
    await this.enterFatalTermination(scopePath, bundle, reason);
  }

  private fatalReason(error: unknown, label: string): string {
    if (error instanceof Error && typeof error.message === 'string') {
      return error.message;
    }
    return label;
  }

  private createDocumentUpdateEvent(
    data: DocumentUpdateData,
    scopePath: string,
  ): BlueNode {
    const relativePath = relativizePointer(scopePath, data.path);

    const beforeNode =
      data.before != null ? data.before.clone() : new BlueNode().setValue(null);
    const afterNode =
      data.after != null ? data.after.clone() : new BlueNode().setValue(null);

    const eventNode = new BlueNode().setType(
      new BlueNode().setBlueId(DOCUMENT_UPDATE_BLUE_ID),
    );
    eventNode.setProperties({
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

export class ProcessorEngine {
  constructor(
    private readonly contractLoader: ContractLoader,
    private readonly registry: ContractProcessorRegistry,
    private readonly blue: Blue,
  ) {}

  async initializeDocument(
    document: BlueNode,
  ): Promise<DocumentProcessingResult> {
    if (this.isInitialized(document)) {
      throw new IllegalStateException('Document already initialized');
    }
    const execution = this.createExecution(document.clone());
    return this.run(document, execution, async () => {
      await execution.initializeScope('/', true);
    });
  }

  async processDocument(
    document: BlueNode,
    event: BlueNode,
  ): Promise<DocumentProcessingResult> {
    if (!this.isInitialized(document)) {
      throw new IllegalStateException('Document not initialized');
    }
    const execution = this.createExecution(document.clone());
    const eventClone = event.clone();
    return this.run(document, execution, async () => {
      execution.loadBundles('/');
      await execution.processExternalEvent('/', eventClone);
    });
  }

  isInitialized(document: BlueNode): boolean {
    return this.initializationMarker(document) != null;
  }

  createExecution(document: BlueNode): ProcessorExecution {
    return new ProcessorExecution(
      this.contractLoader,
      this.registry,
      this.blue,
      document,
    );
  }

  private async run(
    originalDocument: BlueNode,
    execution: ProcessorExecution,
    action: () => Promise<void>,
  ): Promise<DocumentProcessingResult> {
    try {
      await action();
    } catch (error) {
      if (error instanceof RunTerminationError) {
        return execution.result();
      }
      if (error instanceof MustUnderstandFailure) {
        const failureDocument = originalDocument.clone() as BlueNode;
        return DocumentProcessingResult.capabilityFailure(
          failureDocument,
          error.message ?? null,
        );
      }
      throw error;
    }
    return execution.result();
  }

  private initializationMarker(document: BlueNode): BlueNode | null {
    const contracts = document.getProperties()?.contracts;
    const marker = contracts?.getProperties()?.initialized ?? null;
    if (!marker) {
      return null;
    }
    if (!(marker instanceof BlueNode)) {
      throw new ProcessorFatalError(
        'Initialization Marker must be a BlueNode',
        ProcessorErrors.illegalState(
          'Initialization Marker must be a BlueNode',
        ),
      );
    }
    const typeBlueId = marker.getType()?.getBlueId();
    if (typeBlueId !== PROCESSING_INITIALIZED_MARKER_BLUE_ID) {
      throw new ProcessorFatalError(
        "Initialization Marker must declare type 'Processing Initialized Marker'",
        ProcessorErrors.illegalState(
          "Initialization Marker must declare type 'Processing Initialized Marker'",
        ),
      );
    }
    return marker;
  }

  static nodeAt(
    root: BlueNode,
    pointer: string,
    options?: { calculateBlueId?: (node: BlueNode) => string },
  ): BlueNode | null {
    if (!(root instanceof BlueNode)) {
      return null;
    }
    const normalized = normalizePointer(pointer);
    if (normalized === '/') {
      return root;
    }
    const segments = normalized.slice(1).split('/');
    let current: BlueNode | null = root;

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
        | Record<string, BlueNode>
        | undefined;
      if (properties && segment in properties) {
        const nextNode = properties[segment];
        if (!(nextNode instanceof BlueNode)) {
          return null;
        }
        current = nextNode;
        continue;
      }

      const specialNode = this.specialSegmentNode(current, segment, options);
      if (specialNode !== undefined) {
        current = specialNode;
        continue;
      }

      if (!properties) {
        return null;
      }
      return null;
    }

    return current;
  }

  private static specialSegmentNode(
    node: BlueNode,
    segment: string,
    options?: { calculateBlueId?: (node: BlueNode) => string },
  ): BlueNode | null | undefined {
    switch (segment) {
      case 'name':
        return new BlueNode().setValue(node.getName() ?? null);
      case 'description':
        return new BlueNode().setValue(node.getDescription() ?? null);
      case 'type':
        return node.getType() ?? null;
      case 'itemType':
        return node.getItemType() ?? null;
      case 'keyType':
        return node.getKeyType() ?? null;
      case 'valueType':
        return node.getValueType() ?? null;
      case 'value':
        return new BlueNode().setValue(node.getValue() ?? null);
      case 'blue':
        return node.getBlue() ?? null;
      case 'contracts':
        return new BlueNode().setContracts(node.getContracts());
      case 'blueId': {
        const calculatedBlueId =
          node.getBlueId() ??
          options?.calculateBlueId?.(node) ??
          BlueIdCalculator.calculateBlueIdSync(node);
        return new BlueNode().setValue(calculatedBlueId ?? null);
      }
      default:
        return undefined;
    }
  }
}
