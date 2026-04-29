import { BlueNode } from '@blue-labs/language';
import { isNullable } from '@blue-labs/shared-utils';

import type { ContractProcessorContext } from '../../types.js';
import type { SequentialWorkflow } from '../../../model/index.js';
import { TriggerEventStepExecutor } from '../steps/trigger-event-step-executor.js';
import { JavaScriptCodeStepExecutor } from '../steps/javascript-code-step-executor.js';
import { JavaScriptModuleStepExecutor } from '../steps/javascript-module-step-executor.js';
import { UpdateDocumentStepExecutor } from '../steps/update-document-step-executor.js';
import {
  BlueQuickJsEngine,
  type JavaScriptEvaluationEngine,
} from '../../../util/expression/javascript-evaluation-engine.js';

export type StepResultMap = Record<string, unknown>;

export interface StepExecutionArgs {
  readonly workflow: SequentialWorkflow;
  readonly stepNode: BlueNode;
  readonly eventNode: BlueNode;
  readonly context: ContractProcessorContext;
  readonly stepResults: StepResultMap;
  readonly stepIndex: number;
  readonly contractNode: BlueNode | null;
}

export interface SequentialWorkflowStepExecutor {
  readonly supportedBlueIds: readonly string[];
  readonly supportedTypeNames?: readonly string[];
  execute(args: StepExecutionArgs): unknown | Promise<unknown>;
}

const DEFAULT_JAVASCRIPT_ENGINE = new BlueQuickJsEngine();

export function createDefaultStepExecutors(
  engine: JavaScriptEvaluationEngine = DEFAULT_JAVASCRIPT_ENGINE,
): readonly SequentialWorkflowStepExecutor[] {
  return [
    new TriggerEventStepExecutor(engine),
    new JavaScriptCodeStepExecutor(engine),
    new JavaScriptModuleStepExecutor(engine),
    new UpdateDocumentStepExecutor(engine),
  ];
}

export const DEFAULT_STEP_EXECUTORS: readonly SequentialWorkflowStepExecutor[] =
  createDefaultStepExecutors();

export class WorkflowStepRunner {
  private readonly executorIndex: ReadonlyMap<
    string,
    SequentialWorkflowStepExecutor
  >;
  private readonly executorNameIndex: ReadonlyMap<
    string,
    SequentialWorkflowStepExecutor
  >;

  constructor(
    executors: readonly SequentialWorkflowStepExecutor[] = DEFAULT_STEP_EXECUTORS,
  ) {
    const byId = new Map<string, SequentialWorkflowStepExecutor>();
    for (const executor of executors) {
      for (const blueId of executor.supportedBlueIds) {
        byId.set(blueId, executor);
      }
    }
    const byName = new Map<string, SequentialWorkflowStepExecutor>();
    for (const executor of executors) {
      for (const typeName of executor.supportedTypeNames ?? []) {
        byName.set(typeName, executor);
      }
    }
    this.executorIndex = byId;
    this.executorNameIndex = byName;
  }

  async run(args: {
    workflow: SequentialWorkflow;
    eventNode: BlueNode;
    context: ContractProcessorContext;
    contractNode: BlueNode | null;
  }): Promise<StepResultMap> {
    const { workflow, eventNode, context, contractNode } = args;

    const steps = workflow.steps ?? [];
    if (steps.length === 0) {
      return {};
    }

    const results: StepResultMap = {};
    for (const [index, stepNode] of steps.entries()) {
      const stepType = stepNode.getType?.();
      const blueId = stepType?.getBlueId();
      const typeName = stepType?.getName?.();
      if (isNullable(blueId) && isNullable(typeName)) {
        return context.throwFatal(
          'Sequential workflow step is missing type metadata',
        );
      }

      const executor =
        (blueId ? this.executorIndex.get(blueId) : undefined) ??
        (typeName ? this.executorNameIndex.get(typeName) : undefined);
      if (isNullable(executor)) {
        const displayName = typeName ?? blueId;
        return context.throwFatal(
          `Unsupported workflow step type "${displayName}"`,
        );
      }

      const stepArgs: StepExecutionArgs = {
        workflow,
        stepNode,
        eventNode,
        context,
        stepResults: results,
        stepIndex: index,
        contractNode,
      };
      const result = await executor.execute(stepArgs);
      if (result !== undefined) {
        const key = this.stepResultKey(stepNode, index);
        results[key] = result;
      }
    }

    return results;
  }

  private stepResultKey(stepNode: BlueNode, index: number): string {
    const name = stepNode.getName?.();
    if (name && typeof name === 'string' && name.length > 0) {
      return name;
    }
    return `Step${index + 1}`;
  }
}
