import { blueIds } from '@blue-repository/core';
import { BlueNode } from '@blue-labs/language';

import { ContractBundle } from './contract-bundle.js';
import type { ChannelRunner } from './channel-runner.js';
import type { ContractLoader } from './contract-loader.js';
import type {
  DocumentUpdateChannel,
  EmbeddedNodeChannel,
} from '../model/index.js';
import type { JsonPatch } from '../model/shared/json-patch.js';
import type { DocumentUpdateData } from '../runtime/document-processing-runtime.js';
import { DocumentProcessingRuntime } from '../runtime/document-processing-runtime.js';
import {
  RESERVED_CONTRACT_KEYS,
  isProcessorManagedChannelBlueId,
} from '../constants/processor-contract-constants.js';
import {
  RELATIVE_INITIALIZED,
  relativeContractsEntry,
} from '../constants/processor-pointer-constants.js';
import {
  normalizeScope,
  normalizePointer,
  resolvePointer,
} from '../util/pointer-utils.js';
import { ProcessorFatalError } from './processor-fatal-error.js';
import { ProcessorErrors } from '../types/errors.js';
import { MustUnderstandFailure } from './must-understand-failure.js';
import { IllegalStateException } from './illegal-state-exception.js';
import { BoundaryViolationException } from './boundary-violation-exception.js';

const DOCUMENT_UPDATE_CHANNEL_BLUE_ID =
  blueIds['Document Update Channel'];
const EMBEDDED_NODE_CHANNEL_BLUE_ID =
  blueIds['Embedded Node Channel'];
const TRIGGERED_EVENT_CHANNEL_BLUE_ID =
  blueIds['Triggered Event Channel'];
const LIFECYCLE_EVENT_CHANNEL_BLUE_ID =
  blueIds['Lifecycle Event Channel'];
const PROCESSING_INITIALIZED_MARKER_BLUE_ID =
  blueIds['Processing Initialized Marker'];
const DOCUMENT_PROCESSING_INITIATED_BLUE_ID =
  blueIds['Document Processing Initiated'];

export interface ProcessorContext {
  resolvePointer(relativePointer: string): string;
  applyPatch(patch: JsonPatch): void;
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
  recordLifecycleForBridging(scopePath: string, event: BlueNode): void;
  enterFatalTermination(scopePath: string, bundle: ContractBundle | null, reason: string): void;
  fatalReason(error: unknown, label: string): string;
  markCutOff(scopePath: string): void;
}

export interface ScopeExecutorOptions {
  runtime: DocumentProcessingRuntime;
  contractLoader: ContractLoader;
  channelRunner: ChannelRunner;
  bundles: Map<string, ContractBundle>;
  hooks: ScopeExecutionHooks;
  blueId: (node: BlueNode) => string;
  nodeAt(scopePath: string): BlueNode | null;
  createDocumentUpdateEvent(data: DocumentUpdateData, scopePath: string): BlueNode;
  matchesDocumentUpdate(scopePath: string, watchPath: string | null | undefined, changedPath: string): boolean;
}

