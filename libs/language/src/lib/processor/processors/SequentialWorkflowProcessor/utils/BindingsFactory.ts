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
        // TODO: Maybe we should do it for all results so make "get" on JSON-like objects
        if (isDocumentNode(value)) {
          return blue.nodeToJson(value, 'simple');
        }
        return value;
      },
      event: event.payload,
      steps: stepResults,
    };
  }
}
