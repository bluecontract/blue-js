import { EventNode, DocumentNode, ProcessingContext } from '../types';
import { isNonNullable } from '@blue-labs/shared-utils';
import { InternalOnlyChannelProcessor } from './InternalEventsChannelProcessor';
import {
  blueIds,
  DocumentUpdateChannelSchema,
} from '@blue-repository/core-dev';

/* ------------------------------------------------------------------------ */
/* Document Update Channel – unwraps document updates                     */
/* ------------------------------------------------------------------------ */
export class DocumentUpdateChannelProcessor extends InternalOnlyChannelProcessor {
  readonly contractType = 'Document Update Channel';
  readonly contractBlueId = blueIds['Document Update Channel'];

  protected override matches(
    event: EventNode,
    contractNode: DocumentNode,
    ctx: ProcessingContext
  ): boolean {
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
}
