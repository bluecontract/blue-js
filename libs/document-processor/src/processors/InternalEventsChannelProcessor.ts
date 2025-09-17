import { DocumentNode, EventNode, ProcessingContext } from '../types';
import { BaseChannelProcessor } from './BaseChannelProcessor';
import { blueIds } from '@blue-repository/core-dev';

export abstract class InternalOnlyChannelProcessor extends BaseChannelProcessor {
  supports(
    event: EventNode,
    contractNode: DocumentNode,
    ctx: ProcessingContext
  ): boolean {
    if (!this.baseSupports(event)) return false;
    if (event.source !== 'internal') return false;
    return this.matches(event, contractNode, ctx);
  }

  // Default implementation: match all internal events
  // Subclasses can override for specific filtering logic
  protected matches(
    event: EventNode,
    contractNode: DocumentNode,
    ctx: ProcessingContext
  ): boolean {
    void event;
    void contractNode;
    void ctx;
    return true;
  }

  handle(
    event: EventNode,
    _contractNode: DocumentNode,
    ctx: ProcessingContext,
    contractName: string
  ): void {
    const payload = event.payload;
    if (!payload) return;

    ctx.emitEvent({
      payload: event.payload,
      channelName: contractName,
      source: 'channel',
    });
  }
}

export class InternalEventsChannelProcessor extends InternalOnlyChannelProcessor {
  readonly contractType = 'Internal Events Channel';
  readonly contractBlueId = blueIds['Internal Events Channel'];
}
