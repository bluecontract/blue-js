import {
  BlueNodeGetResult,
  DocumentNode,
  EventNode,
  ProcessingContext,
} from '../../../types';
import { WorkflowStepExecutor } from '../types';
import { ExpressionEvaluator } from '../utils/ExpressionEvaluator';
import { ExpressionResolver } from '../utils/ExpressionResolver';
import { applyBlueNodePatch, BlueNodeTypeSchema } from '@blue-labs/language';
import { UpdateDocumentSchema } from '@blue-repository/core-dev';
import type { BlueNode } from '@blue-labs/language';
import { BindingsFactory } from '../utils/BindingsFactory';
import { isDocumentNode } from '../../../utils/typeGuard';
import { isNonNullable } from '@blue-labs/shared-utils';
import { createDocumentUpdateEvent } from '../../../utils/eventFactories';
import {
  isExpression,
  extractExpressionContent,
  containsExpression,
} from '../../../utils/expressionUtils';

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
    stepResults: Record<string, unknown>,
  ): Promise<void> {
    const blue = ctx.getBlue();
    if (!BlueNodeTypeSchema.isTypeOf(step, UpdateDocumentSchema)) return;

    const changesetNodeValue = await this.evaluateChangeset(
      step.get('/changeset'),
      ctx,
      event,
      stepResults,
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

      const evaluatedPath = await this.evaluateChangePath(
        change.path,
        ctx,
        event,
        stepResults,
      );

      const changeValue = change.val;
      if (
        (change.op === 'replace' || change.op === 'add') &&
        isNonNullable(changeValue)
      ) {
        const changeValueNode = await this.evaluateChangeValue(
          changeValue,
          ctx,
          event,
          stepResults,
        );

        ctx.addPatch({
          op: change.op,
          path: evaluatedPath,
          val: changeValueNode,
        });
        ctx.emitEvent({
          payload: createDocumentUpdateEvent(
            {
              op: change.op,
              path: ctx.resolvePath(evaluatedPath),
              val: blue.nodeToJson(changeValueNode, 'original'),
            },
            blue,
          ),
          emissionType: 'update',
        });
      }

      if (change.op === 'remove') {
        ctx.addPatch({ op: change.op, path: evaluatedPath });

        ctx.emitEvent({
          payload: createDocumentUpdateEvent(
            {
              op: change.op,
              path: ctx.resolvePath(evaluatedPath),
              val: null,
            },
            blue,
          ),
          emissionType: 'update',
        });
      }
    }
  }

  private async evaluateChangeset(
    changesetNodeGetResult: BlueNodeGetResult,
    ctx: ProcessingContext,
    event: EventNode,
    stepResults: Record<string, unknown>,
  ) {
    const blue = ctx.getBlue();
    if (isExpression(changesetNodeGetResult)) {
      const expr = extractExpressionContent(changesetNodeGetResult);
      const evaluatedValue = await ExpressionEvaluator.evaluate({
        code: expr,
        ctx,
        bindings: BindingsFactory.createStandardBindings(
          ctx,
          event,
          stepResults,
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
    stepResults: Record<string, unknown>,
  ) {
    const evaluatedValueString = changeValueNode.getValue();
    const blue = ctx.getBlue();

    if (
      isExpression(evaluatedValueString) ||
      (typeof evaluatedValueString === 'string' &&
        containsExpression(evaluatedValueString))
    ) {
      const bindings = ExpressionResolver.createBindings(
        ctx,
        event,
        stepResults,
      );
      const evaluated = await ExpressionResolver.evaluate(
        String(evaluatedValueString),
        ctx,
        bindings,
        { coerceToString: !isExpression(evaluatedValueString) },
      );
      return blue.jsonValueToNode(evaluated ?? null);
    }

    return changeValueNode;
  }

  private async evaluateChangePath(
    path: string,
    ctx: ProcessingContext,
    event: EventNode,
    stepResults: Record<string, unknown>,
  ): Promise<string> {
    const bindings = ExpressionResolver.createBindings(ctx, event, stepResults);

    if (isExpression(path) || containsExpression(path)) {
      const evaluated = await ExpressionResolver.evaluate(path, ctx, bindings, {
        coerceToString: true,
      });
      return String(evaluated ?? '');
    }

    return path;
  }
}
