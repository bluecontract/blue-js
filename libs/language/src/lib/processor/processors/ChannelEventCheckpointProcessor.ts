// ────────────────────────────────
// FILE: src/processors/ChannelEventCheckpointProcessor.ts
// ────────────────────────────────
import {
  ContractProcessor,
  DocumentNode,
  EventNode,
  ProcessingContext,
} from '../types';
import { CheckpointCache } from '../utils/CheckpointCache';
import { blueIds } from '../../../repo/core';
import { JsonBlueValue } from 'src/schema/jsonBlue';

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

  async handle(event: EventNode, node: DocumentNode, ctx: ProcessingContext) {
    if (!event.channelName || !event.rootEvent?.seq) return;

    const blueId = await ctx
      .getBlue()
      .calculateBlueId(event.rootEvent.payload as JsonBlueValue);

    const docBase = ctx.getNodePath().replace(/\/contracts\/checkpoint$/, '');

    this.cache.record(docBase, event, blueId);
  }

  init(): EventNode[] {
    return [];
  }
}
