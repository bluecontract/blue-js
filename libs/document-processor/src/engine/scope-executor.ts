import { BlueNode, ResolvedBlueNode } from '@blue-labs/language';

import { ContractBundle, type ChannelBinding } from './contract-bundle.js';
import type { ChannelRunner } from './channel-runner.js';
import type { ContractLoader } from './contract-loader.js';
import type {
  DocumentUpdateChannel,
  EmbeddedNodeChannel,
} from '../model/index.js';
import type { JsonPatch } from '../model/shared/json-patch.js';
import type { DocumentUpdateData } from '../runtime/document-processing-runtime.js';
import { DocumentProcessingRuntime } from '../runtime/document-processing-runtime.js';
import type { TerminationKind } from '../runtime/scope-runtime-context.js';
import {
  KEY_EMBEDDED,
  PROCESSOR_MANAGED_CHANNEL_BLUE_IDS,
  RESERVED_CONTRACT_KEYS,
} from '../constants/processor-contract-constants.js';
import {
  RELATIVE_CONTRACTS,
  RELATIVE_INITIALIZED,
  RELATIVE_TERMINATED,
  relativeContractsEntry,
} from '../constants/processor-pointer-constants.js';
import {
  normalizeScope,
  normalizePointer,
  resolvePointer,
} from '../util/pointer-utils.js';
import { ingestExternalEvent } from './external-event.js';
import { ProcessorFatalError } from './processor-fatal-error.js';
import { ProcessorErrors } from '../types/errors.js';
import { MustUnderstandFailure } from './must-understand-failure.js';
import { IllegalStateException } from './illegal-state-exception.js';
import { BoundaryViolationException } from './boundary-violation-exception.js';
import { blueIds } from '../repository/semantic-repository.js';
import {
  ProcessorErrorCategory,
  type ProcessorErrorCategory as ProcessorErrorCategoryValue,
} from '../types/document-processing-result.js';
import { safeIsTypeOfBlueId } from '../util/schema-match.js';
import type { TypeGraphProvider } from './generalization/type-graph-provider.js';
import { ProcessorTimer } from './processor-timing.js';

const DOCUMENT_UPDATE_CHANNEL_BLUE_ID = blueIds['Document Update Channel'];
const EMBEDDED_NODE_CHANNEL_BLUE_ID = blueIds['Embedded Node Channel'];
const TRIGGERED_EVENT_CHANNEL_BLUE_ID = blueIds['Triggered Event Channel'];
const LIFECYCLE_EVENT_CHANNEL_BLUE_ID = blueIds['Lifecycle Event Channel'];
const PROCESSING_INITIALIZED_MARKER_BLUE_ID =
  blueIds['Processing Initialized Marker'];
const PROCESSING_TERMINATED_MARKER_BLUE_ID =
  blueIds['Processing Terminated Marker'];
const DOCUMENT_PROCESSING_INITIATED_BLUE_ID =
  blueIds['Document Processing Initiated'];

export interface ProcessorContext {
  resolvePointer(relativePointer: string): string;
  applyPatch(patch: JsonPatch): Promise<void>;
}

export interface ScopeExecutionHooks {
  isScopeInactive(scopePath: string): boolean;
  createContext(
    scopePath: string,
    bundle: ContractBundle,
    event: BlueNode,
    allowTerminatedWork: boolean,
    lifecycle?: boolean,
  ): ProcessorContext;
  recordLifecycleForBridging(scopePath: string, event: BlueNode): Promise<void>;
  enterFatalTermination(
    scopePath: string,
    bundle: ContractBundle | null,
    reason: string,
    errorCategory?: ProcessorErrorCategoryValue,
  ): Promise<void>;
  fatalReason(error: unknown, label: string): string;
  markCutOff(scopePath: string): Promise<void>;
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

export interface ScopeExecutorOptions {
  runtime: DocumentProcessingRuntime;
  contractLoader: ContractLoader;
  channelRunner: ChannelRunner;
  bundles: Map<string, ContractBundle>;
  hooks: ScopeExecutionHooks;
  blueId: (node: BlueNode) => string;
  nodeAt(scopePath: string): BlueNode | null;
  createDocumentUpdateEvent(
    data: DocumentUpdateData,
    scopePath: string,
  ): BlueNode;
  matchesDocumentUpdate(
    scopePath: string,
    watchPath: string | null | undefined,
    changedPath: string,
  ): boolean;
  timing?: ProcessorTimer;
}

export class ScopeExecutor {
  private readonly runtime: DocumentProcessingRuntime;
  private readonly contractLoader: ContractLoader;
  private readonly channelRunner: ChannelRunner;
  private readonly bundles: Map<string, ContractBundle>;
  private readonly hooks: ScopeExecutionHooks;
  private readonly blueId: (node: BlueNode) => string;
  private readonly nodeAt: (scopePath: string) => BlueNode | null;
  private readonly createDocumentUpdateEvent: (
    data: DocumentUpdateData,
    scopePath: string,
  ) => BlueNode;
  private readonly matchesDocumentUpdate: (
    scopePath: string,
    watchPath: string | null | undefined,
    changedPath: string,
  ) => boolean;
  private readonly timing: ProcessorTimer;

