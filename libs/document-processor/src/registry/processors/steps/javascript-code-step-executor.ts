import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';

import type { ContractProcessorContext } from '../../types.js';
import { CodeBlockEvaluationError } from '../../../util/expression/exceptions.js';
import type { JavaScriptEvaluationEngine } from '../../../util/expression/javascript-evaluation-engine.js';
import type {
  SequentialWorkflowStepExecutor,
  StepExecutionArgs,
} from '../workflow/step-runner.js';
import { ProcessorFatalError } from '../../../engine/processor-fatal-error.js';
import { createQuickJSStepBindings } from './quickjs-step-bindings.js';
import { getJavaScriptExecutionPolicy } from '../../../util/expression/javascript-execution-policy.js';
import { buildJavaScriptCodeV2ModulePack } from './javascript-code-module-pack.js';
import {
  readJavaScriptCodeV2Mode,
  readJavaScriptCodeV2Step,
  readOptionalString,
} from './javascript-code-step-reader.js';

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
    conversationBlueIds['Conversation/JavaScript Code v2'],
  ] as const;

  private readonly wasmGasLimit: bigint | number;
  private readonly executionProfile: ReturnType<
    typeof getJavaScriptExecutionPolicy
  >['executionProfile'];

  constructor(
    private readonly engine: JavaScriptEvaluationEngine,
    options: JavaScriptCodeStepExecutorOptions = {},
  ) {
    const executionPolicy = getJavaScriptExecutionPolicy(engine);
    this.wasmGasLimit =
      options.wasmGasLimit ?? executionPolicy.jsCodeStepGasLimit;
    this.executionProfile = executionPolicy.executionProfile;
  }

  async execute(args: StepExecutionArgs): Promise<unknown> {
    const { context, stepNode } = args;

    const type = stepNode.getType();
    const blueId = type?.getBlueId();
    const typeName = type?.getName();
    const isV2 =
      blueId === conversationBlueIds['Conversation/JavaScript Code v2'] ||
      typeName === 'Conversation/JavaScript Code v2';
    const isV1 =
      blueId === conversationBlueIds['Conversation/JavaScript Code'] ||
      typeName === 'Conversation/JavaScript Code';
    if (!isV1 && !isV2) {
      return context.throwFatal('JavaScript Code step payload is invalid');
    }

    if (isV2) {
      return this.executeV2(args);
    }

    const code = readOptionalString(stepNode.getProperties()?.code);
    if (!code) {
      return context.throwFatal(
        'JavaScript Code step must include code to execute',
      );
    }

    const bindings = createQuickJSStepBindings(args);

    try {
      const result = await this.engine.evaluate({
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

  private async executeV2(args: StepExecutionArgs): Promise<unknown> {
    const { context, stepNode } = args;
    const specification = readJavaScriptCodeV2Step(stepNode);
    const code = specification.code;
    if (!code) {
      return context.throwFatal(
        'JavaScript Code v2 step must include code to execute',
      );
    }

    const mode = readJavaScriptCodeV2Mode(specification.mode, context);
    const hasModuleFields =
      specification.entryExport !== undefined ||
      specification.modules !== undefined ||
      specification.libraries !== undefined;
    const resolvedMode =
      mode === 'auto' ? (hasModuleFields ? 'module' : 'script') : mode;

    if (resolvedMode === 'script' && mode === 'script' && hasModuleFields) {
      return context.throwFatal(
        'JavaScript Code v2 mode: script does not allow entryExport, modules, or libraries',
      );
    }

    const bindings = createQuickJSStepBindings(args);
    const modulePack =
      resolvedMode === 'module'
        ? await buildJavaScriptCodeV2ModulePack(
            {
              code,
              ...(specification.entryExport
                ? { entryExport: specification.entryExport }
                : {}),
              ...(specification.modules
                ? { modules: specification.modules }
                : {}),
              ...(specification.libraries
                ? { libraries: specification.libraries }
                : {}),
            },
            context,
            this.executionProfile,
          )
        : undefined;

    try {
      const result =
        resolvedMode === 'module'
          ? await this.engine.evaluate({
              modulePack: modulePack!,
              bindings,
              wasmGasLimit: this.wasmGasLimit,
              onWasmGasUsed: ({ used }) =>
                context.gasMeter().chargeWasmGas(used),
            })
          : await this.engine.evaluate({
              code,
              bindings,
              wasmGasLimit: this.wasmGasLimit,
              onWasmGasUsed: ({ used }) =>
                context.gasMeter().chargeWasmGas(used),
            });

      this.handleEvents(result, context);
      return result;
    } catch (error) {
      if (error instanceof ProcessorFatalError) {
        throw error;
      }
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
