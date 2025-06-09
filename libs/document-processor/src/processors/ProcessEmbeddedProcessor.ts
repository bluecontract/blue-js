import { blueIds, ProcessEmbeddedSchema } from '../repo/core';
import {
  ContractProcessor,
  DocumentNode,
  EventNode,
  ProcessingContext,
} from '../types';

export class ProcessEmbeddedProcessor implements ContractProcessor {
  readonly contractType = 'Process Embedded';
  readonly role = 'adapter';
  readonly contractBlueId = blueIds['Process Embedded'];

  supports(evt: EventNode): boolean {
    return evt.source !== 'channel';
  }

  handle(evt: EventNode, node: DocumentNode, ctx: ProcessingContext): void {
    const processEmbedded = ctx
      .getBlue()
      .nodeToSchemaOutput(node, ProcessEmbeddedSchema);

    for (const rel of processEmbedded.paths ?? []) {
      ctx.emitEvent({
        ...evt,
        dispatchPath: ctx.resolvePath(rel),
      });
    }
  }

  init() {
    return [];
  }
}