  constructor(options: ScopeExecutorOptions) {
    this.runtime = options.runtime;
    this.contractLoader = options.contractLoader;
    this.channelRunner = options.channelRunner;
    this.bundles = options.bundles;
    this.hooks = options.hooks;
    this.blueId = options.blueId;
    this.nodeAt = options.nodeAt;
    this.createDocumentUpdateEvent = options.createDocumentUpdateEvent;
    this.matchesDocumentUpdate = options.matchesDocumentUpdate;
    this.timing = options.timing ?? ProcessorTimer.disabled;
  }

  async initializeScope(
    scopePath: string,
    chargeScopeEntry: boolean,
    finalizeAfterInitialization = true,
  ): Promise<void> {
    const normalizedScope = normalizeScope(scopePath);
    const processedEmbedded = new Set<string>();
    let bundle: ContractBundle | null = null;
    let preInitSnapshot: BlueNode | null = null;
    const scopeContext = this.runtime.scope(normalizedScope);
    if (normalizedScope === '/') {
      this.runtime.setScopeEmbeddedDepth(normalizedScope, 0);
    }
    scopeContext.clearProcessedEmbeddedPaths();

    if (chargeScopeEntry) {
      this.runtime.chargeScopeEntry(normalizedScope);
    }

    try {
      const terminatedKind = this.terminationMarkerKind(normalizedScope);
      if (terminatedKind) {
        this.runtime
          .scope(normalizedScope)
          .finalizeTermination(terminatedKind, null);
        return;
      }
    } catch (error) {
      await this.hooks.enterFatalTermination(
        normalizedScope,
        null,
        this.hooks.fatalReason(error, 'Invalid terminated marker'),
        ProcessorErrorCategory.InvalidReservedMarker,
      );
      return;
    }

    while (true) {
      const scopeNode = this.nodeAt(normalizedScope);
      if (!scopeNode) {
        return;
      }

      if (!preInitSnapshot) {
        preInitSnapshot = scopeNode.clone();
      }

      bundle = this.loadBundle(scopeNode, normalizedScope);
      this.bundles.set(normalizedScope, bundle);

      let nextEmbedded: string | null;
      try {
        nextEmbedded = this.nextEmbeddedPath(
          normalizedScope,
          bundle,
          processedEmbedded,
        );
      } catch (error) {
        if (error instanceof BoundaryViolationException) {
          await this.hooks.enterFatalTermination(
            normalizedScope,
            bundle,
            this.hooks.fatalReason(error, 'Invalid embedded path'),
            error.category ?? ProcessorErrorCategory.BoundaryViolation,
          );
          return;
        }
        throw error;
      }
      if (!nextEmbedded) {
        break;
      }
      const childScope = resolvePointer(normalizedScope, nextEmbedded);
      processedEmbedded.add(childScope);
      scopeContext.recordProcessedEmbeddedPath(childScope);
      this.runtime.setScopeEmbeddedDepth(
        childScope,
        this.runtime.scopeEmbeddedDepth(normalizedScope) + 1,
      );
      const childNode = this.nodeAt(childScope);
      if (childNode) {
        if (!this.isObjectScope(childNode)) {
          if (!finalizeAfterInitialization) {
            continue;
          }
          await this.hooks.enterFatalTermination(
            normalizedScope,
            bundle,
            `Embedded path ${childScope} does not select an object scope`,
            ProcessorErrorCategory.BoundaryViolation,
          );
          return;
        }
        await this.initializeScope(
          childScope,
          true,
          finalizeAfterInitialization,
        );
      }
    }

    if (!bundle) {
      return;
    }

    const initializedMarker = this.hasInitializationMarker(normalizedScope);
    if (
      !initializedMarker &&
      finalizeAfterInitialization &&
      bundle.hasCheckpoint()
    ) {
      throw new IllegalStateException(
        `Reserved key 'checkpoint' must not appear before initialization at scope ${normalizedScope}`,
      );
    }

    if (initializedMarker) {
      return;
    }

    this.runtime.gasMeter().chargeInitialization();
    const documentId = this.blueId(preInitSnapshot ?? new BlueNode());
    const lifecycleEvent = this.createLifecycleEvent(documentId);
    const context = this.hooks.createContext(
      normalizedScope,
      bundle,
      lifecycleEvent,
      false,
      true,
    );
    await this.deliverLifecycle(normalizedScope, bundle, lifecycleEvent, false);
    await this.addInitializationMarker(context, documentId);
    if (
      finalizeAfterInitialization &&
      !this.hooks.isScopeInactive(normalizedScope)
    ) {
      const refreshed = this.refreshBundle(normalizedScope);
      if (refreshed) {
        await this.finalizeScope(normalizedScope);
      }
    }
  }

