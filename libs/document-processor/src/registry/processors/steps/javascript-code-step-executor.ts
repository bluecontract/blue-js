import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';
import { JavaScriptCodeSchema } from '@blue-repository/types/packages/conversation/schemas/JavaScriptCode';

import type { ContractProcessorContext } from '../../types.js';
import { CodeBlockEvaluationError } from '../../../util/expression/exceptions.js';
import { QuickJSEvaluator } from '../../../util/expression/quickjs-evaluator.js';
import type {
  SequentialWorkflowStepExecutor,
  StepExecutionArgs,
} from '../workflow/step-runner.js';
import { createQuickJSStepBindings } from './quickjs-step-bindings.js';
import { DEFAULT_WASM_GAS_LIMIT } from '../../../util/expression/quickjs-config.js';

interface ResultWithEvents {
  readonly events: readonly unknown[];
  readonly [key: string]: unknown;
}

interface JavaScriptCodeStepExecutorOptions {
  readonly wasmGasLimit?: bigint | number;
}

export class JavaScriptCodeStepExecutor implements SequentialWorkflowStepExecutor {
  readonly supportedBlueIds = [
    conversationBlueIds['Conversation/JavaScript Code'],
  ] as const;

  private readonly evaluator = new QuickJSEvaluator();
  private readonly wasmGasLimit: bigint | number;

  constructor(options: JavaScriptCodeStepExecutorOptions = {}) {
    this.wasmGasLimit = options.wasmGasLimit ?? DEFAULT_WASM_GAS_LIMIT;
  }

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

    const bindings = createQuickJSStepBindings(args);

    try {
      const result = await this.evaluator.evaluate({
        code,
        bindings,
        wasmGasLimit: this.wasmGasLimit,
        onWasmGasUsed: ({ used }) => context.gasMeter().chargeWasmGas(used),
      });

      this.handleEvents(result, context);
      return result;
    } catch (error) {
      throw new CodeBlockEvaluationError(code, error);
    }
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
}
