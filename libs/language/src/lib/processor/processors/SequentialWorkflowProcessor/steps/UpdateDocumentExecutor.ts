import {
  isBigDecimalNumber,
  isBigIntegerNumber,
} from '../../../../../utils/typeGuards';
import { DocumentNode, EventNode, ProcessingContext } from '../../../types';
import { WorkflowStepExecutor } from '../types';
import { ExpressionEvaluator } from '../utils/ExpressionEvaluator';
import { BlueNodeTypeSchema } from '../../../../utils/TypeSchema';
import { UpdateDocumentSchema } from '../../../../../repo/core';

/**
 * Executor for "Update Document" workflow steps
 */
export class UpdateDocumentExecutor implements WorkflowStepExecutor {
  readonly stepType = 'Update Document';

  supports(node: DocumentNode): boolean {
    return BlueNodeTypeSchema.isTypeOf(node, UpdateDocumentSchema);
  }

  async execute(
    step: DocumentNode,
    event: EventNode,
    ctx: ProcessingContext,
    documentPath: string,
    stepResults: Record<string, unknown>
  ): Promise<void> {
    if (!BlueNodeTypeSchema.isTypeOf(step, UpdateDocumentSchema)) return;

    const updateDocumentStep = ctx
      .getBlue()
      .nodeToSchemaOutput(step, UpdateDocumentSchema);

    for (const change of updateDocumentStep.changeset ?? []) {
      if (!change.path) continue;

      if (change.op === 'replace' || change.op === 'add') {
        const value = change.val?.getValue();

        if (
          typeof value === 'string' &&
          value.startsWith('${') &&
          value.endsWith('}')
        ) {
          const expr = value.slice(2, -1);
          const evaluatedValue = await ExpressionEvaluator.evaluate({
            code: expr,
            ctx,
            bindings: {
              document: (path: string) => {
                const value = ctx.get(path);
                if (isBigDecimalNumber(value) || isBigIntegerNumber(value)) {
                  return value.toNumber();
                }
                return value;
              },
              event: event.payload,
              steps: stepResults,
            },
          });

          ctx.addPatch({
            op: change.op,
            path: change.path,
            val: evaluatedValue,
          });
          ctx.emitEvent({
            payload: {
              type: 'Document Update',
              op: change.op,
              path: ctx.resolvePath(change.path),
              val: evaluatedValue,
            },
          });
        }
      }

      if (change.op === 'remove') {
        ctx.addPatch({ op: change.op, path: change.path });

        ctx.emitEvent({
          payload: {
            type: 'Document Update',
            op: change.op,
            path: ctx.resolvePath(change.path),
            val: null,
          },
        });
      }
    }
  }
}
