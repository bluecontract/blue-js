import { BlueNode, isBigNumber } from '@blue-labs/language';
import {
  blueIds as conversationBlueIds,
  JavaScriptCodeSchema,
} from '@blue-repository/conversation';

import {
  QuickJSEvaluator,
  type QuickJSBindings,
} from '../../../util/quickjs-evaluator.js';
import { CodeBlockEvaluationError } from '../../../util/exceptions.js';
import type { ContractProcessorContext } from '../../types.js';
import type {
  SequentialWorkflowStepExecutor,
  StepExecutionArgs,
} from '../sequential-workflow-processor.js';

interface ResultWithEvents {
  readonly events: readonly unknown[];
  readonly [key: string]: unknown;
}

export class JavaScriptCodeStepExecutor
  implements SequentialWorkflowStepExecutor
{
  readonly supportedBlueIds = [conversationBlueIds['JavaScript Code']] as const;

  private readonly evaluator = new QuickJSEvaluator();

  async execute(args: StepExecutionArgs): Promise<unknown> {
    const { context, stepNode } = args;
    const { blue } = context;

    if (!blue.isTypeOf(stepNode, JavaScriptCodeSchema)) {
      return context.throwFatal('JavaScript Code step payload is invalid');
    }

    const specification = blue.nodeToSchemaOutput(
      stepNode,
      JavaScriptCodeSchema,
    );

    const code = specification.code;
    if (!code) {
      return context.throwFatal(
        'JavaScript Code step must include code to execute',
      );
    }

    const bindings = this.createBindings(args);

    try {
      const result = await this.evaluator.evaluate({
        code,
        bindings,
      });

      this.handleEvents(result, context);
      return result;
    } catch (error) {
      throw new CodeBlockEvaluationError(code, error);
    }
  }

  private createBindings(args: StepExecutionArgs): QuickJSBindings {
    const { context, eventNode, stepResults } = args;
    const eventJson = this.convertNodeToJson(eventNode, context, 'simple');

    return {
      event: eventJson,
      steps: this.normalizeJson(stepResults),
      document: (pointer: unknown) => {
        if (typeof pointer !== 'string') {
          throw new TypeError('document() expects a string pointer');
        }

        const absolutePointer = pointer.startsWith('/')
          ? pointer
          : context.resolvePointer(pointer);

        const snapshot = context.documentAt(absolutePointer);
        if (!snapshot) {
          return undefined;
        }

        return this.normalizeJson(
          context.blue.nodeToJson(snapshot, 'original'),
        );
      },
    };
  }

  private handleEvents(
    result: unknown,
    context: ContractProcessorContext,
  ): void {
    if (!result || typeof result !== 'object') {
      return;
    }
    const maybeContainer = result as Partial<ResultWithEvents>;
    if (!Array.isArray(maybeContainer.events)) {
      return;
    }
    for (const event of maybeContainer.events) {
      const eventNode = context.blue.jsonValueToNode(event);
      context.emitEvent(eventNode);
    }
  }

  private convertNodeToJson(
    node: BlueNode | null,
    context: ContractProcessorContext,
    strategy: 'simple' | 'original',
  ): unknown {
    if (!node) {
      return null;
    }
    const json = context.blue.nodeToJson(node, strategy);
    return this.normalizeJson(json);
  }

  private normalizeJson<T>(value: T): T {
    if (isBigNumber(value)) {
      return value.toNumber() as T;
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeJson(item)) as T;
    }
    if (value && typeof value === 'object') {
      const normalizedEntries = Object.entries(
        value as Record<string, unknown>,
      ).map(([key, val]) => [key, this.normalizeJson(val)]);
      return Object.fromEntries(normalizedEntries) as T;
    }
    return value;
  }
}
