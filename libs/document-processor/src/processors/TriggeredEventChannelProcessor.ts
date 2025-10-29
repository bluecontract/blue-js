import { EventNode, DocumentNode, ProcessingContext } from '../types';
import { BaseChannelProcessor } from './BaseChannelProcessor';
import { blueIds } from '@blue-repository/core-dev';

/**
 * Triggered Event Channel – handles only events emitted by Trigger/JS steps
 */
export class TriggeredEventChannelProcessor extends BaseChannelProcessor {
  readonly contractType = 'Triggered Event Channel';
  readonly contractBlueId = blueIds['Triggered Event Channel'];

  supports(event: EventNode): boolean {
    if (!this.baseSupports(event)) return false;
    return event.emissionType === 'triggered';
  }

  handle(
    event: EventNode,
    _node: DocumentNode,
    ctx: ProcessingContext,
    path: string,
  ): void {
    ctx.emitEvent({
      payload: event.payload,
      channelName: path,
      source: 'channel',
    });
  }
}