  loadBundles(scopePath: string): void {
    const normalizedScope = normalizeScope(scopePath);
    if (this.bundles.has(normalizedScope)) {
      return;
    }
    try {
      if (this.terminationMarkerKind(normalizedScope)) {
        this.bundles.set(normalizedScope, ContractBundle.empty());
        return;
      }
    } catch (error) {
      if (error instanceof IllegalStateException) {
        throw new MustUnderstandFailure((error as Error).message);
      }
      throw error;
    }
    const scopeNode = this.nodeAt(normalizedScope);
    const bundle = scopeNode
      ? this.loadBundle(scopeNode, normalizedScope)
      : ContractBundle.empty();
    this.bundles.set(normalizedScope, bundle);
    for (const embeddedPointer of bundle.embeddedPaths()) {
      try {
        const childScope = resolvePointer(normalizedScope, embeddedPointer);
        this.loadBundles(childScope);
      } catch (error) {
        if (error instanceof ProcessorFatalError) {
          continue;
        }
        throw error;
      }
    }
  }

  async processExternalEvent(
    scopePath: string,
    event: BlueNode,
  ): Promise<void> {
    const ingested = ingestExternalEvent(this.runtime.blue(), event);
    await this.processPreparedExternalEvent(scopePath, ingested);
  }

  private async processPreparedExternalEvent(
    scopePath: string,
    event: ResolvedBlueNode,
  ): Promise<void> {
    const normalizedScope = normalizeScope(scopePath);
    if (this.hooks.isScopeInactive(normalizedScope)) {
      return;
    }
    if (normalizedScope === '/') {
      this.runtime.setScopeEmbeddedDepth(normalizedScope, 0);
    }
    this.runtime.chargeScopeEntry(normalizedScope);
    try {
      const terminatedKind = this.terminationMarkerKind(normalizedScope);
      if (terminatedKind) {
        this.runtime
          .scope(normalizedScope)
          .finalizeTermination(terminatedKind, null);
        return;
      }
    } catch (error) {
      const bundle = this.bundles.get(normalizedScope) ?? null;
      await this.hooks.enterFatalTermination(
        normalizedScope,
        bundle,
        this.hooks.fatalReason(error, 'Invalid terminated marker'),
        ProcessorErrorCategory.InvalidReservedMarker,
      );
      return;
    }
    const bundle = await this.timing.measureAsync(
      'scope.phase1.processEmbedded',
      () => this.processEmbeddedChildren(normalizedScope, event),
      { scopePath: normalizedScope },
    );
    if (!bundle) {
      return;
    }
    let activeBundle = bundle;
    if (!this.hasInitializationMarker(normalizedScope)) {
      await this.timing.measureAsync(
        'scope.phase2.initialize',
        () => this.initializeScope(normalizedScope, false, false),
        { scopePath: normalizedScope },
      );
      if (this.hooks.isScopeInactive(normalizedScope)) {
        return;
      }
      const refreshed = this.refreshBundle(normalizedScope);
      if (!refreshed) {
        return;
      }
      activeBundle = refreshed;
    }

    const channels = activeBundle.channelsOfType();
    if (channels.length === 0) {
      this.finalizeScope(normalizedScope);
      return;
    }

    await this.timing.measureAsync(
      'scope.phase3.externalChannels',
      async () => {
        let externalCandidateCount = 0;
        let matchedExternalCandidate = false;
        for (const channel of channels) {
          if (this.hooks.isScopeInactive(normalizedScope)) {
            break;
          }
          if (this.isProcessorManagedChannel(channel)) {
            continue;
          }
          externalCandidateCount += 1;
          const matched = await this.channelRunner.runExternalChannel(
            normalizedScope,
            activeBundle,
            channel,
            event,
          );
          matchedExternalCandidate ||= matched;
        }
        if (externalCandidateCount > 1 && !matchedExternalCandidate) {
          this.runtime.addGas(1);
        }
      },
      { scopePath: normalizedScope },
    );
    await this.finalizeScope(normalizedScope);
  }

  async handlePatch(
    scopePath: string,
    bundle: ContractBundle,
    patch: JsonPatch,
    allowReservedMutation: boolean,
  ): Promise<void> {
    return this.timing.measureAsync(
      'patch.total',
      () =>
        this.handlePatchUnmeasured(
          scopePath,
          bundle,
          patch,
          allowReservedMutation,
        ),
      { scopePath, op: patch.op, path: patch.path },
    );
  }

