import { Blue, BlueNode, Properties } from '@blue-labs/language';

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
import type { ProcessorError } from '../types/errors.js';
import {
  DocumentProcessingResult,
  ProcessorErrorCategory,
  ProcessorStatus,
  type ProcessorErrorCategory as ProcessorErrorCategoryValue,
} from '../types/document-processing-result.js';
import { blueIds } from '../repository/semantic-repository.js';
import { RunTerminationError } from './run-termination-error.js';
import { ProcessorFatalError } from './processor-fatal-error.js';
import { MustUnderstandFailure } from './must-understand-failure.js';
import { IllegalStateException } from './illegal-state-exception.js';
import { RELATIVE_CONTRACTS } from '../constants/processor-pointer-constants.js';
import { calculateRuntimeContentBlueId } from '../util/content-blue-id.js';
import type { TypeGraphProvider } from './generalization/type-graph-provider.js';
import { CheckpointIdentityService } from './checkpoint-identity-service.js';
import { ProcessorTimer } from './processor-timing.js';

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

export interface ProcessorRuntimeHooks {
  forcedFatal?(): { scope: string | null; reason: string | null } | null;
  planPatch?(
    scopePath: string,
    runtime: DocumentProcessingRuntime,
    patch: JsonPatch,
  ):
    | { generatedPatches?: readonly JsonPatch[] }
    | Promise<{ generatedPatches?: readonly JsonPatch[] }>;
  typeGraphProvider?(): TypeGraphProvider | null;
  afterEmbeddedChildProcessed?(
    childScope: string,
    runtime: DocumentProcessingRuntime,
  ): Promise<void> | void;
  afterBridgeEmission?(
    scopePath: string,
    runtime: DocumentProcessingRuntime,
    emission: BlueNode,
  ): Promise<void> | void;
  recordEmbeddedBridgeDelivery?(
    emission: BlueNode,
    channelKeys: readonly string[],
  ): void;
}

export class ProcessorExecution implements ExecutionHooks {
  private readonly runtimeRef: Runtime;
  private readonly bundles = new Map<string, ContractBundle>();
  private readonly pendingTerminations = new Map<
    string,
    { kind: TerminationKind; reason: string | null }
  >();
  private readonly terminationCategories = new Map<
    string,
    ProcessorErrorCategoryValue
  >();
  private readonly cutOffScopes = new Set<string>();
  private readonly checkpointManager: CheckpointManager;
  private readonly checkpointIdentityService: CheckpointIdentityService;
  private readonly terminationService: TerminationService;
  private readonly channelRunner: ChannelRunner;
  private readonly scopeExecutor: ScopeExecutor;

