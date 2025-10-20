import type { Node } from '../types/index.js';
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
import { BlueNode } from '@blue-labs/language';
import { ProcessorFatalError } from './processor-fatal-error.js';
import { ProcessorErrors, type ProcessorError } from '../types/errors.js';

export interface ProcessorContext {
  resolvePointer(relativePointer: string): string;
  applyPatch(patch: JsonPatch): void;
}

export interface ScopeExecutionHooks {
  isScopeInactive(scopePath: string): boolean;
  createContext(
    scopePath: string,
    bundle: ContractBundle,
    event: Node,
    allowTerminatedWork: boolean,
    lifecycle?: boolean,
  ): ProcessorContext;
  recordLifecycleForBridging(scopePath: string, event: Node): void;
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
  blueId: (node: Node) => string;
  nodeAt(scopePath: string): Node | null;
  createDocumentUpdateEvent(data: DocumentUpdateData, scopePath: string): Node;
  matchesDocumentUpdate(scopePath: string, watchPath: string | null | undefined, changedPath: string): boolean;
}

export class ScopeExecutor {
  private readonly runtime: DocumentProcessingRuntime;
  private readonly contractLoader: ContractLoader;
  private readonly channelRunner: ChannelRunner;
  private readonly bundles: Map<string, ContractBundle>;
  private readonly hooks: ScopeExecutionHooks;
  private readonly blueId: (node: Node) => string;
  private readonly nodeAt: (scopePath: string) => Node | null;
  private readonly createDocumentUpdateEvent: (data: DocumentUpdateData, scopePath: string) => Node;
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
    let preInitSnapshot: Node | null = null;

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
      throw new Error(
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

  processExternalEvent(scopePath: string, event: Node): void {
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
      const reason = this.hooks.fatalReason(error, 'Boundary violation');
      this.hooks.enterFatalTermination(scopePath, bundle, reason);
      return;
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
        const updateChannels = targetBundle.channelsOfType('DocumentUpdateChannel');
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
      const reason = this.hooks.fatalReason(error, 'Runtime fatal');
      this.hooks.enterFatalTermination(scopePath, bundle, reason);
    }
  }

  deliverLifecycle(scopePath: string, bundle: ContractBundle | null, event: Node, finalizeAfter: boolean): void {
    this.runtime.chargeLifecycleDelivery();
    this.hooks.recordLifecycleForBridging(scopePath, event);
    if (!bundle) {
      return;
    }
    const lifecycleChannels = bundle.channelsOfType('LifecycleChannel');
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

  private processEmbeddedChildren(scopePath: string, event: Node): ContractBundle | null {
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

  private loadBundle(scopeNode: Node, scopePath: string): ContractBundle {
    const result = this.contractLoader.load(scopeNode, scopePath);
    if (result.ok) {
      return result.value;
    }
    const message = this.describeProcessorError(result.error);
    throw new ProcessorFatalError(message, result.error);
  }

  private describeProcessorError(error: ProcessorError): string {
    switch (error.kind) {
      case 'CapabilityFailure':
        return `${error.kind}: ${error.reason}`;
      case 'BoundaryViolation':
        return `${error.kind} at ${error.pointer}: ${error.reason}`;
      case 'RuntimeFatal':
        return `${error.kind}: ${error.reason}`;
      case 'InvalidContract': {
        const pointer = error.pointer ? ` @ ${error.pointer}` : '';
        return `${error.kind} (${error.contractId}${pointer}): ${error.reason}`;
      }
      case 'IllegalState':
        return `${error.kind}: ${error.reason}`;
      case 'UnsupportedOp': {
        const suffix = error.reason ? `: ${error.reason}` : '';
        return `${error.kind} ${error.operation}${suffix}`;
      }
    }
    return 'Unhandled processor error kind';
  }

  private addInitializationMarker(context: ProcessorContext, documentId: string): void {
    const marker = new BlueNode()
      .setType(new BlueNode().setBlueId('InitializationMarker'))
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
    const embeddedChannels = bundle.channelsOfType('EmbeddedNodeChannel');
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
    const triggeredChannels = bundle.channelsOfType('TriggeredEventChannel');
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
      throw new Error(`Self-root mutation is forbidden at scope ${normalizedScope}`);
    }

    if (normalizedScope !== '/' && !targetPath.startsWith(`${normalizedScope}/`)) {
      throw new Error(`Patch path ${targetPath} is outside scope ${normalizedScope}`);
    }

    for (const embeddedPointer of bundle.embeddedPaths()) {
      const embeddedScope = resolvePointer(normalizedScope, embeddedPointer);
      if (targetPath.startsWith(`${embeddedScope}/`)) {
        throw new Error(`Boundary violation: patch ${targetPath} enters embedded scope ${embeddedScope}`);
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
        throw new Error(`Reserved key '${key}' is write-protected at ${reservedPointer}`);
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
      const message = `Reserved key 'initialized' must contain an Initialization Marker at ${markerPointer}`;
      throw new ProcessorFatalError(
        message,
        ProcessorErrors.illegalState(message),
      );
    }
    const typeBlueId = node.getType()?.getBlueId();
    if (typeBlueId !== 'InitializationMarker') {
      const message = `Reserved key 'initialized' must contain an Initialization Marker at ${markerPointer}`;
      throw new ProcessorFatalError(
        message,
        ProcessorErrors.illegalState(message),
      );
    }
    return true;
  }

  private createLifecycleEvent(documentId: string): Node {
    return new BlueNode()
      .setProperties({
        type: new BlueNode().setValue('Document Processing Initiated'),
        documentId: new BlueNode().setValue(documentId),
      });
  }
}
