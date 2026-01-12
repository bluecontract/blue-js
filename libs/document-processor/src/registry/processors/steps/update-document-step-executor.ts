import { BlueNode } from '@blue-labs/language';
import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';
import {
  UpdateDocumentSchema,
  type UpdateDocument,
} from '@blue-repository/types/packages/conversation/schemas/UpdateDocument';

import { QuickJSEvaluator } from '../../../util/expression/quickjs-evaluator.js';
import type { JsonPatch } from '../../../model/shared/json-patch.js';
import type { ContractProcessorContext } from '../../types.js';
import type {
  SequentialWorkflowStepExecutor,
  StepExecutionArgs,
} from '../workflow/step-runner.js';
import { createQuickJSStepBindings } from './quickjs-step-bindings.js';
import {
  resolveNodeExpressions,
  createPicomatchShouldResolve,
} from '../../../util/expression/quickjs-expression-utils.js';

type JsonPatchOperation = 'ADD' | 'REPLACE' | 'REMOVE';

type ChangeInput = Required<UpdateDocument>['changeset'][number];

export class UpdateDocumentStepExecutor implements SequentialWorkflowStepExecutor {
  readonly supportedBlueIds = [
    conversationBlueIds['Conversation/Update Document'],
  ] as const;

  private readonly evaluator = new QuickJSEvaluator();

  async execute(args: StepExecutionArgs): Promise<unknown> {
    const { context, stepNode } = args;
    const { blue } = context;

    if (!blue.isTypeOf(stepNode, UpdateDocumentSchema)) {
      return context.throwFatal('Update Document step payload is invalid');
    }

    const resolvedStepNode = await resolveNodeExpressions({
      evaluator: this.evaluator,
      node: stepNode,
      bindings: createQuickJSStepBindings(args),
      shouldResolve: createPicomatchShouldResolve({
        include: ['/changeset', '/changeset/**'],
      }),
      context,
    });
    const changeset = this.extractChanges(resolvedStepNode, context);

    context.gasMeter().chargeUpdateDocumentBase(changeset.length);
    for (const change of changeset) {
      const patch = this.createPatch(change, context);
      await context.applyPatch(patch);
    }

    return undefined;
  }

  private extractChanges(
    stepNode: BlueNode,
    context: ContractProcessorContext,
  ): ChangeInput[] {
    const schemaOutput = context.blue.nodeToSchemaOutput(
      stepNode,
      UpdateDocumentSchema,
    );
    return schemaOutput.changeset ?? [];
  }

  private createPatch(
    change: ChangeInput,
    context: ContractProcessorContext,
  ): JsonPatch {
    const op = this.normalizeOperation(change.op, context);
    const path = this.normalizePath(change.path, context);
    const absolutePath = context.resolvePointer(path);

    if (op === 'REMOVE') {
      return { op, path: absolutePath };
    }

    return { op, path: absolutePath, val: change.val };
  }

  private normalizeOperation(
    rawOp: unknown,
    context: ContractProcessorContext,
  ): JsonPatchOperation {
    const text = typeof rawOp === 'string' ? rawOp : undefined;
    const upper = (text ?? 'REPLACE').toUpperCase();

    if (upper === 'ADD' || upper === 'REPLACE' || upper === 'REMOVE') {
      return upper;
    }

    return context.throwFatal(
      `Unsupported Update Document operation "${text}"`,
    );
  }

  private normalizePath(
    rawPath: unknown,
    context: ContractProcessorContext,
  ): string {
    if (typeof rawPath !== 'string') {
      return context.throwFatal('Update Document changeset requires a path');
    }

    const trimmed = rawPath.trim();
    if (trimmed.length === 0) {
      return context.throwFatal('Update Document path cannot be empty');
    }

    return trimmed;
  }
}
