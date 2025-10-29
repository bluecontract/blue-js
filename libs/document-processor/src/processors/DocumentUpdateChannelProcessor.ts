import { EventNode, DocumentNode, ProcessingContext } from '../types';
import { isNonNullable } from '@blue-labs/shared-utils';
import { BaseChannelProcessor } from './BaseChannelProcessor';
import {
  blueIds,
  DocumentUpdateChannelSchema,
} from '@blue-repository/core-dev';

/* ------------------------------------------------------------------------ */
/* Document Update Channel – unwraps document updates                     */
/* ------------------------------------------------------------------------ */
export class DocumentUpdateChannelProcessor extends BaseChannelProcessor {
  readonly contractType = 'Document Update Channel';
  readonly contractBlueId = blueIds['Document Update Channel'];

  supports(
    event: EventNode,
    contractNode: DocumentNode,
    ctx: ProcessingContext,
  ): boolean {
    if (!this.baseSupports(event)) return false;
    if (event.emissionType !== 'update') return false;
    const documentUpdateChannel = ctx
      .getBlue()
      .nodeToSchemaOutput(contractNode, DocumentUpdateChannelSchema);

    const payloadPath = event.payload.get('/path');
    if (!payloadPath) return false;

    const documentUpdatePath = documentUpdateChannel.path;

    return (
      isNonNullable(documentUpdatePath) &&
      payloadPath === ctx.resolvePath(documentUpdatePath)
    );
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

// preserve re-emission behavior marker removed (not needed)
