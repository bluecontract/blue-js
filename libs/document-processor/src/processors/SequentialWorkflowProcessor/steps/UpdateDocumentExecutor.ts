import {
  BlueNodeGetResult,
  DocumentNode,
  EventNode,
  ProcessingContext,
} from '../../../types';
import { WorkflowStepExecutor } from '../types';
import { ExpressionEvaluator } from '../utils/ExpressionEvaluator';
import { applyBlueNodePatch, BlueNodeTypeSchema } from '@blue-labs/language';
import { UpdateDocumentSchema } from '@blue-repository/core-dev';
import type { BlueNode } from '@blue-labs/language';
import { BindingsFactory } from '../utils/BindingsFactory';
import { isDocumentNode } from 'src/utils/typeGuard';
import { isNonNullable } from '@blue-labs/shared-utils';

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
    const blue = ctx.getBlue();
    if (!BlueNodeTypeSchema.isTypeOf(step, UpdateDocumentSchema)) return;

    const changesetNodeValue = await this.evaluateChangeset(
      step.get('/changeset'),
      ctx,
      event,
      stepResults
    );

    const newStep = applyBlueNodePatch(step, {
      op: 'replace',
      path: '/changeset',
      val: changesetNodeValue,
    });

    const updateDocumentStep = ctx
      .getBlue()
      .nodeToSchemaOutput(newStep, UpdateDocumentSchema);

    for (const change of updateDocumentStep.changeset ?? []) {
      if (!change.path) continue;

      const changeValue = change.val;
      if (
        (change.op === 'replace' || change.op === 'add') &&
        isNonNullable(changeValue)
      ) {
        const changeValueNode = await this.evaluateChangeValue(
          changeValue,
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
            val: blue.nodeToJson(changeValueNode, 'original'),
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

  private async evaluateChangeset(
    changesetNodeGetResult: BlueNodeGetResult,
    ctx: ProcessingContext,
    event: EventNode,
    stepResults: Record<string, unknown>
  ) {
    const blue = ctx.getBlue();
    if (
      typeof changesetNodeGetResult === 'string' &&
      changesetNodeGetResult.startsWith('${') &&
      changesetNodeGetResult.endsWith('}')
    ) {
      const expr = changesetNodeGetResult.slice(2, -1);
      const evaluatedValue = await ExpressionEvaluator.evaluate({
        code: expr,
        ctx,
        bindings: BindingsFactory.createStandardBindings(
          ctx,
          event,
          stepResults
        ),
      });
      return blue.jsonValueToNode(evaluatedValue ?? null);
    }

    if (isDocumentNode(changesetNodeGetResult)) {
      return changesetNodeGetResult;
    }

    throw new Error('Invalid changeset: expected a string or document node');
  }

  private async evaluateChangeValue(
    changeValueNode: BlueNode,
    ctx: ProcessingContext,
    event: EventNode,
    stepResults: Record<string, unknown>
  ) {
    const evaluatedValueString = changeValueNode.getValue();
    const blue = ctx.getBlue();

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
      return blue.jsonValueToNode(evaluatedValue ?? null);
    }

    return changeValueNode;
  }
}
