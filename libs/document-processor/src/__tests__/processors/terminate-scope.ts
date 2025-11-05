import type { HandlerProcessor } from '../../registry/types.js';
import { BlueNode } from '@blue-labs/language';
import { terminateScopeSchema, type TerminateScope } from '../models/index.js';

export class TerminateScopeContractProcessor
  implements HandlerProcessor<TerminateScope>
{
  readonly kind = 'handler' as const;
  readonly blueIds = ['TerminateScope'] as const;
  readonly schema = terminateScopeSchema;

  async execute(
    contract: TerminateScope,
    context: Parameters<HandlerProcessor<TerminateScope>['execute']>[1],
  ): Promise<void> {
    const mode = (contract.mode ?? 'graceful').toLowerCase();
    const reason = contract.reason ?? null;
    if (mode === 'fatal') {
      await context.terminateFatally(reason);
    } else {
      await context.terminateGracefully(reason);
    }
    if (contract.emitAfter) {
      const event = new BlueNode().setProperties({
        type: new BlueNode().setValue('ShouldNotEmit'),
      });
      context.emitEvent(event);
    }
    if (contract.patchAfter) {
      const pointer = context.resolvePointer('/afterTermination');
      await context.applyPatch({
        op: 'ADD',
        path: pointer,
        val: new BlueNode().setValue('should-not-exist'),
      });
    }
  }
}