  private async handlePatchUnmeasured(
    scopePath: string,
    bundle: ContractBundle,
    patch: JsonPatch,
    allowReservedMutation: boolean,
  ): Promise<void> {
    if (this.hooks.isScopeInactive(scopePath)) {
      return;
    }
    if (!allowReservedMutation) {
      this.runtime.gasMeter().chargeBoundaryCheck();
    }
    try {
      this.validatePatchBoundary(scopePath, bundle, patch);
      this.enforceReservedKeyWriteProtection(
        scopePath,
        patch,
        allowReservedMutation,
      );
    } catch (error) {
      if (error instanceof BoundaryViolationException) {
        const reason = this.hooks.fatalReason(error, 'Boundary violation');
        await this.hooks.enterFatalTermination(
          scopePath,
          bundle,
          reason,
          error.category ?? ProcessorErrorCategory.BoundaryViolation,
        );
        return;
      }
      throw error;
    }

    try {
      switch (patch.op) {
        case 'ADD':
        case 'REPLACE':
          this.runtime.gasMeter().chargePatchAddOrReplace(patch.val ?? null);
          break;
        case 'REMOVE':
          this.runtime.gasMeter().chargePatchRemove();
          break;
        default:
          break;
      }

      const productionGeneratedPatches = !allowReservedMutation
        ? this.runtime.planPatch(
            scopePath,
            patch,
            this.hooks.typeGraphProvider?.() ?? null,
          )
        : [];
      const hookPlan = !allowReservedMutation
        ? await this.hooks.planPatch?.(scopePath, this.runtime, patch)
        : undefined;
      const generatedPatches = [
        ...productionGeneratedPatches,
        ...(hookPlan?.generatedPatches ?? []),
      ];
      const updates = this.runtime.applyPatchTransaction(
        scopePath,
        patch,
        generatedPatches,
      );
      for (const update of updates) {
        await this.timing.measureAsync(
          'patch.documentUpdateCascade',
          () => this.routeDocumentUpdateAfterPatch(scopePath, bundle, update),
          { scopePath, op: update.op, path: update.path },
        );
        if (this.hooks.isScopeInactive(scopePath)) {
          break;
        }
      }
    } catch (error) {
      if (error instanceof BoundaryViolationException) {
        const reason = this.hooks.fatalReason(error, 'Boundary violation');
        await this.hooks.enterFatalTermination(
          scopePath,
          bundle,
          reason,
          error.category ?? ProcessorErrorCategory.BoundaryViolation,
        );
        return;
      }
      if (error instanceof MustUnderstandFailure) {
        const reason = this.hooks.fatalReason(
          error,
          'Unsupported runtime contract',
        );
        await this.hooks.enterFatalTermination(
          scopePath,
          bundle,
          reason,
          ProcessorErrorCategory.UnsupportedContract,
        );
        return;
      }
      if (error instanceof ProcessorFatalError) {
        const reason = this.hooks.fatalReason(error, 'Runtime fatal');
        await this.hooks.enterFatalTermination(
          scopePath,
          bundle,
          reason,
          error.category ?? ProcessorErrorCategory.InternalProcessorError,
        );
        return;
      }
      if (error instanceof IllegalStateException || error instanceof Error) {
        const reason = this.hooks.fatalReason(error, 'Runtime fatal');
        await this.hooks.enterFatalTermination(
          scopePath,
          bundle,
          reason,
          ProcessorErrorCategory.InternalProcessorError,
        );
        return;
      }
      throw error;
    }
  }

  async deliverLifecycle(
    scopePath: string,
    bundle: ContractBundle | null,
    event: BlueNode,
    finalizeAfter: boolean,
  ): Promise<void> {
    this.runtime.gasMeter().chargeLifecycleDelivery();
    await this.hooks.recordLifecycleForBridging(scopePath, event);
    if (!bundle) {
      return;
    }
    const lifecycleChannels = this.channelsMatching(
      bundle,
      LIFECYCLE_EVENT_CHANNEL_BLUE_ID,
    );
    for (const channel of lifecycleChannels) {
      await this.channelRunner.runHandlers(
        scopePath,
        bundle,
        channel.key(),
        event,
        true,
      );
      if (this.hooks.isScopeInactive(scopePath)) {
        break;
      }
    }
    if (finalizeAfter) {
      await this.finalizeScope(scopePath);
    }
  }

