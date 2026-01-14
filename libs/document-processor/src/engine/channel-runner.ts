import { BlueNode, ResolvedBlueNode } from '@blue-labs/language';
import type {
  ContractBundle,
  ChannelBinding,
  HandlerBinding,
} from './contract-bundle.js';
import { DocumentProcessingRuntime } from '../runtime/document-processing-runtime.js';
import { CheckpointManager } from './checkpoint-manager.js';
import type { ProcessorExecutionContext } from './processor-execution-context.js';
import type { ChannelMatch, ChannelProcessor } from '../registry/types.js';

export type { ChannelMatch } from '../registry/types.js';

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
  handleHandlerError(
    scopePath: string,
    bundle: ContractBundle,
    error: unknown,
  ): Promise<void>;
  canonicalSignature(node: BlueNode | null): string | null;
  channelProcessorFor(blueId: string): ChannelProcessor<unknown> | null;
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
    event: ResolvedBlueNode,
  ): Promise<void> {
    if (this.deps.isScopeInactive(scopePath)) {
      return;
    }
    this.runtime.gasMeter().chargeChannelMatchAttempt();

    const checkpointEvent = event;
    const match = await this.deps.evaluateChannel(
      channel,
      bundle,
      scopePath,
      event,
    );
    if (!match.matches) {
      return;
    }

    if (match.deliveries && match.deliveries.length > 0) {
      await this.runDeliveries(scopePath, bundle, channel, event, match);
      return;
    }

    const eventForHandlers = match.eventNode ?? event;
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

    const shouldProcess = await this.shouldProcessRelativeToCheckpoint(
      scopePath,
      bundle,
      channel,
      checkpointEvent,
      checkpoint,
    );
    if (!shouldProcess) {
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

  private async runDeliveries(
    scopePath: string,
    bundle: ContractBundle,
    channel: ChannelBinding,
    checkpointEvent: BlueNode,
    match: ChannelMatch,
  ): Promise<void> {
    const deliveries = match.deliveries ?? [];
    if (deliveries.length === 0) {
      return;
    }
    this.checkpointManager.ensureCheckpointMarker(scopePath, bundle);
    const fallbackSignature = this.deps.canonicalSignature(checkpointEvent);

    for (const delivery of deliveries) {
      if (this.deps.isScopeInactive(scopePath)) {
        return;
      }
      const checkpointKey = delivery.checkpointKey ?? channel.key();
      const checkpoint = this.checkpointManager.findCheckpoint(
        bundle,
        checkpointKey,
      );
      const eventSignature = delivery.eventId ?? fallbackSignature;
      if (this.checkpointManager.isDuplicate(checkpoint, eventSignature)) {
        continue;
      }

      const shouldProcess =
        typeof delivery.shouldProcess === 'boolean'
          ? delivery.shouldProcess
          : await this.shouldProcessRelativeToCheckpoint(
              scopePath,
              bundle,
              channel,
              checkpointEvent,
              checkpoint,
            );
      if (!shouldProcess) {
        continue;
      }

      await this.runHandlers(
        scopePath,
        bundle,
        channel.key(),
        delivery.eventNode,
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
      try {
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
      } catch (error) {
        await this.deps.handleHandlerError(scopePath, bundle, error);
        return;
      }
    }
  }

  private async shouldProcessRelativeToCheckpoint(
    scopePath: string,
    bundle: ContractBundle,
    channel: ChannelBinding,
    event: BlueNode,
    checkpoint: ReturnType<CheckpointManager['findCheckpoint']>,
  ): Promise<boolean> {
    if (!checkpoint?.lastEventNode) {
      return true;
    }
    const processor = this.deps.channelProcessorFor(channel.blueId());
    if (!processor || typeof processor.isNewerEvent !== 'function') {
      return true;
    }
    const context = {
      scopePath,
      blue: this.runtime.blue(),
      event: event.clone(),
      markers: bundle.markers(),
      bindingKey: channel.key(),
    };
    return await processor.isNewerEvent(
      channel.contract() as unknown,
      context,
      checkpoint.lastEventNode.clone(),
    );
  }
}