export class ScopeExecutor {
  private readonly runtime: DocumentProcessingRuntime;
  private readonly contractLoader: ContractLoader;
  private readonly channelRunner: ChannelRunner;
  private readonly bundles: Map<string, ContractBundle>;
  private readonly hooks: ScopeExecutionHooks;
  private readonly blueId: (node: BlueNode) => string;
  private readonly nodeAt: (scopePath: string) => BlueNode | null;
  private readonly createDocumentUpdateEvent: (data: DocumentUpdateData, scopePath: string) => BlueNode;
  private readonly matchesDocumentUpdate: (
    scopePath: string,
    watchPath: string | null | undefined,
    changedPath: string,
  ) => boolean;

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
  }

  initializeScope(scopePath: string, chargeScopeEntry: boolean): void {
    const normalizedScope = normalizeScope(scopePath);
    const processedEmbedded = new Set<string>();
    let bundle: ContractBundle | null = null;
    let preInitSnapshot: BlueNode | null = null;

    if (chargeScopeEntry) {
      this.runtime.chargeScopeEntry(normalizedScope);
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

      const nextEmbedded = bundle.embeddedPaths().find((path) => !processedEmbedded.has(path)) ?? null;
      if (!nextEmbedded) {
        break;
      }
      processedEmbedded.add(nextEmbedded);
      const childScope = resolvePointer(normalizedScope, nextEmbedded);
      const childNode = this.nodeAt(childScope);
      if (childNode) {
        this.initializeScope(childScope, true);
      }
    }

    if (!bundle) {
      return;
    }

    const initializedMarker = this.hasInitializationMarker(normalizedScope);
    if (!initializedMarker && bundle.hasCheckpoint()) {
      throw new IllegalStateException(
        `Reserved key 'checkpoint' must not appear before initialization at scope ${normalizedScope}`,
      );
    }

    if (initializedMarker) {
      return;
    }

    this.runtime.chargeInitialization();
    const documentId = this.blueId(preInitSnapshot ?? new BlueNode());
    const lifecycleEvent = this.createLifecycleEvent(documentId);
    const context = this.hooks.createContext(normalizedScope, bundle, lifecycleEvent, false, true);
    this.deliverLifecycle(normalizedScope, bundle, lifecycleEvent, true);
    this.addInitializationMarker(context, documentId);
  }

  loadBundles(scopePath: string): void {
    const normalizedScope = normalizeScope(scopePath);
    if (this.bundles.has(normalizedScope)) {
      return;
    }
    const scopeNode = this.nodeAt(normalizedScope);
    const bundle = scopeNode
      ? this.loadBundle(scopeNode, normalizedScope)
      : ContractBundle.empty();
    this.bundles.set(normalizedScope, bundle);
    for (const embeddedPointer of bundle.embeddedPaths()) {
      const childScope = resolvePointer(normalizedScope, embeddedPointer);
      this.loadBundles(childScope);
    }
  }

  processExternalEvent(scopePath: string, event: BlueNode): void {
    const normalizedScope = normalizeScope(scopePath);
    if (this.hooks.isScopeInactive(normalizedScope)) {
      return;
    }
    this.runtime.chargeScopeEntry(normalizedScope);
    const bundle = this.processEmbeddedChildren(normalizedScope, event);
    if (!bundle) {
      return;
    }

    const channels = bundle.channelsOfType();
    if (channels.length === 0) {
      this.finalizeScope(normalizedScope, bundle);
      return;
    }

    for (const channel of channels) {
      if (this.hooks.isScopeInactive(normalizedScope)) {
        break;
      }
      if (isProcessorManagedChannelBlueId(channel.blueId())) {
        continue;
      }
      this.channelRunner.runExternalChannel(normalizedScope, bundle, channel, event);
    }
    this.finalizeScope(normalizedScope, bundle);
  }

  handlePatch(
    scopePath: string,
    bundle: ContractBundle,
    patch: JsonPatch,
    allowReservedMutation: boolean,
  ): void {
    if (this.hooks.isScopeInactive(scopePath)) {
      return;
    }
    this.runtime.chargeBoundaryCheck();
    try {
      this.validatePatchBoundary(scopePath, bundle, patch);
      this.enforceReservedKeyWriteProtection(scopePath, patch, allowReservedMutation);
    } catch (error) {
      if (error instanceof BoundaryViolationException) {
        const reason = this.hooks.fatalReason(error, 'Boundary violation');
        this.hooks.enterFatalTermination(scopePath, bundle, reason);
        return;
      }
      throw error;
    }

    try {
      switch (patch.op) {
        case 'ADD':
        case 'REPLACE':
          this.runtime.chargePatchAddOrReplace(patch.val ?? null);
          break;
        case 'REMOVE':
          this.runtime.chargePatchRemove();
          break;
        default:
          break;
      }

      const data = this.runtime.applyPatch(scopePath, patch);
      if (!data) {
        return;
      }

      this.markCutOffChildrenIfNeeded(scopePath, bundle, data);
      this.runtime.chargeCascadeRouting(data.cascadeScopes.length);

      for (const cascadeScope of data.cascadeScopes) {
        const targetBundle = this.bundles.get(cascadeScope);
        if (!targetBundle || this.hooks.isScopeInactive(cascadeScope)) {
          continue;
        }

        const updateEvent = this.createDocumentUpdateEvent(data, cascadeScope);
        const updateChannels = targetBundle.channelsOfType(
          DOCUMENT_UPDATE_CHANNEL_BLUE_ID,
        );
        for (const channel of updateChannels) {
          const contract = channel.contract() as DocumentUpdateChannel;
          if (!this.matchesDocumentUpdate(cascadeScope, contract.path ?? null, data.path)) {
            continue;
          }
          this.channelRunner.runHandlers(cascadeScope, targetBundle, channel.key(), updateEvent, false);
          if (this.hooks.isScopeInactive(cascadeScope)) {
            break;
          }
        }
      }
    } catch (error) {
      if (error instanceof BoundaryViolationException) {
        const reason = this.hooks.fatalReason(error, 'Boundary violation');
        this.hooks.enterFatalTermination(scopePath, bundle, reason);
        return;
      }
      if (
        error instanceof IllegalStateException ||
        (error instanceof Error && !(error instanceof ProcessorFatalError))
      ) {
        const reason = this.hooks.fatalReason(error, 'Runtime fatal');
        this.hooks.enterFatalTermination(scopePath, bundle, reason);
        return;
      }
      throw error;
    }
  }

  deliverLifecycle(scopePath: string, bundle: ContractBundle | null, event: BlueNode, finalizeAfter: boolean): void {
    this.runtime.chargeLifecycleDelivery();
    this.hooks.recordLifecycleForBridging(scopePath, event);
    if (!bundle) {
      return;
    }
    const lifecycleChannels = bundle.channelsOfType(
      LIFECYCLE_EVENT_CHANNEL_BLUE_ID,
    );
    for (const channel of lifecycleChannels) {
      this.channelRunner.runHandlers(scopePath, bundle, channel.key(), event, true);
      if (this.hooks.isScopeInactive(scopePath)) {
        break;
      }
    }
    if (finalizeAfter) {
      this.finalizeScope(scopePath, bundle);
    }
  }

  private processEmbeddedChildren(scopePath: string, event: BlueNode): ContractBundle | null {
    const normalizedScope = normalizeScope(scopePath);
    const processed = new Set<string>();
    let bundle = this.refreshBundle(normalizedScope);
    while (bundle) {
      const next = this.nextEmbeddedPath(bundle, processed);
      if (!next) {
        return bundle;
      }
      processed.add(next);
      const childScope = resolvePointer(normalizedScope, next);
      if (childScope === normalizedScope || this.hooks.isScopeInactive(childScope)) {
        bundle = this.refreshBundle(normalizedScope);
        continue;
      }
      const childNode = this.nodeAt(childScope);
      if (childNode) {
        this.initializeScope(childScope, false);
        this.processExternalEvent(childScope, event);
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
    const refreshed = this.loadBundle(scopeNode, normalizedScope);
    this.bundles.set(normalizedScope, refreshed);
    return refreshed;
  }

  private nextEmbeddedPath(bundle: ContractBundle | null, processed: Set<string>): string | null {
    if (!bundle) {
      return null;
    }
    for (const candidate of bundle.embeddedPaths()) {
      if (!processed.has(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  private loadBundle(scopeNode: BlueNode, scopePath: string): ContractBundle {
    try {
      return this.contractLoader.load(scopeNode, scopePath);
    } catch (error) {
      if (error instanceof ProcessorFatalError || error instanceof MustUnderstandFailure) {
        throw error;
      }
      const reason =
        (error as Error | undefined)?.message ??
        'Failed to load contracts';
      throw new ProcessorFatalError(
        reason,
        ProcessorErrors.runtimeFatal(
          `Failed to load contracts for scope ${scopePath}`,
          error,
        ),
      );
    }
  }

  private addInitializationMarker(context: ProcessorContext, documentId: string): void {
    const marker = new BlueNode()
      .setType(new BlueNode().setBlueId(PROCESSING_INITIALIZED_MARKER_BLUE_ID))
      .addProperty('documentId', new BlueNode().setValue(documentId));
    const pointer = context.resolvePointer(RELATIVE_INITIALIZED);
    context.applyPatch({ op: 'ADD', path: pointer, val: marker } satisfies JsonPatch);
  }

  private finalizeScope(scopePath: string, bundle: ContractBundle): void {
    if (this.hooks.isScopeInactive(scopePath)) {
      return;
    }
    this.bridgeEmbeddedEmissions(scopePath, bundle);
    this.drainTriggeredQueue(scopePath, bundle);
  }

  private bridgeEmbeddedEmissions(scopePath: string, bundle: ContractBundle): void {
    if (this.hooks.isScopeInactive(scopePath) || bundle.embeddedPaths().length === 0) {
      return;
    }
    const embeddedChannels = bundle.channelsOfType(
      EMBEDDED_NODE_CHANNEL_BLUE_ID,
    );
    if (embeddedChannels.length === 0) {
      return;
    }
    for (const embeddedPointer of bundle.embeddedPaths()) {
      const childScope = resolvePointer(scopePath, embeddedPointer);
      const childContext = this.runtime.scope(childScope);
      const emissions = childContext.drainBridgeableEvents();
      if (emissions.length === 0) {
        continue;
      }
      for (const emission of emissions) {
        let charged = false;
        for (const channel of embeddedChannels) {
          const contract = channel.contract() as EmbeddedNodeChannel;
          const configuredChild = contract.childPath ?? '/';
          const resolvedChild = resolvePointer(scopePath, configuredChild);
          if (resolvedChild !== childScope) {
            continue;
          }
          if (!charged) {
            this.runtime.chargeBridge(emission);
            charged = true;
          }
          this.channelRunner.runHandlers(scopePath, bundle, channel.key(), emission.clone(), false);
        }
      }
    }
  }

  private drainTriggeredQueue(scopePath: string, bundle: ContractBundle): void {
    if (this.hooks.isScopeInactive(scopePath)) {
      return;
    }
    const context = this.runtime.scope(scopePath);
    const triggeredChannels = bundle.channelsOfType(
      TRIGGERED_EVENT_CHANNEL_BLUE_ID,
    );
    if (triggeredChannels.length === 0) {
      context.clearTriggered();
      return;
    }
    while (!context.triggeredIsEmpty()) {
      const next = context.pollTriggered();
      if (!next) {
        break;
      }
      this.runtime.chargeDrainEvent();
      for (const channel of triggeredChannels) {
        if (this.hooks.isScopeInactive(scopePath)) {
          context.clearTriggered();
          return;
        }
        this.channelRunner.runHandlers(scopePath, bundle, channel.key(), next.clone(), false);
        if (this.hooks.isScopeInactive(scopePath)) {
          context.clearTriggered();
          return;
        }
      }
    }
  }

  private validatePatchBoundary(scopePath: string, bundle: ContractBundle, patch: JsonPatch): void {
    const normalizedScope = normalizeScope(scopePath);
    const targetPath = normalizePointer(patch.path);

    if (targetPath === normalizedScope) {
      throw new BoundaryViolationException(`Self-root mutation is forbidden at scope ${normalizedScope}`);
    }

    if (normalizedScope !== '/' && !targetPath.startsWith(`${normalizedScope}/`)) {
      throw new BoundaryViolationException(`Patch path ${targetPath} is outside scope ${normalizedScope}`);
    }

    for (const embeddedPointer of bundle.embeddedPaths()) {
      const embeddedScope = resolvePointer(normalizedScope, embeddedPointer);
      if (targetPath.startsWith(`${embeddedScope}/`)) {
        throw new BoundaryViolationException(
          `Boundary violation: patch ${targetPath} enters embedded scope ${embeddedScope}`,
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
    for (const key of RESERVED_CONTRACT_KEYS) {
      const reservedPointer = resolvePointer(normalizedScope, relativeContractsEntry(key));
      if (targetPath === reservedPointer || targetPath.startsWith(`${reservedPointer}/`)) {
        throw new BoundaryViolationException(`Reserved key '${key}' is write-protected at ${reservedPointer}`);
      }
    }
  }

  private markCutOffChildrenIfNeeded(
    scopePath: string,
    bundle: ContractBundle,
    data: DocumentUpdateData,
  ): void {
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
        this.hooks.markCutOff(childScope);
      }
    }
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