  private async routeDocumentUpdateAfterPatch(
    scopePath: string,
    bundle: ContractBundle,
    data: DocumentUpdateData,
  ): Promise<void> {
    const participants: Array<{
      scopePath: string;
      bundle: ContractBundle;
      channels: ChannelBinding[];
    }> = [];

    await this.timing.measureAsync(
      'documentUpdate.discovery',
      async () => {
        await this.markCutOffChildrenIfNeeded(scopePath, bundle, data);
        for (const cascadeScope of data.cascadeScopes) {
          if (this.hooks.isScopeInactive(cascadeScope)) {
            continue;
          }
          const targetBundle = this.refreshBundle(cascadeScope);
          if (!targetBundle) {
            continue;
          }

          const matching: ChannelBinding[] = [];
          const updateChannels = this.channelsMatching(
            targetBundle,
            DOCUMENT_UPDATE_CHANNEL_BLUE_ID,
          );
          for (const channel of updateChannels) {
            const contract = channel.contract() as DocumentUpdateChannel;
            if (
              !this.matchesDocumentUpdate(
                cascadeScope,
                typeof contract.path === 'string' ? contract.path : null,
                data.path,
              )
            ) {
              continue;
            }
            matching.push(channel);
          }
          if (matching.length > 0) {
            participants.push({
              scopePath: cascadeScope,
              bundle: targetBundle,
              channels: matching,
            });
          }
        }
      },
      { scopePath, path: data.path, op: data.op },
    );

    this.runtime.gasMeter().chargeCascadeRouting(participants.length);

    await this.timing.measureAsync(
      'documentUpdate.handlers',
      async () => {
        for (const participant of participants) {
          if (this.hooks.isScopeInactive(participant.scopePath)) {
            continue;
          }
          const updateEvent = this.createDocumentUpdateEvent(
            data,
            participant.scopePath,
          );
          for (const channel of participant.channels) {
            await this.channelRunner.runHandlers(
              participant.scopePath,
              participant.bundle,
              channel.key(),
              updateEvent,
              false,
            );
            if (this.hooks.isScopeInactive(participant.scopePath)) {
              break;
            }
          }
        }
      },
      {
        scopePath,
        path: data.path,
        op: data.op,
        participants: participants.length,
      },
    );
  }

  private async processEmbeddedChildren(
    scopePath: string,
    event: ResolvedBlueNode,
  ): Promise<ContractBundle | null> {
    const normalizedScope = normalizeScope(scopePath);
    const processed = new Set<string>();
    const scopeContext = this.runtime.scope(normalizedScope);
    scopeContext.clearProcessedEmbeddedPaths();
    let bundle = this.refreshBundle(normalizedScope);
    while (bundle) {
      let next: string | null;
      try {
        next = this.nextEmbeddedPath(normalizedScope, bundle, processed);
      } catch (error) {
        if (error instanceof BoundaryViolationException) {
          await this.hooks.enterFatalTermination(
            normalizedScope,
            bundle,
            this.hooks.fatalReason(error, 'Invalid embedded path'),
            error.category ?? ProcessorErrorCategory.BoundaryViolation,
          );
          return null;
        }
        throw error;
      }
      if (!next) {
        return bundle;
      }
      const childScope = resolvePointer(normalizedScope, next);
      processed.add(childScope);
      scopeContext.recordProcessedEmbeddedPath(childScope);
      this.runtime.setScopeEmbeddedDepth(
        childScope,
        this.runtime.scopeEmbeddedDepth(normalizedScope) + 1,
      );
      if (
        childScope === normalizedScope ||
        this.hooks.isScopeInactive(childScope)
      ) {
        bundle = this.refreshBundle(normalizedScope);
        continue;
      }
      const childNode = this.nodeAt(childScope);
      if (childNode) {
        if (!this.isObjectScope(childNode)) {
          if (eventKind(event) === 'initialize') {
            bundle = this.refreshBundle(normalizedScope);
            continue;
          }
          await this.initializeCurrentScopeIfNeeded(normalizedScope, bundle);
          await this.hooks.enterFatalTermination(
            normalizedScope,
            bundle,
            `Embedded path ${childScope} does not select an object scope`,
            ProcessorErrorCategory.BoundaryViolation,
          );
          return null;
        }
        await this.processPreparedExternalEvent(childScope, event);
        await this.hooks.afterEmbeddedChildProcessed?.(
          childScope,
          this.runtime,
        );
      }
      bundle = this.refreshBundle(normalizedScope);
    }
    return null;
  }

  private refreshBundle(scopePath: string): ContractBundle | null {
    const normalizedScope = normalizeScope(scopePath);
    const scopeNode = this.nodeAt(normalizedScope);
    if (!scopeNode) {
      this.bundles.delete(normalizedScope);
      return null;
    }
    const refreshed = this.timing.measure(
      'patch.refreshBundleAfterPatch',
      () => this.loadBundle(scopeNode, normalizedScope),
      { scopePath: normalizedScope },
    );
    this.bundles.set(normalizedScope, refreshed);
    return refreshed;
  }

  private nextEmbeddedPath(
    scopePath: string,
    bundle: ContractBundle | null,
    processed: Set<string>,
  ): string | null {
    if (!bundle) {
      return null;
    }
    const seen = new Set<string>();
    for (const candidate of bundle.embeddedPaths()) {
      const normalizedCandidate = assertValidRuntimePointer(candidate);
      const childScope = resolvePointer(scopePath, normalizedCandidate);
      if (childScope === normalizeScope(scopePath)) {
        throw new BoundaryViolationException(
          "Process Embedded path '/' cannot embed its declaring scope",
          ProcessorErrorCategory.BoundaryViolation,
        );
      }
      if (seen.has(childScope)) {
        throw new BoundaryViolationException(
          `Duplicate Process Embedded path: ${normalizedCandidate}`,
          ProcessorErrorCategory.BoundaryViolation,
        );
      }
      seen.add(childScope);
      if (!processed.has(childScope)) {
        return candidate;
      }
    }
    return null;
  }

