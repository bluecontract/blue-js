import {
  BexEngine,
  BexException,
  BexExecutionContext,
  BexProgramSource,
  BexStepResults,
  BexValues,
} from '@blue-labs/bex';
import { BlueNode } from '@blue-labs/language';
import type { JsonValue } from '@blue-labs/shared-utils';

import type { StepExecutionArgs } from '../workflow/step-runner.js';
import { ProcessorBexDocumentView } from './processor-bex-document-view.js';
import { isBexExpressionNode } from '../../../util/bex-expression-node.js';

export class BexFieldEvaluator {
  constructor(private readonly engine = new BexEngine()) {}

  containsExpression(node: BlueNode): boolean {
    return containsBexExpression(node);
  }

  evaluateNode(args: StepExecutionArgs, node: BlueNode): BlueNode {
    return this.evaluateRecursive(args, node, '');
  }

  private evaluateRecursive(
    args: StepExecutionArgs,
    node: BlueNode,
    pointer: string,
  ): BlueNode {
    if (isBexExpressionNode(node)) {
      return this.evaluateExpression(args, node);
    }

    if (pointer.length > 0 && isEmbeddedDocumentNode(node)) {
      return node.clone();
    }

    const cloned = node.clone();
    const items = node.getItems();
    if (items) {
      cloned.setItems(
        items.map((item, index) =>
          this.evaluateRecursive(args, item, `${pointer}/${index}`),
        ),
      );
    }

    const properties = node.getProperties();
    if (properties) {
      cloned.setProperties(
        Object.fromEntries(
          Object.entries(properties).map(([key, value]) => [
            key,
            this.evaluateRecursive(
              args,
              value,
              `${pointer}/${escapeJsonPointerSegment(key)}`,
            ),
          ]),
        ),
      );
    }

    return cloned;
  }

  private evaluateExpression(
    args: StepExecutionArgs,
    expression: BlueNode,
  ): BlueNode {
    try {
      const programNode = new BlueNode().setProperties({
        expr: expression.clone(),
      });
      const result = this.engine.compileAndExecute(
        BexProgramSource.inline(programNode, { inputKind: 'resolved' }),
        this.executionContext(args),
      );
      args.context.consumeGas(result.gasUsed);
      const value = result.value.toSimple();
      if (value === undefined) {
        return new BlueNode();
      }
      return args.context.blue.jsonValueToNode(value as JsonValue);
    } catch (error) {
      if (error instanceof BexException) {
        return args.context.throwFatal(
          `BEX expression ${error.errorClass}: ${error.message}`,
        );
      }
      throw error;
    }
  }

  private executionContext(args: StepExecutionArgs): BexExecutionContext {
    const scopeRootPointer = args.context.resolvePointer('/');
    return BexExecutionContext.builder()
      .blue(args.context.blue)
      .documentView(
        new ProcessorBexDocumentView(args.context, scopeRootPointer),
      )
      .event(
        BexValues.nodeValueSnapshot(args.eventNode, {
          compactListsWithMetadata: true,
          compactScalarsWithMetadata: true,
        }),
      )
      .currentContract(BexValues.nodeSnapshot(args.contractNode ?? undefined))
      .steps(BexStepResults.fromSimple(args.stepResults))
      .gasLimit(1_000_000)
      .build();
  }
}

export function containsBexExpression(node: BlueNode, pointer = ''): boolean {
  if (isBexExpressionNode(node)) {
    return true;
  }

  if (pointer.length > 0 && isEmbeddedDocumentNode(node)) {
    return false;
  }

  const items = node.getItems();
  if (
    items?.some((item, index) =>
      containsBexExpression(item, `${pointer}/${index}`),
    )
  ) {
    return true;
  }

  const properties = node.getProperties();
  return (
    properties !== undefined &&
    Object.entries(properties).some(([key, value]) =>
      containsBexExpression(
        value,
        `${pointer}/${escapeJsonPointerSegment(key)}`,
      ),
    )
  );
}

function isEmbeddedDocumentNode(node: BlueNode): boolean {
  return node.getProperties()?.contracts !== undefined;
}

function escapeJsonPointerSegment(value: string): string {
  return value.replace(/~/g, '~0').replace(/\//g, '~1');
}
