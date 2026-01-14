import { BlueNode } from '@blue-labs/language';
import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';

import {
  compositeTimelineChannelSchema,
  type CompositeTimelineChannel,
  type ChannelContract,
  type ChannelEventCheckpoint,
  type MarkerContract,
} from '../../model/index.js';
import { KEY_CHECKPOINT } from '../../constants/processor-contract-constants.js';
import type {
  ChannelEvaluationContext,
  ChannelMatch,
  ChannelProcessor,
  ChannelDelivery,
} from '../types.js';

const SOURCE_CHANNEL_META_KEY = 'compositeSourceChannelKey';

/**
 * Compose a checkpoint key that namespaces a child channel under its composite.
 */
export function compositeCheckpointKey(
  compositeKey: string,
  childKey: string,
): string {
  return `${compositeKey}::${childKey}`;
}

function isChannelEventCheckpoint(
  marker: MarkerContract | undefined,
): marker is ChannelEventCheckpoint {
  return (
    marker != null &&
    Object.prototype.hasOwnProperty.call(marker, 'lastEvents') &&
    Object.prototype.hasOwnProperty.call(marker, 'lastSignatures')
  );
}

export class CompositeTimelineChannelProcessor implements ChannelProcessor<CompositeTimelineChannel> {
  readonly kind = 'channel' as const;
  readonly blueIds = [
    conversationBlueIds['Conversation/Composite Timeline Channel'],
  ] as const;
  readonly schema = compositeTimelineChannelSchema;

  /**
   * Fallback match hook that delegates to {@link evaluate} for consistent behavior.
   */
  matches(
    contract: CompositeTimelineChannel,
    context: ChannelEvaluationContext,
  ): boolean | Promise<boolean> {
    return this.evaluate(contract, context).then((result) => result.matches);
  }

  /**
   * Resolve child channels and return a delivery per matching child, enriching
   * each delivered event with the source channel key.
   */
  async evaluate(
    contract: CompositeTimelineChannel,
    context: ChannelEvaluationContext,
  ): Promise<ChannelMatch> {
    const event = context.event;
    if (!event) {
      return { matches: false };
    }

    const childKeys =
      contract.channels?.filter((key) => key.trim().length > 0) ?? [];
    if (childKeys.length === 0) {
      return { matches: false };
    }

    const resolveChannel = context.resolveChannel;
    const channelProcessorFor = context.channelProcessorFor;
    if (!resolveChannel || !channelProcessorFor) {
      throw new Error(
        'Composite timeline channel evaluation requires channel resolution helpers',
      );
    }

    const eventId = context.blue.calculateBlueIdSync(event);
    const deliveries: ChannelDelivery[] = [];

    for (const childKey of childKeys) {
      const resolved = resolveChannel(childKey);
      if (!resolved) {
        throw new Error(
          `Composite timeline channel '${context.bindingKey}' references missing channel '${childKey}'`,
        );
      }

      const childProcessor = channelProcessorFor(resolved.blueId);
      if (!childProcessor) {
        throw new Error(
          `No processor registered for child channel '${childKey}' (${resolved.blueId})`,
        );
      }

      const eventClone = event.clone();
      const childContext: ChannelEvaluationContext = {
        ...context,
        event: eventClone,
        bindingKey: childKey,
      };

      const childContract = resolved.contract;
      const eventFilter = childContract.event;
      if (eventFilter && !context.blue.isTypeOfNode(eventClone, eventFilter)) {
        continue;
      }

      const matches = await childProcessor.matches(childContract, childContext);
      if (!matches) {
        continue;
      }

      const channelizedFn = childProcessor.channelize;
      const channelizedResult = channelizedFn
        ? channelizedFn.call(childProcessor, childContract, childContext)
        : undefined;

      const eventForHandlers = channelizedResult ?? eventClone.clone();
      this.enrichEvent(eventForHandlers, childKey);

      const checkpointKey = compositeCheckpointKey(
        context.bindingKey,
        childKey,
      );
      const shouldProcess = await this.shouldProcessChild({
        childProcessor,
        childContract,
        context: {
          ...childContext,
          event: event.clone(),
        },
        checkpointKey,
        markers: context.markers,
      });

      deliveries.push({
        eventNode: eventForHandlers,
        eventId,
        checkpointKey,
        shouldProcess,
      });
    }

    return {
      matches: deliveries.length > 0,
      deliveries,
    };
  }

  /**
   * Determine recency by checking whether any child delivery should process.
   */
  async isNewerEvent(
    contract: CompositeTimelineChannel,
    context: ChannelEvaluationContext,
    lastEvent: BlueNode,
  ): Promise<boolean> {
    void lastEvent;
    const result = await this.evaluate(contract, context);
    const deliveries = result.deliveries ?? [];
    if (!result.matches || deliveries.length === 0) {
      return false;
    }
    return deliveries.some((delivery) => delivery.shouldProcess !== false);
  }

  /**
   * Attach the source child channel key to event metadata for handler logic.
   */
  private enrichEvent(event: BlueNode, childKey: string): void {
    const props = event.getProperties() ?? {};
    const meta =
      props.meta instanceof BlueNode ? props.meta.clone() : new BlueNode();
    const metaProps = meta.getProperties() ?? {};
    meta.setProperties({
      ...metaProps,
      [SOURCE_CHANNEL_META_KEY]: new BlueNode().setValue(childKey),
    });
    event.setProperties({ ...props, meta });
  }

  /**
   * Apply child-level recency rules using the composite-scoped checkpoint entry.
   */
  private async shouldProcessChild(args: {
    childProcessor: ChannelProcessor<unknown>;
    childContract: ChannelContract;
    context: ChannelEvaluationContext;
    checkpointKey: string;
    markers: ReadonlyMap<string, MarkerContract>;
  }): Promise<boolean> {
    const isNewerEvent = args.childProcessor.isNewerEvent;
    if (typeof isNewerEvent !== 'function') {
      return true;
    }

    const checkpoint = this.resolveCheckpoint(args.markers);
    const lastEvent = checkpoint?.lastEvents?.[args.checkpointKey] ?? null;
    if (!lastEvent || typeof lastEvent.clone !== 'function') {
      return true;
    }

    return await isNewerEvent.call(
      args.childProcessor,
      args.childContract,
      args.context,
      lastEvent.clone(),
    );
  }

  /**
   * Resolve the checkpoint marker for the current scope, if present.
   */
  private resolveCheckpoint(
    markers: ReadonlyMap<string, MarkerContract>,
  ): ChannelEventCheckpoint | null {
    const marker = markers.get(KEY_CHECKPOINT);
    if (!isChannelEventCheckpoint(marker)) {
      return null;
    }
    return marker;
  }
}
