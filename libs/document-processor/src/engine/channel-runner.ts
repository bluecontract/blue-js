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
import type {
  CheckpointIdentityMode,
  CheckpointIdentityResult,
} from './checkpoint-identity-service.js';

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
  checkpointIdentity(
    node: BlueNode | null,
    mode?: CheckpointIdentityMode,
    channelDefinedSubject?: BlueNode | null,
  ): CheckpointIdentityResult;
  channelProcessorFor(node: BlueNode): ChannelProcessor<unknown> | null;
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
  ): Promise<boolean> {
    if (this.deps.isScopeInactive(scopePath)) {
      return false;
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
      return false;
    }

    if (match.deliveries && match.deliveries.length > 0) {
      await this.runDeliveries(scopePath, bundle, channel, event, match);
      return true;
    }

    const eventForHandlers = match.eventNode ?? event;
    this.checkpointManager.ensureCheckpointMarker(scopePath, bundle);
    const checkpoint = this.checkpointManager.findCheckpoint(
      bundle,
      channel.key(),
    );
    const identity = this.checkpointIdentity(checkpointEvent, match);
    const eventSignature = identity.identity;
    if (this.isDuplicate(checkpoint, eventSignature, match)) {
      return true;
    }

    const shouldProcess = await this.shouldProcessRelativeToCheckpoint(
      scopePath,
      bundle,
      channel,
      checkpointEvent,
      checkpoint,
    );
    if (!shouldProcess) {
      return true;
    }

    await this.runHandlers(
      scopePath,
      bundle,
      channel.key(),
      eventForHandlers,
      false,
    );
    if (this.deps.isScopeInactive(scopePath)) {
      return true;
    }

    this.checkpointManager.persist(
      scopePath,
      bundle,
      checkpoint,
      eventSignature ?? null,
      identity.subject,
    );
    return true;
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
    let fallbackIdentity: CheckpointIdentityResult | undefined;

    for (const delivery of deliveries) {
      if (this.deps.isScopeInactive(scopePath)) {
        return;
      }
      const checkpointKey = delivery.checkpointKey ?? channel.key();
      const checkpoint = this.checkpointManager.findCheckpoint(
        bundle,
        checkpointKey,
      );
      const identity = this.checkpointIdentity(
        checkpointEvent,
        delivery,
        fallbackIdentity,
      );
      if (this.canReuseContentIdentity(delivery) && fallbackIdentity == null) {
        fallbackIdentity = identity;
      }
      const eventSignature = identity.identity;
      if (this.isDuplicate(checkpoint, eventSignature, delivery)) {
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
        identity.subject,
      );
    }
  }

  private checkpointIdentity(
    checkpointEvent: BlueNode,
    match:
      | Pick<
          ChannelMatch,
          'checkpointIdentity' | 'eventId' | 'checkpointIdentityMode'
        >
      | {
          readonly checkpointIdentity?: string | null;
          readonly eventId?: string | null;
          readonly checkpointIdentityMode?: CheckpointIdentityMode | null;
        },
    fallback?: CheckpointIdentityResult,
  ): CheckpointIdentityResult {
    const mode = match.checkpointIdentityMode ?? 'contentBlueId';
    if (mode === 'precomputed') {
      if (match.checkpointIdentity == null) {
        throw new Error(
          'precomputed checkpoint identity mode requires checkpointIdentity',
        );
      }
      return {
        identity: match.checkpointIdentity,
        subject: checkpointEvent.clone(),
      };
    }
    if (mode === 'eventId' && match.eventId != null) {
      return {
        identity: match.eventId,
        subject: checkpointEvent.clone(),
      };
    }
    if (mode === 'contentBlueId' && fallback) {
      return fallback;
    }
    return this.deps.checkpointIdentity(checkpointEvent, mode);
  }

  private isDuplicate(
    checkpoint: ReturnType<CheckpointManager['findCheckpoint']>,
    eventSignature: string | null | undefined,
    match: {
      readonly checkpointIdentity?: string | null;
      readonly eventId?: string | null;
      readonly checkpointIdentityMode?: CheckpointIdentityMode | null;
    },
  ): boolean {
    if (checkpoint == null || eventSignature == null) {
      return false;
    }
    const mode = match.checkpointIdentityMode ?? 'contentBlueId';
    if (mode !== 'eventId' && mode !== 'nodeBlueId') {
      return this.checkpointManager.isDuplicate(checkpoint, eventSignature);
    }
    const stored = checkpoint.lastEventNode;
    if (!stored) {
      return false;
    }
    try {
      return (
        this.deps.checkpointIdentity(stored, mode).identity === eventSignature
      );
    } catch {
      return false;
    }
  }

  private canReuseContentIdentity(match: {
    readonly checkpointIdentity?: string | null;
    readonly eventId?: string | null;
    readonly checkpointIdentityMode?: CheckpointIdentityMode | null;
  }): boolean {
    return (
      match.checkpointIdentity == null &&
      match.eventId == null &&
      (match.checkpointIdentityMode == null ||
        match.checkpointIdentityMode === 'contentBlueId')
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
    const processor = this.deps.channelProcessorFor(channel.node());
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