  constructor(
    private readonly contractLoader: ContractLoader,
    private readonly registry: ContractProcessorRegistry,
    blue: Blue,
    document: BlueNode,
    private readonly runtimeHooks?: ProcessorRuntimeHooks,
    private readonly timing = ProcessorTimer.disabled,
  ) {
    this.runtimeRef = new Runtime(document, blue, this.timing);
    this.checkpointIdentityService = new CheckpointIdentityService(
      this.runtimeRef.blue(),
    );
    this.checkpointManager = new CheckpointManager(
      this.runtimeRef,
      this.checkpointIdentityService,
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
          const processor = this.lookupHandlerProcessor(handler);
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
          return await matchesFn.call(processor, handler.contract(), context, {
            contractKey: handler.key(),
            contractNode: handler.node(),
          });
        },
        executeHandler: async (handler, context) =>
          this.executeHandler(handler, context),
        handleHandlerError: async (scope, bundle, error) =>
          this.handleHandlerError(scope, bundle, error),
        checkpointIdentity: (node, mode, subject) =>
          this.checkpointIdentityService.identityFor(node, mode, subject),
        channelProcessorFor: (node) => this.lookupChannelProcessor(node),
      },
      this.timing,
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
        enterFatalTermination: (scope, bundle, reason, errorCategory) =>
          this.enterFatalTermination(
            scope,
            bundle,
            reason ?? null,
            errorCategory,
          ),
        fatalReason: (error, label) => this.fatalReason(error, label),
        markCutOff: (scopePath) => this.markCutOff(scopePath),
        planPatch: runtimeHooks?.planPatch?.bind(runtimeHooks),
        typeGraphProvider: runtimeHooks?.typeGraphProvider?.bind(runtimeHooks),
        afterEmbeddedChildProcessed:
          runtimeHooks?.afterEmbeddedChildProcessed?.bind(runtimeHooks),
        afterBridgeEmission:
          runtimeHooks?.afterBridgeEmission?.bind(runtimeHooks),
        recordEmbeddedBridgeDelivery:
          runtimeHooks?.recordEmbeddedBridgeDelivery?.bind(runtimeHooks),
      },
      blueId: (node) => this.runtimeContentBlueId(node),
      nodeAt: (scopePath) => this.nodeAt(scopePath),
      createDocumentUpdateEvent: (data, scopePath) =>
        this.createDocumentUpdateEvent(data, scopePath),
      matchesDocumentUpdate: (scopePath, watchPath, changedPath) =>
        this.matchesDocumentUpdate(scopePath, watchPath, changedPath),
      timing: this.timing,
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
      this.processingStatus(),
      this.rootErrorCategory(),
      this.rootFailureReason(),
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
    errorCategory: ProcessorErrorCategoryValue = ProcessorErrorCategory.InternalProcessorError,
  ): Promise<void> {
    const normalized = normalizeScope(scopePath);
    this.terminationCategories.set(normalized, errorCategory);
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

  async applyForcedFatalIfPresent(): Promise<boolean> {
    const forced = this.runtimeHooks?.forcedFatal?.();
    if (!forced) {
      return false;
    }
    const scope = forced.scope ?? '/';
    this.ensureContractsContainerForForcedFatal(scope);
    await this.enterFatalTermination(
      scope,
      this.bundleForScope(normalizeScope(scope)) ?? null,
      forced.reason ?? null,
      ProcessorErrorCategory.TerminationError,
    );
    return true;
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

  private ensureContractsContainerForForcedFatal(scopePath: string): void {
    if (normalizeScope(scopePath) !== '/') {
      return;
    }
    const contracts = this.nodeAt(RELATIVE_CONTRACTS);
    if (contracts?.getProperties()) {
      return;
    }
    const document = this.runtimeRef.document();
    document.setProperties({
      ...(document.getProperties() ?? {}),
      [Properties.OBJECT_CONTRACTS]: new BlueNode().setProperties({}),
    });
  }

  private nodeAt(scopePath: string): BlueNode | null {
    const normalized = normalizeScope(scopePath);
    return ProcessorEngine.nodeAt(this.runtimeRef.document(), normalized, {
      calculateBlueId: (node) => this.runtimeContentBlueId(node),
    });
  }

  private async evaluateChannel(
    channel: ChannelBinding,
    bundle: ContractBundle,
    scopePath: string,
    event: BlueNode,
  ): Promise<ChannelMatch> {
    const processor = this.lookupChannelProcessor(channel.node());
    if (!processor) {
      return { matches: false };
    }

    const eventClone = event.clone();
    const contract = channel.contract() as ChannelContract;
    const eventFilter = contract.event;
    if (
      eventFilter &&
      !this.runtimeRef.blue().isTypeOfNode(eventClone, eventFilter)
    ) {
      return { matches: false };
    }
    const evaluationContext: ChannelEvaluationContext = {
      scopePath,
      blue: this.runtimeRef.blue(),
      event: eventClone,
      markers: bundle.markers(),
      bindingKey: channel.key(),
      resolveChannel: (key) => bundle.channelEntry(key),
      channelProcessorFor: (node) => this.lookupChannelProcessor(node),
    };

    const evaluateFn = processor.evaluate;
    if (typeof evaluateFn === 'function') {
      return await evaluateFn.call(processor, contract, evaluationContext);
    }

    const matchesResult = await processor.matches(contract, evaluationContext);
    if (!matchesResult) {
      return { matches: false };
    }

    // allow channel to provide a separate, channelized event for handlers
    const channelizedFn = processor.channelize;
    const channelizedResult = channelizedFn
      ? channelizedFn.call(processor, contract, evaluationContext)
      : undefined;

    return {
      matches: true,
      eventNode: channelizedResult ?? eventClone.clone(),
    };
  }

  private runtimeContentBlueId(node: BlueNode): string {
    return calculateRuntimeContentBlueId(this.runtimeRef.blue(), node);
  }

  private async executeHandler(
    handler: HandlerBinding,
    context: ProcessorExecutionContext,
  ): Promise<void> {
    const processor = this.lookupHandlerProcessor(handler);
    if (!processor) {
      const reason = `No processor registered for handler contract ${handler.blueId()}`;
      throw new ProcessorFatalError(
        reason,
        ProcessorErrors.illegalState(reason),
      );
    }
    await processor.execute(handler.contract(), context, {
      contractKey: handler.key(),
      contractNode: handler.node(),
    });
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
    await this.enterFatalTermination(
      scopePath,
      bundle,
      reason,
      this.fatalCategory(error, ProcessorErrorCategory.HandlerExecutionError),
    );
  }

  private fatalReason(error: unknown, label: string): string {
    if (error instanceof Error && typeof error.message === 'string') {
      return error.message;
    }
    return label;
  }

  private fatalCategory(
    error: unknown,
    fallback: ProcessorErrorCategoryValue,
  ): ProcessorErrorCategoryValue {
    if (error instanceof ProcessorFatalError && error.category) {
      return error.category;
    }
    if (error instanceof ProcessorFatalError && error.processorError) {
      return categoryForProcessorError(error.processorError, fallback);
    }
    return fallback;
  }

  private processingStatus(): ProcessorStatus {
    for (const termination of this.pendingTerminations.values()) {
      if (termination.kind === 'FATAL') {
        return ProcessorStatus.RUNTIME_FATAL;
      }
    }
    if (this.terminationCategories.size > 0) {
      return ProcessorStatus.RUNTIME_FATAL;
    }
    for (const context of this.runtimeRef.scopes().values()) {
      if (context.terminationKind() === 'FATAL') {
        return ProcessorStatus.RUNTIME_FATAL;
      }
    }
    return ProcessorStatus.SUCCESS;
  }

  private rootErrorCategory(): ProcessorErrorCategoryValue | null {
    if (this.processingStatus() !== ProcessorStatus.RUNTIME_FATAL) {
      return null;
    }
    return (
      this.terminationCategories.get('/') ??
      this.terminationCategories.values().next().value ??
      ProcessorErrorCategory.InternalProcessorError
    );
  }

  private rootFailureReason(): string | null {
    const rootPending = this.pendingTerminations.get('/');
    if (rootPending?.reason) {
      return rootPending.reason;
    }
    for (const pending of this.pendingTerminations.values()) {
      if (pending.reason) {
        return pending.reason;
      }
    }
    const rootContext = this.runtimeRef.existingScope('/');
    if (rootContext?.terminationReason()) {
      return rootContext.terminationReason();
    }
    for (const context of this.runtimeRef.scopes().values()) {
      if (context.terminationReason()) {
        return context.terminationReason();
      }
    }
    return null;
  }

  private lookupHandlerProcessor(handler: HandlerBinding) {
    return this.registry.lookupHandlerForNode(
      this.runtimeRef.blue(),
      handler.node(),
    );
  }

  private lookupChannelProcessor(node: BlueNode) {
    return (
      this.registry.lookupChannelForNode(this.runtimeRef.blue(), node) ?? null
    );
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
    private readonly runtimeHooks?: ProcessorRuntimeHooks,
    private readonly timing = ProcessorTimer.disabled,
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
    return this.timing.measureAsync('processDocument.total', async () => {
      const invalidDocument = this.validateProcessingDocument(document);
      if (invalidDocument) {
        return invalidDocument;
      }
      const execution = this.createExecution(document.clone());
      const eventClone = event.clone();
      return this.run(document, execution, async () => {
        if (await execution.applyForcedFatalIfPresent()) {
          return;
        }
        execution.loadBundles('/');
        await execution.processExternalEvent('/', eventClone);
      });
    });
  }

  private validateProcessingDocument(
    document: BlueNode,
  ): DocumentProcessingResult | null {
    if (document.getBlue() != null) {
      return DocumentProcessingResult.invalidProcessingDocument(
        document.clone(),
        'Invalid Processing Document: root blue directive is not allowed',
      );
    }
    if (
      document.getValue() != null ||
      document.getItems() != null ||
      document.getReferenceBlueId() != null
    ) {
      return DocumentProcessingResult.invalidProcessingDocument(
        document.clone(),
        'Invalid Processing Document: root scope must be an object',
      );
    }
    return null;
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
      this.runtimeHooks,
      this.timing,
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
      if (error instanceof ProcessorFatalError) {
        return DocumentProcessingResult.runtimeFatal(
          originalDocument.clone(),
          error.message ?? null,
          categoryForFatalError(
            error,
            ProcessorErrorCategory.InternalProcessorError,
          ),
        );
      }
      throw error;
    }
    return execution.result();
  }

  private initializationMarker(document: BlueNode): BlueNode | null {
    const contracts = document.getProperties()?.[Properties.OBJECT_CONTRACTS];
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
    const segments = normalized
      .slice(1)
      .split('/')
      .map((segment) => unescapePointerSegment(segment, normalized));
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
        return node.getRawValue() === undefined
          ? null
          : new BlueNode().setValue(node.getValue() ?? null);
      case 'blue':
        return node.getBlue() ?? null;
      case Properties.OBJECT_CONTRACTS:
        return new BlueNode().setContracts(node.getContracts());
      case 'blueId': {
        const calculatedBlueId = options?.calculateBlueId?.(node);
        if (calculatedBlueId === undefined) {
          throw new ProcessorFatalError(
            'ProcessorEngine.nodeAt requires a semantic calculateBlueId option for /blueId.',
            ProcessorErrors.illegalState(
              'ProcessorEngine.nodeAt requires a semantic calculateBlueId option for /blueId.',
            ),
          );
        }
        return new BlueNode().setValue(calculatedBlueId ?? null);
      }
      default:
        return undefined;
    }
  }
}

