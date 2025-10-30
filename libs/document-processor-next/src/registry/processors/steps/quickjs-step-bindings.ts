import type { QuickJSBindings } from '../../../util/expression/quickjs-evaluator.js';
import type { StepExecutionArgs } from '../sequential-workflow-processor.js';

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

      const snapshot = context.documentAt(absolutePointer);
      if (!snapshot) {
        return undefined;
      }

      return context.blue.nodeToJson(snapshot, 'original');
    },
  };
}
