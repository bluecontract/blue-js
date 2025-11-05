import { BlueNode } from '@blue-labs/language';
import type {
  ContractBundle,
  ChannelBinding,
  HandlerBinding,
} from './contract-bundle.js';
import { DocumentProcessingRuntime } from '../runtime/document-processing-runtime.js';
import { CheckpointManager } from './checkpoint-manager.js';
import type { ProcessorExecutionContext } from './processor-execution-context.js';

export interface ChannelMatch {
  readonly matches: boolean;
  readonly eventId?: string | null;
  readonly eventNode?: BlueNode | null;
}

export interface ChannelRunnerDependencies {
  evaluateChannel(
    channel: ChannelBinding,
    bundle: ContractBundle,
    scopePath: string,
    event: BlueNode,
  ): Promise<ChannelMatch>;
  isScopeInactive(scopePath: string): boolean;
  createContext(
    scopePath: string,
    bundle: ContractBundle,
    event: BlueNode,
    allowTerminatedWork: boolean,
  ): ProcessorExecutionContext;
  shouldRunHandler(
    handler: HandlerBinding,
    context: ProcessorExecutionContext,
  ): Promise<boolean>;
  executeHandler(
    handler: HandlerBinding,
    context: ProcessorExecutionContext,
  ): Promise<void>;
  canonicalSignature(node: BlueNode | null): string | null;
}

export class ChannelRunner {
  constructor(
    private readonly runtime: DocumentProcessingRuntime,
    private readonly checkpointManager: CheckpointManager,
    private readonly deps: ChannelRunnerDependencies,
  ) {}

  async runExternalChannel(
    scopePath: string,
    bundle: ContractBundle,
    channel: ChannelBinding,
    event: BlueNode,
  ): Promise<void> {
    if (this.deps.isScopeInactive(scopePath)) {
      return;
    }
    this.runtime.gasMeter().chargeChannelMatchAttempt();

    const match = await this.deps.evaluateChannel(
      channel,
      bundle,
      scopePath,
      event,
    );
    if (!match.matches) {
      return;
    }

    const eventForHandlers = match.eventNode ?? event;
    const checkpointEvent = event; // persist and dedupe against the original external event
    this.checkpointManager.ensureCheckpointMarker(scopePath, bundle);
    const checkpoint = this.checkpointManager.findCheckpoint(
      bundle,
      channel.key(),
    );
    const eventSignature =
      match.eventId ?? this.deps.canonicalSignature(checkpointEvent);
    if (this.checkpointManager.isDuplicate(checkpoint, eventSignature)) {
      return;
    }

    await this.runHandlers(
      scopePath,
      bundle,
      channel.key(),
      eventForHandlers,
      false,
    );
    if (this.deps.isScopeInactive(scopePath)) {
      return;
    }

    this.checkpointManager.persist(
      scopePath,
      bundle,
      checkpoint,
      eventSignature ?? null,
      checkpointEvent,
    );
  }

  async runHandlers(
    scopePath: string,
    bundle: ContractBundle,
    channelKey: string,
    event: BlueNode,
    allowTerminatedWork: boolean,
  ): Promise<void> {
    const handlers = bundle.handlersFor(channelKey);
    if (handlers.length === 0) {
      return;
    }

    for (const handler of handlers) {
      if (!allowTerminatedWork && this.deps.isScopeInactive(scopePath)) {
        break;
      }
      const context = this.deps.createContext(
        scopePath,
        bundle,
        event,
        allowTerminatedWork,
      );
      const shouldRun = await this.deps.shouldRunHandler(handler, context);
      if (!shouldRun) {
        continue;
      }
      this.runtime.gasMeter().chargeHandlerOverhead();
      await this.deps.executeHandler(handler, context);
      if (!allowTerminatedWork && this.deps.isScopeInactive(scopePath)) {
        break;
      }
    }
  }
}
