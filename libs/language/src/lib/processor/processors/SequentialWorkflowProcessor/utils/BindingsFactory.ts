import { ProcessingContext, EventNode } from '../../../types';
import { VMBindings } from './ExpressionEvaluator';
import { isBigNumber } from '../../../../../utils/typeGuards';
import { isDocumentNode } from '../../../utils/typeGuard';

/**
 * Factory for creating standardized bindings for ExpressionEvaluator.evaluate
 */
export class BindingsFactory {
  /**
   * Creates standard bindings for workflow step execution
   */
  static createStandardBindings(
    ctx: ProcessingContext,
    event: EventNode,
    stepResults: Record<string, unknown>
  ): VMBindings {
    const blue = ctx.getBlue();

    return {
      document: (path: string) => {
        const value = ctx.get(path);
        if (isBigNumber(value)) {
          return value.toNumber();
        }
        if (isDocumentNode(value)) {
          return blue.nodeToJson(value, 'original');
        }
        return value;
      },
      event: event.payload,
      steps: stepResults,
    };
  }
}
