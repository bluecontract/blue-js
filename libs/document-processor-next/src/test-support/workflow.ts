import { Blue, BlueNode } from '@blue-labs/language';
import { ContractProcessorRegistryBuilder } from '../registry/contract-processor-registry-builder.js';
import { ContractLoader } from '../engine/contract-loader.js';
import {
  ProcessorEngine,
  ProcessorExecution,
} from '../engine/processor-engine.js';
import { ContractBundle } from '../engine/contract-bundle.js';
import type { SequentialWorkflow } from '../model/handlers/sequential-workflow.js';
import type { ContractProcessorContext } from '../registry/types.js';
import type { StepExecutionArgs } from '../registry/processors/sequential-workflow-processor.js';

export function createRealContext(
  blue: Blue,
  eventNode: BlueNode,
  document?: BlueNode | null,
): {
  execution: ProcessorExecution;
  bundle: ContractBundle;
  context: ContractProcessorContext;
} {
  const registry = ContractProcessorRegistryBuilder.create().build();
  const loader = new ContractLoader(registry, blue);
  const engine = new ProcessorEngine(loader, registry, blue);
  const root = (document ?? new BlueNode()).clone();
  const execution = engine.createExecution(root);
  execution.loadBundles('/');
  const bundle = execution.bundleForScope('/') ?? ContractBundle.empty();
  const context = execution.createContext(
    '/',
    bundle,
    eventNode.clone(),
    false,
    false,
  );
  return { execution, bundle, context };
}

export function createArgs(options: {
  context: ContractProcessorContext;
  stepNode: BlueNode;
  eventNode: BlueNode;
  stepResults?: Record<string, unknown>;
  stepIndex?: number;
}): StepExecutionArgs {
  const {
    context,
    stepNode,
    eventNode,
    stepResults = {},
    stepIndex = 0,
  } = options;

  const workflow = { steps: [] } as SequentialWorkflow;

  return {
    workflow,
    stepNode,
    eventNode,
    context,
    stepResults,
    stepIndex,
  };
}
