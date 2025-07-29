// ────────────────────────────────
// FILE: src/processors/ChannelEventCheckpointProcessor.ts
// ────────────────────────────────
import { ResolvedBlueNode } from '@blue-labs/language';
import {
  ContractProcessor,
  DocumentNode,
  EventNode,
  ProcessingContext,
} from '../types';
import { CheckpointCache } from '../utils/CheckpointCache';
import { blueIds } from '@blue-repository/core-dev';

/* ------------------------------------------------------------------------ */
/* Channel Event Checkpoint – records the last processed event per channel  */
/* ------------------------------------------------------------------------ */
export class ChannelEventCheckpointProcessor implements ContractProcessor {
  readonly contractType = 'Channel Event Checkpoint';
  readonly contractBlueId = blueIds['Channel Event Checkpoint'];
  readonly role = 'handler';

  constructor(private readonly cache: CheckpointCache) {}

  supports(evt: EventNode): boolean {
    return (
      evt.source === 'channel' &&
      evt.rootEvent?.payload === evt.payload &&
      evt.rootEvent?.source === 'external'
    );
  }

  private async getEventBlueId(event: EventNode, ctx: ProcessingContext) {
    const eventPayload = event.rootEvent?.payload;
    if (!eventPayload) {
      throw new Error(
        'Cannot calculate blueId for checkpoint: missing root event payload'
      );
    }

    if (eventPayload instanceof ResolvedBlueNode) {
      const minimalNode = eventPayload.getMinimalNode();
      return await ctx.getBlue().calculateBlueId(minimalNode);
    }

    return await ctx.getBlue().calculateBlueId(eventPayload);
  }

  async handle(event: EventNode, node: DocumentNode, ctx: ProcessingContext) {
    if (!event.channelName || !event.rootEvent?.seq) return;

    const blueId = await this.getEventBlueId(event, ctx);

    const docBase = ctx.getNodePath().replace(/\/contracts\/checkpoint$/, '');
    this.cache.record(docBase, event, blueId);
  }
}
