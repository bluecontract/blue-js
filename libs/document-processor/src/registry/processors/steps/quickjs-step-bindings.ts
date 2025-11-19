import type { QuickJSBindings } from '../../../util/expression/quickjs-evaluator.js';
import type { StepExecutionArgs } from '../workflow/step-runner.js';
import { normalizePointer } from '../../../util/pointer-utils.js';
import type { Blue } from '@blue-labs/language';

interface DocumentBinding {
  (pointer?: unknown): unknown;
  canonical(pointer?: unknown): unknown;
}

type JsonStrategy = Exclude<
  NonNullable<Parameters<Blue['nodeToJson']>[1]>,
  'original'
>;

export function createQuickJSStepBindings(
  args: StepExecutionArgs,
): QuickJSBindings {
  const { context, eventNode, stepResults } = args;
  const documentBinding = createDocumentBinding(context);
  return {
    event: context.blue.nodeToJson(eventNode, 'simple'),
    eventCanonical: context.blue.nodeToJson(eventNode, 'official'),
    steps: stepResults,
    document: documentBinding,
  };
}

function createDocumentBinding(
  context: StepExecutionArgs['context'],
): DocumentBinding {
  const readSnapshot = (pointer?: unknown) => {
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
    return { snapshot, normalizedPointer };
  };

  const toJson = (pointer: unknown, strategy: JsonStrategy) => {
    const { snapshot } = readSnapshot(pointer);
    if (!snapshot) {
      return undefined;
    }
    return context.blue.nodeToJson(snapshot, strategy);
  };

  const binding = ((pointer?: unknown) =>
    toJson(pointer, 'simple')) as DocumentBinding;
  binding.canonical = (pointer?: unknown) => toJson(pointer, 'official');

  return binding;
}
