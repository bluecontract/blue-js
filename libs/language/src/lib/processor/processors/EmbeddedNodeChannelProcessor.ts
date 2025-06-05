/* ------------------------------------------------------------------------ */
/* Embedded DocumentNode Channel – surfaces child events as a channel               */

import { blueIds, EmbeddedNodeChannelSchema } from '@blue-repository/core-dev';
import { EventNode, DocumentNode, ProcessingContext } from '../types';
import { isNonNullable } from '../utils/typeGuard';
import { BaseChannelProcessor } from './BaseChannelProcessor';

/* ------------------------------------------------------------------------ */
export class EmbeddedNodeChannelProcessor extends BaseChannelProcessor {
  readonly contractType = 'Embedded Node Channel';
  readonly contractBlueId = blueIds['Embedded Node Channel'];

  supports(
    event: EventNode,
    node: DocumentNode,
    ctx: ProcessingContext
  ): boolean {
    if (!this.baseSupports(event)) return false;
    const embeddedNodeChannel = ctx
      .getBlue()
      .nodeToSchemaOutput(node, EmbeddedNodeChannelSchema);

    return (
      isNonNullable(event.originNodePath) &&
      isNonNullable(embeddedNodeChannel.path) &&
      event.originNodePath === ctx.resolvePath(embeddedNodeChannel.path)
    );
  }

  handle(
    event: EventNode,
    node: DocumentNode,
    ctx: ProcessingContext,
    path: string
  ): void {
    const embeddedNodeChannel = ctx
      .getBlue()
      .nodeToSchemaOutput(node, EmbeddedNodeChannelSchema);

    const { originNodePath, payload } = event;

    if (
      isNonNullable(embeddedNodeChannel.path) &&
      originNodePath === ctx.resolvePath(embeddedNodeChannel.path)
    ) {
      ctx.emitEvent({
        payload,
        channelName: path,
        source: 'channel',
      });
    }
  }
}