  private isObjectScope(node: BlueNode): boolean {
    return (
      node.getValue() == null &&
      node.getItems() == null &&
      node.getReferenceBlueId() == null
    );
  }

  private loadBundle(scopeNode: BlueNode, scopePath: string): ContractBundle {
    try {
      return this.contractLoader.load(scopeNode, scopePath);
    } catch (error) {
      if (
        error instanceof ProcessorFatalError ||
        error instanceof MustUnderstandFailure
      ) {
        throw error;
      }
      const reason =
        (error as Error | undefined)?.message ?? 'Failed to load contracts';
      throw new ProcessorFatalError(
        reason,
        ProcessorErrors.runtimeFatal(
          `Failed to load contracts for scope ${scopePath}`,
          error,
        ),
      );
    }
  }

  private async addInitializationMarker(
    context: ProcessorContext,
    documentId: string,
  ): Promise<void> {
    const marker = new BlueNode()
      .setType(new BlueNode().setBlueId(PROCESSING_INITIALIZED_MARKER_BLUE_ID))
      .addProperty('documentId', new BlueNode().setValue(documentId));
    const pointer = context.resolvePointer(RELATIVE_INITIALIZED);
    await context.applyPatch({
      op: 'ADD',
      path: pointer,
      val: marker,
    } satisfies JsonPatch);
  }

  private async finalizeScope(scopePath: string): Promise<void> {
    if (this.hooks.isScopeInactive(scopePath)) {
      return;
    }
    await this.timing.measureAsync(
      'scope.phase4.bridgeEmbedded',
      () => this.bridgeEmbeddedEmissions(scopePath),
      { scopePath },
    );
    await this.timing.measureAsync(
      'scope.phase5.triggeredFifo',
      () => this.drainTriggeredQueue(scopePath),
      { scopePath },
    );
  }

  private async bridgeEmbeddedEmissions(scopePath: string): Promise<void> {
    if (this.hooks.isScopeInactive(scopePath)) {
      return;
    }
    const processedChildScopes = this.runtime
      .scope(scopePath)
      .processedEmbeddedPaths();
    if (processedChildScopes.length === 0) {
      return;
    }
    for (const childScope of processedChildScopes) {
      const childContext = this.runtime.scope(childScope);
      const emissions = childContext.drainBridgeableEvents();
      if (emissions.length === 0) {
        continue;
      }
      for (const emission of emissions) {
        const currentBundle = this.refreshBundle(scopePath);
        if (!currentBundle) {
          continue;
        }
        const embeddedChannels = this.channelsMatching(
          currentBundle,
          EMBEDDED_NODE_CHANNEL_BLUE_ID,
        );
        let charged = false;
        const deliveredChannels: string[] = [];
        for (const channel of embeddedChannels) {
          const contract = channel.contract() as EmbeddedNodeChannel;
          const configuredChild = contract.childPath ?? '/';
          const resolvedChild = resolvePointer(scopePath, configuredChild);
          if (resolvedChild !== childScope) {
            continue;
          }
          if (!charged) {
            this.runtime.gasMeter().chargeBridge();
            charged = true;
          }
          deliveredChannels.push(channel.key());
          await this.channelRunner.runHandlers(
            scopePath,
            currentBundle,
            channel.key(),
            emission.clone(),
            false,
          );
        }
        this.hooks.recordEmbeddedBridgeDelivery?.(
          emission.clone(),
          deliveredChannels,
        );
        await this.hooks.afterBridgeEmission?.(
          scopePath,
          this.runtime,
          emission.clone(),
        );
      }
    }
  }

  private async drainTriggeredQueue(scopePath: string): Promise<void> {
    if (this.hooks.isScopeInactive(scopePath)) {
      return;
    }
    const context = this.runtime.scope(scopePath);
    while (!context.triggeredIsEmpty()) {
      const next = context.pollTriggered();
      if (!next) {
        break;
      }
      const currentBundle = this.refreshBundle(scopePath);
      if (!currentBundle) {
        continue;
      }
      const triggeredChannels = this.channelsMatching(
        currentBundle,
        TRIGGERED_EVENT_CHANNEL_BLUE_ID,
      );
      if (triggeredChannels.length === 0) {
        continue;
      }
      this.runtime.gasMeter().chargeDrainEvent();
      for (const channel of triggeredChannels) {
        if (this.hooks.isScopeInactive(scopePath)) {
          context.clearTriggered();
          return;
        }
        await this.channelRunner.runHandlers(
          scopePath,
          currentBundle,
          channel.key(),
          next.clone(),
          false,
        );
        if (this.hooks.isScopeInactive(scopePath)) {
          context.clearTriggered();
          return;
        }
      }
    }
  }

