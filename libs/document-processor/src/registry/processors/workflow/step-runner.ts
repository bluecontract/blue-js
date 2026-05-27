import { BlueNode } from '@blue-labs/language';
import type { BexEngine } from '@blue-labs/bex';
import { isNullable } from '@blue-labs/shared-utils';

import type { ContractProcessorContext } from '../../types.js';
import type { SequentialWorkflow } from '../../../model/index.js';
import { TriggerEventStepExecutor } from '../steps/trigger-event-step-executor.js';
import { BexComputeStepExecutor } from '../steps/bex-compute-step-executor.js';
import { JavaScriptCodeStepExecutor } from '../steps/javascript-code-step-executor.js';
import { UpdateDocumentStepExecutor } from '../steps/update-document-step-executor.js';

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
  execute(args: StepExecutionArgs): unknown | Promise<unknown>;
}

export interface WorkflowStepRunnerOptions {
  readonly bexEngine?: BexEngine;
}

export function createDefaultStepExecutors(
  options: WorkflowStepRunnerOptions = {},
): readonly SequentialWorkflowStepExecutor[] {
  return [
    new TriggerEventStepExecutor(options.bexEngine),
    new BexComputeStepExecutor(options.bexEngine),
    new JavaScriptCodeStepExecutor(),
    new UpdateDocumentStepExecutor(options.bexEngine),
  ];
}

export const DEFAULT_STEP_EXECUTORS: readonly SequentialWorkflowStepExecutor[] =
  createDefaultStepExecutors();

export class WorkflowStepRunner {
  private readonly executorIndex: ReadonlyMap<
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
    this.executorIndex = byId;
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
      const blueId = stepNode.getType?.()?.getBlueId();
      if (isNullable(blueId)) {
        return context.throwFatal(
          'Sequential workflow step is missing type metadata',
        );
      }

      const executor = this.executorIndex.get(blueId);
      if (isNullable(executor)) {
        const typeName = stepNode.getType?.()?.getName?.() ?? blueId;
        return context.throwFatal(
          `Unsupported workflow step type "${typeName}"`,
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
    if (
      name &&
      typeof name === 'string' &&
      name.length > 0 &&
      name !== stepNode.getType?.()?.getName?.()
    ) {
      return name;
    }
    return `Step${index + 1}`;
  }
}