function categoryForFatalError(
  error: ProcessorFatalError,
  fallback: ProcessorErrorCategoryValue,
): ProcessorErrorCategoryValue {
  if (error.category) {
    return error.category;
  }
  if (error.processorError) {
    return categoryForProcessorError(error.processorError, fallback);
  }
  return fallback;
}

function unescapePointerSegment(segment: string, pointer: string): string {
  for (let i = 0; i < segment.length; i += 1) {
    if (segment[i] !== '~') {
      continue;
    }
    const next = segment[i + 1];
    if (next !== '0' && next !== '1') {
      throw new ProcessorFatalError(
        `Invalid JSON pointer escape in path: ${pointer}`,
        ProcessorErrors.illegalState(
          `Invalid JSON pointer escape in path: ${pointer}`,
        ),
      );
    }
    i += 1;
  }
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function categoryForProcessorError(
  error: ProcessorError,
  fallback: ProcessorErrorCategoryValue,
): ProcessorErrorCategoryValue {
  switch (error.kind) {
    case 'CapabilityFailure':
      return ProcessorErrorCategory.UnsupportedContract;
    case 'BoundaryViolation':
      return ProcessorErrorCategory.BoundaryViolation;
    case 'InvalidContract':
      return ProcessorErrorCategory.InvalidPatchValue;
    case 'IllegalState':
      return ProcessorErrorCategory.InternalProcessorError;
    case 'RuntimeFatal':
    case 'UnsupportedOp':
      return fallback;
    default:
      return fallback;
  }
}
