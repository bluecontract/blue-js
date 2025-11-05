import { BlueNode } from '@blue-labs/language';
import type { ContractProcessorContext } from '../../registry/types.js';
import picomatch from 'picomatch';
import { CodeBlockEvaluationError } from './exceptions.js';
import { QuickJSEvaluator, type QuickJSBindings } from './quickjs-evaluator.js';

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
): Promise<unknown> {
  const code = `return await (${expression});`;
  try {
    return await evaluator.evaluate({ code, bindings });
  } catch (error) {
    throw new CodeBlockEvaluationError(expression, error);
  }
}

export async function resolveTemplateString(
  evaluator: QuickJSEvaluator,
  template: string,
  bindings: QuickJSBindings,
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
    );
    result += evaluated == null ? '' : String(evaluated);
    lastIndex = index + full.length;
  }

  result += template.slice(lastIndex);
  return result;
}

export type ExpressionResolverPredicate = (pointer: string) => boolean;

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
    context,
    pointer = '/',
  } = options;

  const clone = node.clone();
  const value = clone.getValue();

  if (value !== undefined) {
    if (typeof value === 'string' && shouldResolve(pointer)) {
      if (isExpression(value)) {
        const expression = extractExpressionContent(value);
        context.gasMeter().chargeExpression(expression);
        const evaluated = await evaluateQuickJSExpression(
          evaluator,
          expression,
          bindings,
        );
        return context.blue.jsonValueToNode(evaluated ?? null);
      } else if (containsExpression(value)) {
        const placeholderPattern = new RegExp(ALL_EXPRESSIONS_PATTERN);
        let placeholderCount = 0;
        placeholderPattern.lastIndex = 0;
        while (placeholderPattern.exec(value)) {
          placeholderCount += 1;
        }
        context.gasMeter().chargeTemplate(placeholderCount, value);
        const resolved = await resolveTemplateString(
          evaluator,
          value,
          bindings,
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
