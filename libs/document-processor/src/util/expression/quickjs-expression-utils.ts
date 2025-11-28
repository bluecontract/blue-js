import { BlueNode } from '@blue-labs/language';
import type { ContractProcessorContext } from '../../registry/types.js';
import picomatch from 'picomatch';
import { CodeBlockEvaluationError } from './exceptions.js';
import {
  QuickJSEvaluator,
  type QuickJSBindings,
  type QuickJSEvaluationOptions,
} from './quickjs-evaluator.js';
import { DEFAULT_EXPRESSION_WASM_GAS_LIMIT } from './quickjs-config.js';

// Matches if entire string is exactly ${...} (anchored with ^ and $)
const EXPRESSION_PATTERN = /^\$\{([\s\S]*)\}$/;
// Matches first occurrence of ${...} anywhere in the string
const SINGLE_EXPRESSION_PATTERN = /\$\{([\s\S]+?)\}/;
// Matches all occurrences of ${...} in the string (with global flag)
const ALL_EXPRESSIONS_PATTERN = /\$\{([\s\S]+?)\}/g;

export function isExpression(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  if (!EXPRESSION_PATTERN.test(value)) {
    return false;
  }
  const firstIndex = value.indexOf('${');
  const lastIndex = value.lastIndexOf('${');
  return firstIndex === lastIndex;
}

export function containsExpression(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  if (EXPRESSION_PATTERN.test(value)) {
    return true;
  }
  return SINGLE_EXPRESSION_PATTERN.test(value);
}

export function extractExpressionContent(expression: string): string {
  if (!isExpression(expression)) {
    throw new Error(`Invalid expression: ${expression}`);
  }
  return expression.slice(2, -1);
}

export async function evaluateQuickJSExpression(
  evaluator: QuickJSEvaluator,
  expression: string,
  bindings: QuickJSBindings,
  wasmGasLimit?: bigint | number,
  onWasmGasUsed?: QuickJSEvaluationOptions['onWasmGasUsed'],
): Promise<unknown> {
  const code = `return await (${expression});`;
  try {
    return await evaluator.evaluate({
      code,
      bindings,
      wasmGasLimit,
      onWasmGasUsed,
    });
  } catch (error) {
    throw new CodeBlockEvaluationError(expression, error);
  }
}

export async function resolveTemplateString(
  evaluator: QuickJSEvaluator,
  template: string,
  bindings: QuickJSBindings,
  wasmGasLimit?: bigint | number,
  onWasmGasUsed?: QuickJSEvaluationOptions['onWasmGasUsed'],
): Promise<string> {
  let result = '';
  let lastIndex = 0;

  for (const match of template.matchAll(ALL_EXPRESSIONS_PATTERN)) {
    const full = match[0];
    const expression = match[1];
    const index = match.index ?? 0;
    result += template.slice(lastIndex, index);
    const evaluated = await evaluateQuickJSExpression(
      evaluator,
      expression,
      bindings,
      wasmGasLimit,
      onWasmGasUsed,
    );
    result += evaluated == null ? '' : String(evaluated);
    lastIndex = index + full.length;
  }

  result += template.slice(lastIndex);
  return result;
}

export type ExpressionResolverPredicate = (pointer: string) => boolean;
export type ExpressionTraversalPredicate = (
  pointer: string,
  node: BlueNode,
) => boolean;

export type PicomatchShouldResolveOptions = {
  include: readonly string[];
  exclude?: readonly string[];
  options?: {
    dot?: boolean;
    nocase?: boolean;
    noglobstar?: boolean;
  };
};

export type ResolveNodeExpressionsOptions = {
  evaluator: QuickJSEvaluator;
  node: BlueNode;
  bindings: QuickJSBindings;
  shouldResolve: ExpressionResolverPredicate;
  shouldDescend?: ExpressionTraversalPredicate;
  context: ContractProcessorContext;
  pointer?: string;
};

export function createPicomatchShouldResolve({
  include,
  exclude = [],
  options,
}: PicomatchShouldResolveOptions): ExpressionResolverPredicate {
  const baseOptions = { dot: true, ...(options ?? {}) } as Record<
    string,
    unknown
  >;
  const includeMatchers = include.map((pattern) =>
    picomatch(pattern, baseOptions),
  );
  const excludeMatchers = exclude.map((pattern) =>
    picomatch(pattern, baseOptions),
  );

  return (pointer: string): boolean =>
    includeMatchers.some((m) => m(pointer)) &&
    !excludeMatchers.some((m) => m(pointer));
}

export async function resolveNodeExpressions(
  options: ResolveNodeExpressionsOptions,
): Promise<BlueNode> {
  const {
    evaluator,
    node,
    bindings,
    shouldResolve,
    shouldDescend = () => true,
    context,
    pointer = '/',
  } = options;

  const expressionWasmGasLimit = DEFAULT_EXPRESSION_WASM_GAS_LIMIT;
  const onExpressionWasmGasUsed: QuickJSEvaluationOptions['onWasmGasUsed'] = ({
    used,
  }) => {
    context.gasMeter().chargeWasmGas(used);
  };

  const clone = node.clone();
  if (!shouldDescend(pointer, clone)) {
    return clone;
  }
  const value = clone.getValue();

  if (value !== undefined) {
    if (typeof value === 'string' && shouldResolve(pointer)) {
      if (isExpression(value)) {
        const expression = extractExpressionContent(value);
        const evaluated = await evaluateQuickJSExpression(
          evaluator,
          expression,
          bindings,
          expressionWasmGasLimit,
          onExpressionWasmGasUsed,
        );
        return context.blue.jsonValueToNode(evaluated ?? null);
      } else if (containsExpression(value)) {
        const resolved = await resolveTemplateString(
          evaluator,
          value,
          bindings,
          expressionWasmGasLimit,
          onExpressionWasmGasUsed,
        );
        return new BlueNode().setValue(resolved);
      }
    }
    return clone;
  }

  const items = clone.getItems?.();
  if (Array.isArray(items)) {
    const resolvedItems = await Promise.all(
      items.map((item, index) =>
        resolveNodeExpressions({
          ...options,
          node: item,
          pointer: `${pointer}/${index}`,
        }),
      ),
    );
    clone.setItems(resolvedItems);
    return clone;
  }

  const properties = clone.getProperties?.();
  if (properties) {
    const resolvedProperties: Record<string, BlueNode> = {};
    for (const [key, child] of Object.entries(properties)) {
      const childPointer = pointer === '/' ? `/${key}` : `${pointer}/${key}`;
      resolvedProperties[key] = await resolveNodeExpressions({
        ...options,
        node: child,
        pointer: childPointer,
      });
    }
    clone.setProperties(resolvedProperties);
  }

  return clone;
}
