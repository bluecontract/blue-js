import { EventNode, DocumentNode, ProcessingContext } from '../types';
import { isNonNullable } from '../utils/typeGuard';
import { BaseChannelProcessor } from './BaseChannelProcessor';
import {
  blueIds,
  MyOSAgentEventSchema,
  MyOSAgentChannelSchema,
  MyOSAgentEvent,
  MyOSAgentChannel,
} from '../../../repo/myos';
import { deepContains } from '@blue-labs/shared-utils';

/* ------------------------------------------------------------------------ */
/* MyOS Agent Channel – processes MyOS Agent Events                        */
/* ------------------------------------------------------------------------ */
/**
 * Processes MyOS Agent Events by matching them against MyOS Agent Channel configurations.
 *
 * This processor:
 * - Filters events by agent ID matching
 * - Optionally filters by event pattern using deep containment matching
 * - Emits matched events as channel events
 *
 * @example
 * ```typescript
 * // Channel configuration
 * {
 *   type: 'MyOS Agent Channel',
 *   agent: { agentId: 'agent-123' },
 *   event: { type: 'UserAction', payload: { action: 'click' } }
 * }
 *
 * // Matching event
 * {
 *   type: 'MyOS Agent Event',
 *   agentId: 'agent-123',
 *   event: { type: 'UserAction', payload: { action: 'click', target: 'button' } }
 * }
 * ```
 */
export class MyOSAgentChannelProcessor extends BaseChannelProcessor {
  readonly contractType = 'MyOS Agent Channel';
  readonly contractBlueId = blueIds['MyOS Agent Channel'];

  supports(
    event: EventNode,
    node: DocumentNode,
    ctx: ProcessingContext
  ): boolean {
    if (!this.baseSupports(event)) return false;

    try {
      const { myosAgentEvent, myosAgentChannel } = this.parseEventAndChannel(
        event,
        node,
        ctx
      );

      return (
        this.isAgentMatch(myosAgentEvent, myosAgentChannel) &&
        this.isEventPatternMatch(myosAgentEvent, myosAgentChannel, ctx)
      );
    } catch (error) {
      // Log error in production, but don't throw to avoid breaking the processing pipeline
      console.warn('Error in MyOSAgentChannelProcessor.supports:', error);
      return false;
    }
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
   * Parses and validates the event payload and channel configuration
   * @throws {Error} If schema validation fails
   */
  private parseEventAndChannel(
    event: EventNode,
    node: DocumentNode,
    ctx: ProcessingContext
  ) {
    const blue = ctx.getBlue();

    const eventPayloadNode = blue.jsonValueToNode(event.payload);
    const myosAgentEvent = blue.nodeToSchemaOutput(
      eventPayloadNode,
      MyOSAgentEventSchema
    );

    const myosAgentChannel = blue.nodeToSchemaOutput(
      node,
      MyOSAgentChannelSchema
    );

    return { myosAgentEvent, myosAgentChannel };
  }

  /**
   * Checks if the agent IDs match between event and channel
   * @param myosAgentEvent - The parsed agent event
   * @param myosAgentChannel - The parsed agent channel configuration
   * @returns true if both have valid agent IDs and they match
   */
  private isAgentMatch(
    myosAgentEvent: MyOSAgentEvent,
    myosAgentChannel: MyOSAgentChannel
  ): boolean {
    const eventAgentId = myosAgentEvent.agentId;
    const channelAgentId = myosAgentChannel.agent?.agentId;

    return (
      isNonNullable(eventAgentId) &&
      isNonNullable(channelAgentId) &&
      eventAgentId === channelAgentId
    );
  }

  /**
   * Checks if the event pattern matches the channel's event filter
   *
   * @param myosAgentEvent - The parsed agent event
   * @param myosAgentChannel - The parsed agent channel configuration
   * @param ctx - Processing context for Blue instance access
   * @returns true if the event matches the channel's filter criteria
   *
   * **Matching Logic:**
   * - If no event pattern is specified in channel → matches all events
   * - If channel has event pattern but incoming event has no event data → no match
   * - Otherwise → uses deep containment matching (event must contain all channel pattern fields)
   */
  private isEventPatternMatch(
    myosAgentEvent: MyOSAgentEvent,
    myosAgentChannel: MyOSAgentChannel,
    ctx: ProcessingContext
  ): boolean {
    const channelEvent = myosAgentChannel.event;

    // If no event pattern is specified in channel, match all events
    if (!channelEvent) {
      return true;
    }

    const eventData = myosAgentEvent.event;

    // If channel has event pattern but incoming event has no event data, no match
    if (!eventData) {
      return false;
    }

    try {
      const blue = ctx.getBlue();
      const eventPayloadJson = blue.nodeToJson(eventData);
      const channelEventJson = blue.nodeToJson(channelEvent);

      return deepContains(eventPayloadJson, channelEventJson);
    } catch (error) {
      console.warn('Error during event pattern matching:', error);
      return false;
    }
  }
}