  private channelsMatching(
    bundle: ContractBundle,
    ...blueIds: readonly string[]
  ): ChannelBinding[] {
    if (blueIds.length === 0) {
      return bundle.channelsOfType();
    }
    const blue = this.runtime.blue();
    return bundle.channelsOfType().filter((channel) => {
      const node = channel.node();
      return blueIds.some((blueId) => safeIsTypeOfBlueId(blue, node, blueId));
    });
  }

  private isProcessorManagedChannel(channel: ChannelBinding): boolean {
    const blue = this.runtime.blue();
    const node = channel.node();
    for (const blueId of PROCESSOR_MANAGED_CHANNEL_BLUE_IDS) {
      if (safeIsTypeOfBlueId(blue, node, blueId)) {
        return true;
      }
    }
    return false;
  }

  private validatePatchBoundary(
    scopePath: string,
    bundle: ContractBundle,
    patch: JsonPatch,
  ): void {
    const normalizedScope = normalizeScope(scopePath);
    const targetPath = normalizePointer(patch.path);

    if (targetPath === normalizedScope) {
      throw new BoundaryViolationException(
        `Self-root mutation is forbidden at scope ${normalizedScope}`,
        ProcessorErrorCategory.BoundaryViolation,
      );
    }

    if (
      normalizedScope !== '/' &&
      !targetPath.startsWith(`${normalizedScope}/`)
    ) {
      throw new BoundaryViolationException(
        `Patch path ${targetPath} is outside scope ${normalizedScope}`,
        ProcessorErrorCategory.BoundaryViolation,
      );
    }

    for (const embeddedPointer of bundle.embeddedPaths()) {
      const embeddedScope = resolvePointer(normalizedScope, embeddedPointer);
      if (targetPath.startsWith(`${embeddedScope}/`)) {
        throw new BoundaryViolationException(
          `Boundary violation: patch ${targetPath} enters embedded scope ${embeddedScope}`,
          ProcessorErrorCategory.BoundaryViolation,
        );
      }
    }
  }

  private enforceReservedKeyWriteProtection(
    scopePath: string,
    patch: JsonPatch,
    allowReservedMutation: boolean,
  ): void {
    if (allowReservedMutation) {
      return;
    }
    const normalizedScope = normalizeScope(scopePath);
    const targetPath = normalizePointer(patch.path);
    const contractsPointer = resolvePointer(
      normalizedScope,
      RELATIVE_CONTRACTS,
    );
    if (targetPath === contractsPointer) {
      this.enforceContractsMapReservedSubtreePreservation(
        normalizedScope,
        patch,
      );
      return;
    }
    for (const key of RESERVED_CONTRACT_KEYS) {
      const reservedPointer = resolvePointer(
        normalizedScope,
        relativeContractsEntry(key),
      );
      if (
        key === KEY_EMBEDDED &&
        (targetPath === `${reservedPointer}/paths` ||
          targetPath.startsWith(`${reservedPointer}/paths/`))
      ) {
        continue;
      }
      if (
        targetPath === reservedPointer ||
        targetPath.startsWith(`${reservedPointer}/`)
      ) {
        throw new BoundaryViolationException(
          `Reserved key '${key}' is write-protected at ${reservedPointer}`,
          ProcessorErrorCategory.ReservedKeyWrite,
        );
      }
    }
  }

  private enforceContractsMapReservedSubtreePreservation(
    scopePath: string,
    patch: JsonPatch,
  ): void {
    for (const key of RESERVED_CONTRACT_KEYS) {
      const reservedPointer = resolvePointer(
        scopePath,
        relativeContractsEntry(key),
      );
      const existing = this.nodeAt(reservedPointer);
      if (!existing) {
        continue;
      }
      const proposed =
        patch.op === 'REMOVE'
          ? null
          : (patch.val?.getProperties()?.[key] ?? null);
      if (!this.semanticallyEqual(existing, proposed)) {
        throw new BoundaryViolationException(
          `Replacing /contracts must preserve reserved key '${key}'`,
          ProcessorErrorCategory.ReservedKeyWrite,
        );
      }
    }
  }

  private semanticallyEqual(
    left: BlueNode | null,
    right: BlueNode | null,
  ): boolean {
    if (left == null || right == null) {
      return left == null && right == null;
    }
    return this.blueId(left) === this.blueId(right);
  }

