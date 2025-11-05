import type { QuickJSBindings } from '../../../util/expression/quickjs-evaluator.js';
import type { StepExecutionArgs } from '../workflow/step-runner.js';
import { normalizePointer } from '../../../util/pointer-utils.js';

export function createQuickJSStepBindings(
  args: StepExecutionArgs,
): QuickJSBindings {
  const { context, eventNode, stepResults } = args;
  return {
    event: context.blue.nodeToJson(eventNode, 'original'),
    steps: stepResults,
    document: (pointer?: unknown) => {
      const resolvedPointer =
        pointer == null
          ? '/'
          : typeof pointer === 'string'
            ? pointer
            : (() => {
                throw new TypeError('document() expects a string pointer');
              })();

      const absolutePointer = resolvedPointer.startsWith('/')
        ? resolvedPointer
        : context.resolvePointer(resolvedPointer);

      const normalizedPointer = normalizePointer(absolutePointer);
      const snapshot = context.documentAt(normalizedPointer);
      context.gasMeter().chargeDocumentSnapshot(normalizedPointer, snapshot);
      if (!snapshot) {
        return undefined;
      }

      return context.blue.nodeToJson(snapshot, 'original');
    },
  };
}
