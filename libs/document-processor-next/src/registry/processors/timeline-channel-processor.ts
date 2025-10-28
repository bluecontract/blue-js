import type { ChannelEvaluationContext, ChannelProcessor } from '../types.js';
import { BlueNode } from '@blue-labs/language';
import { TimelineEntrySchema, blueIds } from '@blue-repository/conversation';

import {
  timelineChannelSchema,
  type TimelineChannel,
} from '../../model/index.js';

export class TimelineChannelProcessor
  implements ChannelProcessor<TimelineChannel>
{
  readonly kind = 'channel' as const;
  readonly blueIds = [blueIds['Timeline Channel']] as const;
  readonly schema = timelineChannelSchema;

  matches(
    contract: TimelineChannel,
    context: ChannelEvaluationContext
  ): boolean {
    const { event, blue } = context;
    if (!event || !blue.isTypeOf(event, TimelineEntrySchema)) {
      return false;
    }

    const entry = blue.nodeToSchemaOutput(event, TimelineEntrySchema);
    const entryTimelineId = entry.timeline?.timelineId;
    if (!entryTimelineId || !contract.timelineId) {
      return false;
    }
    if (entryTimelineId !== contract.timelineId) {
      return false;
    }

    return true;
  }

  channelize(
    contract: TimelineChannel,
    context: ChannelEvaluationContext
  ): BlueNode | null | undefined {
    const { event, blue } = context;
    if (!event || !blue.isTypeOf(event, TimelineEntrySchema)) {
      return null;
    }
    const entry = blue.nodeToSchemaOutput(event, TimelineEntrySchema);
    const messageNode = entry.message as BlueNode | undefined;
    if (!messageNode) return null;
    const metadataNode = this.buildMetadataNode(event);
    const channelKey = contract.key ?? undefined;
    return this.buildNormalizedEvent(messageNode, metadataNode, channelKey);
  }

  eventId(
    _contract: TimelineChannel,
    context: ChannelEvaluationContext
  ): string | null | undefined {
    const node = context.event;
    const id = node?.getBlueId?.();
    if (typeof id === 'string' && id.length > 0) {
      return id;
    }
    return undefined;
  }

  private buildNormalizedEvent(
    message: BlueNode,
    metadata: BlueNode | null,
    channelKey?: string
  ): BlueNode {
    const normalized = message.clone();
    const props = normalized.getProperties() ?? {};
    const metaWithChannel = metadata
      ? (() => {
          const metaProps = { ...(metadata.getProperties() ?? {}) } as Record<
            string,
            BlueNode
          >;
          if (channelKey && !metaProps.channelKey) {
            metaProps.channelKey = new BlueNode().setValue(channelKey);
          }
          const node = new BlueNode();
          node.setProperties(metaProps);
          return node;
        })()
      : null;
    if (metaWithChannel) {
      normalized.setProperties({ ...props, timelineEntry: metaWithChannel });
    } else if (Object.keys(props).length > 0) {
      normalized.setProperties({ ...props });
    }
    return normalized;
  }

  private buildMetadataNode(entryNode: BlueNode): BlueNode | null {
    const props = entryNode.getProperties();
    if (!props) {
      return null;
    }

    const metadataProps: Record<string, BlueNode> = {};
    const maybeClone = (key: string): void => {
      const candidate = props[key];
      if (candidate) {
        metadataProps[key] = candidate.clone();
      }
    };

    maybeClone('actor');
    maybeClone('timeline');
    maybeClone('timestamp');
    maybeClone('prevEntry');
    maybeClone('name');
    maybeClone('description');

    const entryBlueId = entryNode.getBlueId?.();
    if (entryBlueId) {
      metadataProps.entryBlueId = new BlueNode().setValue(entryBlueId);
    }

    if (Object.keys(metadataProps).length === 0) {
      return null;
    }

    return new BlueNode().setProperties(metadataProps);
  }
}
