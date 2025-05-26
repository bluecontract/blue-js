import { JavaScriptCodeSchema } from '../../../../../repo/core/schema/JavaScriptCode';
import { DocumentNode, EventNode, ProcessingContext } from '../../../types';
import { WorkflowStepExecutor } from '../types';
import { ExpressionEvaluator } from '../utils/ExpressionEvaluator';
import { BlueNodeTypeSchema } from '../../../../utils/TypeSchema';
import {
  isBigDecimalNumber,
  isBigIntegerNumber,
} from '../../../../../utils/typeGuards';

interface ResultWithEvents {
  events: EventNode[];
  [key: string]: unknown;
}

export class JavaScriptCodeExecutor implements WorkflowStepExecutor {
  readonly stepType = 'JavaScript Code';

  supports(node: DocumentNode) {
    return BlueNodeTypeSchema.isTypeOf(node, JavaScriptCodeSchema);
  }

  async execute(
    step: DocumentNode,
    evt: EventNode,
    ctx: ProcessingContext,
    documentPath: string,
    steps?: Record<string, unknown>
  ): Promise<unknown> {
    if (!BlueNodeTypeSchema.isTypeOf(step, JavaScriptCodeSchema)) return;

    const javaScriptCodeStep = ctx
      .getBlue()
      .nodeToSchemaOutput(step, JavaScriptCodeSchema);

    if (!javaScriptCodeStep.code) {
      throw new Error('JavaScript code is required');
    }

    const result = await ExpressionEvaluator.evaluate({
      code: javaScriptCodeStep.code,
      ctx,
      bindings: {
        document: (path: string) => {
          const value = ctx.get(path);
          if (isBigDecimalNumber(value) || isBigIntegerNumber(value)) {
            return value.toNumber();
          }
          return value;
        },
        event: evt.payload,
        steps,
      },
      options: {
        isCodeBlock: true,
        timeout: 500,
      },
    });

    // Handle events in the result
    if (result && typeof result === 'object' && 'events' in result) {
      const resultWithEvents = result as ResultWithEvents;
      if (Array.isArray(resultWithEvents.events)) {
        for (const event of resultWithEvents.events) {
          ctx.emitEvent(event);
        }
      }
    }

    return result;
  }
}
