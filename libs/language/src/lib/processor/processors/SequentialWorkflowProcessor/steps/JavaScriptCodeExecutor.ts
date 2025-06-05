import { JavaScriptCodeSchema } from '@blue-repository/core-dev';
import {
  DocumentNode,
  EventNode,
  EventNodePayload,
  ProcessingContext,
} from '../../../types';
import { WorkflowStepExecutor } from '../types';
import { ExpressionEvaluator } from '../utils/ExpressionEvaluator';
import { BlueNodeTypeSchema } from '../../../../utils/TypeSchema';
import { BindingsFactory } from '../utils/BindingsFactory';

interface ResultWithEvents {
  events: EventNodePayload[];
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
    stepResults: Record<string, unknown>
  ): Promise<unknown> {
    if (!BlueNodeTypeSchema.isTypeOf(step, JavaScriptCodeSchema)) return;
    const blue = ctx.getBlue();

    const javaScriptCodeStep = blue.nodeToSchemaOutput(
      step,
      JavaScriptCodeSchema
    );

    if (!javaScriptCodeStep.code) {
      throw new Error('JavaScript code is required');
    }

    const result = await ExpressionEvaluator.evaluate({
      code: javaScriptCodeStep.code,
      ctx,
      bindings: BindingsFactory.createStandardBindings(ctx, evt, stepResults),
      options: {
        isCodeBlock: true,
        timeout: 500,
      },
    });

    // Handle events in the result
    if (result && typeof result === 'object' && 'events' in result) {
      // TODO: Validate the events
      const resultWithEvents = result as ResultWithEvents;
      if (Array.isArray(resultWithEvents.events)) {
        for (const event of resultWithEvents.events) {
          ctx.emitEvent({
            payload: event,
          });
        }
      }
    }

    return result;
  }
}
