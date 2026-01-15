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
  const { context, eventNode, stepResults, contractNode } = args;
  const documentBinding = createDocumentBinding(context);
  const currentContract =
    contractNode != null
      ? context.blue.nodeToJson(contractNode, 'simple')
      : null;
  const currentContractCanonical =
    contractNode != null
      ? context.blue.nodeToJson(contractNode, 'official')
      : currentContract;
  return {
    event: context.blue.nodeToJson(eventNode, 'simple'),
    eventCanonical: context.blue.nodeToJson(eventNode, 'official'),
    steps: stepResults,
    document: documentBinding,
    currentContract,
    currentContractCanonical,
  };
}

const RAW_VALUE_SEGMENTS = new Set(['blueId', 'name', 'description', 'value']);

function createDocumentBinding(
  context: StepExecutionArgs['context'],
): DocumentBinding {
  const shouldReturnRawValue = (normalizedPointer: string) => {
    if (normalizedPointer === '/') {
      return false;
    }
    const lastSlash = normalizedPointer.lastIndexOf('/');
    const segment = normalizedPointer.substring(lastSlash + 1);
    return RAW_VALUE_SEGMENTS.has(segment);
  };

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
    const { snapshot, normalizedPointer } = readSnapshot(pointer);
    if (!snapshot) {
      return undefined;
    }
    if (shouldReturnRawValue(normalizedPointer)) {
      return context.blue.nodeToJson(snapshot, 'simple');
    }
    return context.blue.nodeToJson(snapshot, strategy);
  };

  const binding = ((pointer?: unknown) =>
    toJson(pointer, 'simple')) as DocumentBinding;
  binding.canonical = (pointer?: unknown) => toJson(pointer, 'official');

  return binding;
}
