import { BlueNode } from '@blue-labs/language';
import type { BexEngine } from '@blue-labs/bex';
import {
  UpdateDocumentSchema,
  type UpdateDocument,
} from '@blue-repository/types/packages/coordination/schemas/UpdateDocument';

import type { JsonPatch } from '../../../model/shared/json-patch.js';
import { conversationBlueIds } from '../../../repository/semantic-repository.js';
import type { ContractProcessorContext } from '../../types.js';
import type {
  SequentialWorkflowStepExecutor,
  StepExecutionArgs,
} from '../workflow/step-runner.js';
import { BexFieldEvaluator } from './bex-field-evaluator.js';

type JsonPatchOperation = 'ADD' | 'REPLACE' | 'REMOVE';

type ChangeInput = Required<UpdateDocument>['changeset'][number] | BlueNode;

export class UpdateDocumentStepExecutor implements SequentialWorkflowStepExecutor {
  readonly supportedBlueIds = [
    conversationBlueIds['Conversation/Update Document'],
  ] as const;

  private readonly bexEvaluator: BexFieldEvaluator;

  constructor(bexEngine?: BexEngine) {
    this.bexEvaluator = new BexFieldEvaluator(bexEngine);
  }

  async execute(args: StepExecutionArgs): Promise<unknown> {
    const { context, stepNode } = args;
    const { blue } = context;

    if (
      !blue.isTypeOfBlueId(
        stepNode,
        conversationBlueIds['Conversation/Update Document'],
      )
    ) {
      return context.throwFatal('Update Document step payload is invalid');
    }

    let resolvedStepNode = stepNode;
    const changesetNode = resolvedStepNode.getProperties()?.changeset;
    if (
      changesetNode !== undefined &&
      context.measure('bex.fieldEvaluation.containsExpression', () =>
        this.bexEvaluator.containsExpression(changesetNode),
      )
    ) {
      resolvedStepNode = resolvedStepNode.clone();
      resolvedStepNode.addProperty(
        'changeset',
        this.bexEvaluator.evaluateNode(args, changesetNode),
      );
    }
    const changeset = context.measure('bex.compute.toPatches', () =>
      this.extractChanges(resolvedStepNode, context),
    );

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
    const changesetNode = stepNode.getProperties()?.changeset;
    if (!changesetNode) {
      return [];
    }
    if (
      context.measure('bex.fieldEvaluation.containsExpression', () =>
        this.bexEvaluator.containsExpression(changesetNode),
      )
    ) {
      return context.throwFatal(
        'Update Document changeset still contains unevaluated BEX',
      );
    }
    const items = changesetNode.getItems();
    if (items !== undefined) {
      return [...items];
    }
    if (changesetNode.getValue() !== undefined) {
      return context.throwFatal(
        'Update Document changeset must evaluate to a list',
      );
    }
    const schemaOutput = context.blue.nodeToSchemaOutput<UpdateDocument>(
      stepNode,
      UpdateDocumentSchema,
    );
    return schemaOutput.changeset ?? [];
  }

  private createPatch(
    change: ChangeInput,
    context: ContractProcessorContext,
  ): JsonPatch {
    const op = this.normalizeOperation(this.changeField(change, 'op'), context);
    const path = this.normalizePath(this.changeField(change, 'path'), context);
    const absolutePath = context.resolvePointer(path);

    if (op === 'REMOVE') {
      return { op, path: absolutePath };
    }

    const val = this.changeValue(change);
    if (!val) {
      return context.throwFatal(`${op} Update Document operation missing val`);
    }
    return { op, path: absolutePath, val };
  }

  private changeField(change: ChangeInput, key: string): unknown {
    if (change instanceof BlueNode) {
      return change.getProperties()?.[key]?.getValue();
    }
    return change[key as keyof ChangeInput];
  }

  private changeValue(change: ChangeInput): BlueNode | undefined {
    if (change instanceof BlueNode) {
      return change.getProperties()?.val;
    }
    return change.val;
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