  private async markCutOffChildrenIfNeeded(
    scopePath: string,
    bundle: ContractBundle,
    data: DocumentUpdateData,
  ): Promise<void> {
    if (bundle.embeddedPaths().length === 0) {
      return;
    }
    const changedPath = normalizePointer(data.path);
    for (const embeddedPointer of bundle.embeddedPaths()) {
      const childScope = resolvePointer(scopePath, embeddedPointer);
      if (changedPath !== childScope) {
        continue;
      }
      if (data.op === 'remove' || data.op === 'replace') {
        await this.hooks.markCutOff(childScope);
      }
    }
  }

  private async initializeCurrentScopeIfNeeded(
    scopePath: string,
    bundle: ContractBundle,
  ): Promise<void> {
    const normalizedScope = normalizeScope(scopePath);
    if (
      this.hasInitializationMarker(normalizedScope) ||
      this.hooks.isScopeInactive(normalizedScope)
    ) {
      return;
    }
    const scopeNode = this.nodeAt(normalizedScope);
    const documentId = this.blueId(scopeNode ?? new BlueNode());
    this.runtime.gasMeter().chargeInitialization();
    const lifecycleEvent = this.createLifecycleEvent(documentId);
    const context = this.hooks.createContext(
      normalizedScope,
      bundle,
      lifecycleEvent,
      false,
      true,
    );
    await this.deliverLifecycle(normalizedScope, bundle, lifecycleEvent, false);
    if (!this.hooks.isScopeInactive(normalizedScope)) {
      await this.addInitializationMarker(context, documentId);
    }
  }

  private terminationMarkerKind(scopePath: string): TerminationKind | null {
    const markerPointer = resolvePointer(scopePath, RELATIVE_TERMINATED);
    const node = this.nodeAt(markerPointer);
    if (!node) {
      return null;
    }
    const typeBlueId = node.getType()?.getBlueId();
    if (typeBlueId !== PROCESSING_TERMINATED_MARKER_BLUE_ID) {
      throw new IllegalStateException(
        `Reserved key 'terminated' must contain a Processing Terminated Marker at ${markerPointer}`,
      );
    }
    const cause = node.getProperties()?.cause?.getValue();
    if (cause === 'fatal') {
      return 'FATAL';
    }
    if (cause === 'graceful') {
      return 'GRACEFUL';
    }
    throw new IllegalStateException(
      `Reserved key 'terminated' must contain a valid cause at ${markerPointer}`,
    );
  }

  private hasInitializationMarker(scopePath: string): boolean {
    const markerPointer = resolvePointer(scopePath, RELATIVE_INITIALIZED);
    const node = this.nodeAt(markerPointer);
    if (!node) {
      return false;
    }
    if (!(node instanceof BlueNode)) {
      const message = `Reserved key 'initialized' must contain a Processing Initialized Marker at ${markerPointer}`;
      throw new IllegalStateException(message);
    }
    const typeBlueId = node.getType()?.getBlueId();
    if (typeBlueId !== PROCESSING_INITIALIZED_MARKER_BLUE_ID) {
      const message = `Reserved key 'initialized' must contain a Processing Initialized Marker at ${markerPointer}`;
      throw new IllegalStateException(message);
    }
    return true;
  }

  private createLifecycleEvent(documentId: string): BlueNode {
    return new BlueNode()
      .setType(new BlueNode().setBlueId(DOCUMENT_PROCESSING_INITIATED_BLUE_ID))
      .setProperties({
        type: new BlueNode().setValue('Document Processing Initiated'),
        documentId: new BlueNode().setValue(documentId),
      });
  }
}

function eventKind(event: BlueNode): string | null {
  const value = event.getProperties()?.kind?.getValue();
  return value == null ? null : String(value);
}

function assertValidRuntimePointer(pointer: string): string {
  if (pointer.length === 0) {
    throw new BoundaryViolationException(
      'Runtime pointer must not be empty',
      ProcessorErrorCategory.BoundaryViolation,
    );
  }
  if (!pointer.startsWith('/')) {
    throw new BoundaryViolationException(
      `Runtime pointer must be absolute: ${pointer}`,
      ProcessorErrorCategory.BoundaryViolation,
    );
  }
  if (pointer.length > 1 && pointer.endsWith('/')) {
    throw new BoundaryViolationException(
      `Runtime pointer must not have a trailing slash: ${pointer}`,
      ProcessorErrorCategory.BoundaryViolation,
    );
  }
  for (const segment of pointer.slice(1).split('/')) {
    if (segment.length === 0) {
      throw new BoundaryViolationException(
        `Runtime pointer must not contain empty segments: ${pointer}`,
        ProcessorErrorCategory.BoundaryViolation,
      );
    }
    for (let i = 0; i < segment.length; i += 1) {
      if (segment[i] !== '~') {
        continue;
      }
      const next = segment[i + 1];
      if (next !== '0' && next !== '1') {
        throw new BoundaryViolationException(
          `Runtime pointer contains bad '~' escape: ${pointer}`,
          ProcessorErrorCategory.BoundaryViolation,
        );
      }
      i += 1;
    }
  }
  return pointer;
}
