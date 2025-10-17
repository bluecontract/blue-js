import type { Node } from '../types/index.js';
import type { ChannelContract, HandlerContract } from '../model/index.js';
import { canonicalSignature } from '../util/node-canonicalizer.js';
import type { ContractBundle, ChannelBinding } from './contract-bundle.js';
import { DocumentProcessingRuntime } from '../runtime/document-processing-runtime.js';
import { CheckpointManager } from './checkpoint-manager.js';

export interface ChannelMatch {
  readonly matches: boolean;
  readonly eventId?: string | null;
  readonly eventNode?: Node | null;
}

export interface ChannelRunnerDependencies {
  evaluateChannel(
    contract: ChannelContract,
    bundle: ContractBundle,
    scopePath: string,
    event: Node,
  ): ChannelMatch;
  isScopeInactive(scopePath: string): boolean;
  createContext(
    scopePath: string,
    bundle: ContractBundle,
    event: Node,
    allowTerminatedWork: boolean,
  ): unknown;
  executeHandler(handler: HandlerContract, context: unknown): void;
}

export class ChannelRunner {
  constructor(
    private readonly runtime: DocumentProcessingRuntime,
    private readonly checkpointManager: CheckpointManager,
    private readonly deps: ChannelRunnerDependencies,
  ) {}

  runExternalChannel(
    scopePath: string,
    bundle: ContractBundle,
    channel: ChannelBinding,
    event: Node,
  ): void {
    if (this.deps.isScopeInactive(scopePath)) {
      return;
    }
    this.runtime.chargeChannelMatchAttempt();

    const match = this.deps.evaluateChannel(
      channel.contract(),
      bundle,
      scopePath,
      event,
    );
    if (!match.matches) {
      return;
    }

    const eventForHandlers = match.eventNode ?? event;
    this.checkpointManager.ensureCheckpointMarker(scopePath, bundle);
    const checkpoint = this.checkpointManager.findCheckpoint(bundle, channel.key());
    const eventSignature = match.eventId ?? canonicalSignature(eventForHandlers);
    if (this.checkpointManager.isDuplicate(checkpoint, eventSignature)) {
      return;
    }

    this.runHandlers(scopePath, bundle, channel.key(), eventForHandlers, false);
    if (this.deps.isScopeInactive(scopePath)) {
      return;
    }

    this.checkpointManager.persist(
      scopePath,
      bundle,
      checkpoint,
      eventSignature ?? null,
      eventForHandlers,
    );
  }

  runHandlers(
    scopePath: string,
    bundle: ContractBundle,
    channelKey: string,
    event: Node,
    allowTerminatedWork: boolean,
  ): void {
    const handlers = bundle.handlersFor(channelKey);
    if (handlers.length === 0) {
      return;
    }

    for (const handler of handlers) {
      if (!allowTerminatedWork && this.deps.isScopeInactive(scopePath)) {
        break;
      }
      this.runtime.chargeHandlerOverhead();
      const context = this.deps.createContext(
        scopePath,
        bundle,
        event,
        allowTerminatedWork,
      );
      this.deps.executeHandler(handler.contract(), context);
      if (!allowTerminatedWork && this.deps.isScopeInactive(scopePath)) {
        break;
      }
    }
  }
}
