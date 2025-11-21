import type { HandlerProcessor } from '../../registry/types.js';
import { BlueNode } from '@blue-labs/language';
import {
  mutateEmbeddedPathsSchema,
  type MutateEmbeddedPaths,
} from '../models/index.js';

export class MutateEmbeddedPathsContractProcessor implements HandlerProcessor<MutateEmbeddedPaths> {
  readonly kind = 'handler' as const;
  readonly blueIds = ['MutateEmbeddedPaths'] as const;
  readonly schema = mutateEmbeddedPathsSchema;

  async execute(
    _contract: MutateEmbeddedPaths,
    context: Parameters<HandlerProcessor<MutateEmbeddedPaths>['execute']>[1],
  ): Promise<void> {
    const embeddedListPointer = '/contracts/embedded/paths';
    await context.applyPatch({
      op: 'REMOVE',
      path: context.resolvePointer(`${embeddedListPointer}/1`),
    });
    await context.applyPatch({
      op: 'REPLACE',
      path: context.resolvePointer(`${embeddedListPointer}/0`),
      val: new BlueNode().setValue('/c'),
    });
    await context.applyPatch({
      op: 'REMOVE',
      path: context.resolvePointer('/b'),
    });
  }
}
