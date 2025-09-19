import { ProcessingContext, EventNode } from '../../../types';
import { ExpressionEvaluator } from './ExpressionEvaluator';
import { BindingsFactory } from './BindingsFactory';
import {
  isExpression,
  extractExpressionContent,
  containsExpression,
} from '../../../utils/expressionUtils';

export class ExpressionResolver {
  static createBindings(
    ctx: ProcessingContext,
    event: EventNode,
    stepResults: Record<string, unknown>
  ): Record<string, unknown> {
    return BindingsFactory.createStandardBindings(ctx, event, stepResults);
  }

  static async evaluate(
    input: string,
    ctx: ProcessingContext,
    bindings: Record<string, unknown>,
    options: { coerceToString: boolean }
  ): Promise<unknown> {
    const { coerceToString } = options;
    if (isExpression(input)) {
      const expr = extractExpressionContent(input);
      const evaluated = await ExpressionEvaluator.evaluate({
        code: expr,
        ctx,
        bindings,
      });
      return coerceToString ? String(evaluated ?? '') : evaluated;
    }

    if (containsExpression(input)) {
      const escaped = String(input).replace(/`/g, '\\`');
      const code = `\`${escaped}\``;
      const evaluated = await ExpressionEvaluator.evaluate({
        code,
        ctx,
        bindings,
      });
      return String(evaluated ?? '');
    }

    return coerceToString ? String(input) : input;
  }
}
