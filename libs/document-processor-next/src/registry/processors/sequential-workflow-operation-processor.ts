import type { Blue } from '@blue-labs/language';
import {
  blueIds as conversationBlueIds,
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
import {
  WorkflowStepRunner,
  DEFAULT_STEP_EXECUTORS,
  type SequentialWorkflowStepExecutor,
} from './workflow/step-runner.js';
import { extractOperationChannelKey } from './utils/operation-utils.js';
import {
  isOperationRequestForContract,
  loadOperation,
  channelsCompatible,
  isRequestTypeCompatible,
  isPinnedDocumentAllowed,
} from './workflow/operation-matcher.js';
export class SequentialWorkflowOperationProcessor
  implements HandlerProcessor<SequentialWorkflowOperation>
{
  readonly kind = 'handler' as const;
  readonly blueIds = [
    conversationBlueIds['Sequential Workflow Operation'],
  ] as const;
  readonly schema = sequentialWorkflowOperationSchema;

  private readonly runner: WorkflowStepRunner;

  constructor(
    executors: readonly SequentialWorkflowStepExecutor[] = DEFAULT_STEP_EXECUTORS,
  ) {
    this.runner = new WorkflowStepRunner(executors);
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
    return extractOperationChannelKey(operation);
  }

  async matches(
    contract: SequentialWorkflowOperation,
    context: ContractProcessorContext,
  ): Promise<boolean> {
    const eventNode = context.event();
    if (!eventNode) {
      return false;
    }

    if (!isOperationRequestForContract(contract, eventNode, context)) {
      return false;
    }

    const loadedOperation = loadOperation(contract, context);
    if (!loadedOperation) {
      return false;
    }

    const rawHandlerChannel =
      typeof contract.channel === 'string' ? contract.channel.trim() : '';
    const handlerChannel =
      rawHandlerChannel.length > 0 ? rawHandlerChannel : null;

    if (!channelsCompatible(loadedOperation.channelKey, handlerChannel)) {
      return false;
    }

    if (
      !isRequestTypeCompatible(
        eventNode,
        loadedOperation.operationNode,
        context.blue,
      )
    ) {
      return false;
    }

    const request = context.blue.nodeToSchemaOutput(
      eventNode,
      OperationRequestSchema,
    );
    if (
      request?.allowNewerVersion === false &&
      !isPinnedDocumentAllowed(request, eventNode, context)
    ) {
      return false;
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

    await this.runner.run({
      workflow: contract as SequentialWorkflow,
      eventNode,
      context,
    });
  }
}
