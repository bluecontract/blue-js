import { BlueNode } from '@blue-labs/language';
import type { Blue } from '@blue-labs/language';
import { isNullable } from '@blue-labs/shared-utils';
import {
  blueIds as conversationBlueIds,
  Operation,
  type OperationRequest,
  OperationRequestSchema,
  OperationSchema,
} from '@blue-repository/conversation';

import {
  sequentialWorkflowOperationSchema,
  type SequentialWorkflow,
  type SequentialWorkflowOperation,
} from '../../model/index.js';
import type { ContractProcessorContext, HandlerProcessor } from '../types.js';
import type { ScopeContractsIndex } from '../../types/scope-contracts.js';
import type {
  SequentialWorkflowStepExecutor,
  StepExecutionArgs,
} from './sequential-workflow-processor.js';
import { TriggerEventStepExecutor } from './steps/trigger-event-step-executor.js';
import { JavaScriptCodeStepExecutor } from './steps/javascript-code-step-executor.js';
import { UpdateDocumentStepExecutor } from './steps/update-document-step-executor.js';

type StepResultMap = Record<string, unknown>;

const DEFAULT_STEP_EXECUTORS: readonly SequentialWorkflowStepExecutor[] = [
  new TriggerEventStepExecutor(),
  new JavaScriptCodeStepExecutor(),
  new UpdateDocumentStepExecutor(),
];

export class SequentialWorkflowOperationProcessor
  implements HandlerProcessor<SequentialWorkflowOperation>
{
  readonly kind = 'handler' as const;
  readonly blueIds = [
    conversationBlueIds['Sequential Workflow Operation'],
  ] as const;
  readonly schema = sequentialWorkflowOperationSchema;

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

  deriveChannel(
    contract: SequentialWorkflowOperation,
    deps: {
      blue: Blue;
      scopeContracts: ScopeContractsIndex;
    },
  ): string | null | undefined {
    const operationKey = contract.operation;
    if (!operationKey) {
      return null;
    }
    const entry = deps.scopeContracts.get(operationKey);
    if (!entry) {
      return null;
    }
    if (
      !deps.blue.isTypeOf(entry.node, OperationSchema, {
        checkSchemaExtensions: true,
      })
    ) {
      return null;
    }
    const operation = deps.blue.nodeToSchemaOutput(entry.node, OperationSchema);
    if (!operation) {
      return null;
    }
    return this.extractOperationChannelKey(operation);
  }

  async matches(
    contract: SequentialWorkflowOperation,
    context: ContractProcessorContext,
  ): Promise<boolean> {
    const eventNode = context.event();
    if (!eventNode) {
      return false;
    }
    const { blue } = context;

    if (
      !blue.isTypeOf(eventNode, OperationRequestSchema, {
        checkSchemaExtensions: true,
      })
    ) {
      return false;
    }

    let request: OperationRequest | null = null;
    try {
      request = blue.nodeToSchemaOutput(eventNode, OperationRequestSchema);
    } catch {
      return false;
    }
    if (!request) {
      return false;
    }

    const operationKey = contract.operation;
    if (!operationKey || request?.operation !== operationKey) {
      return false;
    }

    if (
      contract.event &&
      !this.matchesEventPattern(contract.event, eventNode, context)
    ) {
      return false;
    }

    const operationPointer = context.resolvePointer(
      `/contracts/${operationKey}`,
    );
    const operationNode = context.documentAt(operationPointer);
    if (!operationNode) {
      return false;
    }
    if (!(operationNode instanceof BlueNode)) {
      return false;
    }
    if (!blue.isTypeOf(operationNode, OperationSchema)) {
      return false;
    }
    const operation = context.blue.nodeToSchemaOutput(
      operationNode,
      OperationSchema,
    );
    if (!operation) {
      return false;
    }
    const operationChannelKey = this.extractOperationChannelKey(operation);
    const rawHandlerChannel =
      typeof contract.channel === 'string' ? contract.channel.trim() : '';
    const handlerChannel =
      rawHandlerChannel.length > 0 ? rawHandlerChannel : null;
    if (
      operationChannelKey &&
      handlerChannel &&
      operationChannelKey !== handlerChannel
    ) {
      return false;
    }

    const requestNode = eventNode.getProperties()?.request;
    const requiredType = operationNode.getProperties()?.request;
    if (
      !(requestNode instanceof BlueNode) ||
      !(requiredType instanceof BlueNode)
    ) {
      return false;
    }

    try {
      if (!blue.isTypeOfNode(requestNode, requiredType)) {
        return false;
      }
    } catch {
      return false;
    }

    if (request.allowNewerVersion === false) {
      const pinnedBlueId = this.extractPinnedDocumentBlueId(eventNode, context);
      if (pinnedBlueId) {
        const scopeRootPointer = context.resolvePointer('/');
        const scopeRoot = context.documentAt(scopeRootPointer);
        if (!scopeRoot) {
          return false;
        }
        const contractsNode = scopeRoot.getProperties()?.contracts;
        const initializedNode =
          contractsNode?.getProperties()?.initialized ?? null;
        const documentIdNode =
          initializedNode?.getProperties()?.documentId ?? null;
        const storedBlueId = documentIdNode?.getValue?.();
        const expectedBlueId =
          typeof storedBlueId === 'string' && storedBlueId.length > 0
            ? storedBlueId
            : blue.calculateBlueIdSync(scopeRoot);
        if (pinnedBlueId !== expectedBlueId) {
          return false;
        }
      }
    }

    return true;
  }

  async execute(
    contract: SequentialWorkflowOperation,
    context: ContractProcessorContext,
  ): Promise<void> {
    const eventNode = context.event();
    if (!eventNode) {
      return;
    }
    const steps = contract.steps ?? [];
    if (steps.length === 0) {
      return;
    }

    const stepResults: StepResultMap = {};
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
        workflow: contract as SequentialWorkflow,
        stepNode,
        eventNode,
        context,
        stepResults,
        stepIndex: index,
      };
      const result = await executor.execute(stepArgs);
      if (result !== undefined) {
        const key = this.stepResultKey(stepNode, index);
        stepResults[key] = result;
      }
    }
  }

  private extractOperationChannelKey(operation: Operation): string | null {
    const channelKey = operation.channel;

    if (typeof channelKey === 'string') {
      const trimmed = channelKey.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }

    return null;
  }

  private matchesEventPattern(
    matcher: BlueNode,
    eventNode: BlueNode,
    context: ContractProcessorContext,
  ): boolean {
    try {
      return context.blue.isTypeOfNode(eventNode, matcher);
    } catch (error) {
      console.warn(
        'SequentialWorkflowOperationProcessor event match failed',
        error,
      );
      return false;
    }
  }

  private extractPinnedDocumentBlueId(
    eventNode: BlueNode,
    context: ContractProcessorContext,
  ): string | null {
    const documentNode = eventNode.getProperties()?.document;
    if (!(documentNode instanceof BlueNode)) {
      return null;
    }
    const json = context.blue.nodeToJson(documentNode);
    const blueIdFromJson =
      json && typeof json === 'object'
        ? (json as Record<string, unknown>).blueId
        : null;
    if (
      typeof blueIdFromJson === 'string' &&
      blueIdFromJson.trim().length > 0
    ) {
      return blueIdFromJson;
    }
    const blueIdNode = documentNode.getProperties()?.blueId;
    const value = blueIdNode?.getValue();
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private stepResultKey(stepNode: BlueNode, index: number): string {
    const name = stepNode.getName?.();
    if (name && typeof name === 'string' && name.length > 0) {
      return name;
    }
    return `Step${index + 1}`;
  }
}
