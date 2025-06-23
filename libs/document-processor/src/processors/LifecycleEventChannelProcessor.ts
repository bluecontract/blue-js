import { EventNode, DocumentNode, ProcessingContext } from '../types';
import { BaseChannelProcessor } from './BaseChannelProcessor';
import { deepContains } from '@blue-labs/shared-utils';
import { blueIds } from '@blue-repository/core-dev';

/**
 * Set of supported lifecycle event types
 */
const LIFECYCLE_EVENT_TYPES = new Set([
  'Document Processing Initiated',
  // Add more lifecycle events here as needed
  // 'Document Processing Completed',
  // 'Document Processing Failed',
]);

/**
 * Lifecycle Event Channel Processor
 *
 * Processes lifecycle events that occur during document processing.
 * This processor filters events based on:
 * - Event type matching one of the supported lifecycle event types
 * - Optional event pattern matching (if specified in the channel configuration)
 *
 * @example
 * ```yaml
 * lifecycleChannel:
 *   type: Lifecycle Event Channel
 *   event:
 *     type: Document Processing Initiated
 * ```
 */
export class LifecycleEventChannelProcessor extends BaseChannelProcessor {
  readonly contractType = 'Lifecycle Event Channel';
  readonly contractBlueId = blueIds['Lifecycle Event Channel'];

  supports(
    event: EventNode,
    node: DocumentNode,
    ctx: ProcessingContext
  ): boolean {
    if (!this.baseSupports(event)) return false;

    // Check if this is a lifecycle event
    if (!this.isLifecycleEvent(event)) return false;

    // Check if the event matches the channel's event pattern (if specified)
    return this.isEventPatternMatch(event, node, ctx);
  }

  handle(
    event: EventNode,
    node: DocumentNode,
    ctx: ProcessingContext,
    path: string
  ): void {
    ctx.emitEvent({
      payload: event.payload,
      channelName: path,
      source: 'channel',
    });
  }

  /**
   * Checks if the event is a supported lifecycle event type
   */
  private isLifecycleEvent(event: EventNode): boolean {
    return LIFECYCLE_EVENT_TYPES.has(event.payload.type as string);
  }

  /**
   * Checks if the event matches the channel's event pattern (if specified)
   */
  private isEventPatternMatch(
    event: EventNode,
    node: DocumentNode,
    ctx: ProcessingContext
  ): boolean {
    const channelEvent = node.getProperties()?.['event'];

    // If no event pattern is specified in channel, match all lifecycle events
    if (!channelEvent) {
      return true;
    }

    try {
      const blue = ctx.getBlue();
      const eventPayloadJson = blue.nodeToJson(
        blue.jsonValueToNode(event.payload)
      );
      const channelEventJson = blue.nodeToJson(channelEvent);

      // Simple containment check - channel event pattern should be contained in the actual event
      return deepContains(eventPayloadJson, channelEventJson);
    } catch (error) {
      console.warn('Error during lifecycle event pattern matching:', error);
      return false;
    }
  }
}
