import { EventNode, DocumentNode, ProcessingContext } from '../types';
import { isNonNullable } from '../utils/typeGuard';
import { BaseChannelProcessor } from './BaseChannelProcessor';
import {
  blueIds,
  MyOSAgentEventSchema,
  MyOSAgentChannelSchema,
} from '../../../repo/myos';

/* ------------------------------------------------------------------------ */
/* MyOS Agent Channel – processes MyOS Agent Events                        */
/* ------------------------------------------------------------------------ */
export class MyOSAgentChannelProcessor extends BaseChannelProcessor {
  readonly contractType = 'MyOS Agent Channel';
  readonly contractBlueId = blueIds['MyOS Agent Channel'];

  supports(
    event: EventNode,
    node: DocumentNode,
    ctx: ProcessingContext
  ): boolean {
    if (!this.baseSupports(event)) return false;

    const blue = ctx.getBlue();

    const eventPayloadNode = blue.jsonValueToNode(event.payload);
    const myosAgentEvent = blue.nodeToSchemaOutput(
      eventPayloadNode,
      MyOSAgentEventSchema
    );
    const myosAgentChannel = ctx
      .getBlue()
      .nodeToSchemaOutput(node, MyOSAgentChannelSchema);

    const hasAgent =
      isNonNullable(myosAgentChannel.agent?.agentId) &&
      isNonNullable(myosAgentEvent.agentId);

    return (
      hasAgent && myosAgentEvent.agentId === myosAgentChannel.agent?.agentId
    );
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
}
