import { DocumentNode, EventNode, ProcessingContext } from '../../../types';
import { WorkflowStepExecutor } from '../types';
import { ExpressionEvaluator } from '../utils/ExpressionEvaluator';
import { BlueNodeTypeSchema } from '../../../../utils/TypeSchema';
import { UpdateDocumentSchema } from '../../../../../repo/core';
import type { BlueNode } from '../../../../model/Node';
import { BindingsFactory } from '../utils/BindingsFactory';

/**
 * Executor for "Update Document" workflow steps
 */
export class UpdateDocumentExecutor implements WorkflowStepExecutor {
  readonly stepType = 'Update Document';

  supports(node: DocumentNode): boolean {
    return BlueNodeTypeSchema.isTypeOf(node, UpdateDocumentSchema);
  }

  private async evaluateChangeValue(
    changeValueNode: BlueNode | undefined,
    ctx: ProcessingContext,
    event: EventNode,
    stepResults: Record<string, unknown>
  ) {
    const evaluatedValueString = changeValueNode?.getValue();

    if (
      typeof evaluatedValueString === 'string' &&
      evaluatedValueString.startsWith('${') &&
      evaluatedValueString.endsWith('}')
    ) {
      const expr = evaluatedValueString.slice(2, -1);
      const evaluatedValue = await ExpressionEvaluator.evaluate({
        code: expr,
        ctx,
        bindings: BindingsFactory.createStandardBindings(
          ctx,
          event,
          stepResults
        ),
      });
      return evaluatedValue;
    }

    return changeValueNode;
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
        const changeValueNode = await this.evaluateChangeValue(
          change.val,
          ctx,
          event,
          stepResults
        );
        ctx.addPatch({
          op: change.op,
          path: change.path,
          val: changeValueNode,
        });
        ctx.emitEvent({
          payload: {
            type: 'Document Update',
            op: change.op,
            path: ctx.resolvePath(change.path),
            val: changeValueNode,
          },
        });
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
