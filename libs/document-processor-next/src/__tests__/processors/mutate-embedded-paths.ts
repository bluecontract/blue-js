import type { HandlerProcessor } from '../../registry/types.js';
import { BlueNode } from '@blue-labs/language';
import {
  mutateEmbeddedPathsSchema,
  type MutateEmbeddedPaths,
} from '../models/index.js';

export class MutateEmbeddedPathsContractProcessor
  implements HandlerProcessor<MutateEmbeddedPaths>
{
  readonly kind = 'handler' as const;
  readonly blueIds = ['MutateEmbeddedPaths'] as const;
  readonly schema = mutateEmbeddedPathsSchema;

  execute(
    _contract: MutateEmbeddedPaths,
    context: Parameters<HandlerProcessor<MutateEmbeddedPaths>['execute']>[1],
  ): void {
    const embeddedListPointer = '/contracts/embedded/paths';
    context.applyPatch({
      op: 'REMOVE',
      path: context.resolvePointer(`${embeddedListPointer}/1`),
    });
    context.applyPatch({
      op: 'REPLACE',
      path: context.resolvePointer(`${embeddedListPointer}/0`),
      val: new BlueNode().setValue('/c'),
    });
    context.applyPatch({ op: 'REMOVE', path: context.resolvePointer('/b') });
  }
}
