import type { HandlerProcessor } from '../../registry/types.js';
import { BlueNode } from '@blue-labs/language';
import { cutOffProbeSchema, type CutOffProbe } from '../models/index.js';

function emitIfKind(
  context: Parameters<HandlerProcessor<CutOffProbe>['execute']>[1],
  kind?: string | null,
): void {
  if (!kind) return;
  const event = new BlueNode().setProperties({
    kind: new BlueNode().setValue(kind),
  });
  context.emitEvent(event);
}

export class CutOffProbeContractProcessor
  implements HandlerProcessor<CutOffProbe>
{
  readonly kind = 'handler' as const;
  readonly blueIds = ['CutOffProbe'] as const;
  readonly schema = cutOffProbeSchema;

  execute(
    contract: CutOffProbe,
    context: Parameters<HandlerProcessor<CutOffProbe>['execute']>[1],
  ): void {
    if (contract.emitBefore) {
      emitIfKind(context, contract.preEmitKind ?? null);
    }
    if (contract.patchPointer) {
      const pointer = context.resolvePointer(contract.patchPointer);
      const value = new BlueNode().setValue(contract.patchValue ?? 0);
      context.applyPatch({ op: 'ADD', path: pointer, val: value });
    }
    if (contract.emitAfter) {
      emitIfKind(context, contract.postEmitKind ?? null);
    }
    if (contract.postPatchPointer) {
      const pointer = context.resolvePointer(contract.postPatchPointer);
      const value = new BlueNode().setValue(contract.postPatchValue ?? 0);
      context.applyPatch({ op: 'ADD', path: pointer, val: value });
    }
  }
}
