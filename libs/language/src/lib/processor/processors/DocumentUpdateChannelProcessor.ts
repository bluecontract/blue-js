import { EventNode, DocumentNode, ProcessingContext } from '../types';
import { isNonNullable } from '@blue-company/shared-utils';
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
    contractName: string
  ): boolean {
    if (!this.baseSupports(event)) return false;

    const documentUpdateChannel = ctx
      .getBlue()
      .nodeToSchemaOutput(contractNode, DocumentUpdateChannelSchema);

    const payloadPath = event.payload.path;
    if (!payloadPath) return false;
    if (event.channelName === contractName) return false;

    const documentUpdatePath = documentUpdateChannel.path;

    return (
      isNonNullable(documentUpdatePath) &&
      payloadPath === ctx.resolvePath(documentUpdatePath)
    );
  }

  handle(
    event: EventNode,
    contractNode: DocumentNode,
    ctx: ProcessingContext,
    contractName: string
  ): void {
    const payload = event.payload;
    if (!payload) return;

    ctx.emitEvent({
      payload,
      channelName: contractName,
      source: 'channel',
    });
  }
}
