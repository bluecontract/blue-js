import type { Blue, BlueNode } from '@blue-labs/language';
import {
  OperationRequestSchema,
  type OperationRequest,
} from '@blue-repository/types/packages/coordination/schemas/OperationRequest';
import { OperationSchema } from '@blue-repository/types/packages/coordination/schemas/Operation';

import {
  sequentialWorkflowOperationSchema,
  type SequentialWorkflow,
  type SequentialWorkflowOperation,
} from '../../model/index.js';
import { conversationBlueIds } from '../../repository/semantic-repository.js';
import type {
  ContractProcessorContext,
  HandlerExecutionMetadata,
  HandlerProcessor,
} from '../types.js';
import type { JsonPatch } from '../../model/shared/json-patch.js';
import type { ScopeContractsIndex } from '../../types/scope-contracts.js';
import {
  WorkflowStepRunner,
  DEFAULT_STEP_EXECUTORS,
  type SequentialWorkflowStepExecutor,
} from './workflow/step-runner.js';
import { extractOperationChannelKey } from './utils/operation-utils.js';
import {
  channelsCompatible,
  extractOperationRequestNode,
  isOperationRequestForContract,
  isPinnedDocumentAllowed,
  isRequestTypeCompatible,
  loadOperation,
} from './workflow/operation-matcher.js';
import { matchesActorPolicyForOperation } from './workflow/actor-policy.js';
export class SequentialWorkflowOperationProcessor implements HandlerProcessor<SequentialWorkflowOperation> {
  readonly kind = 'handler' as const;
  readonly blueIds = [
    conversationBlueIds['Conversation/Sequential Workflow Operation'],
    conversationBlueIds['Conversation/Change Workflow'],
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

    const operationRequestNode = context.measure(
      'operation.match.extractRequest',
      () => extractOperationRequestNode(eventNode, context.blue),
    );
    if (!operationRequestNode) {
      return false;
    }

    const request = context.measure('operation.match.parseRequest', () =>
      context.blue.nodeToSchemaOutput<OperationRequest>(
        operationRequestNode,
        OperationRequestSchema,
      ),
    );
    if (!request) {
      return false;
    }

    if (
      !context.measure('operation.match.contractKey', () =>
        isOperationRequestForContract(contract, eventNode, request, context),
      )
    ) {
      return false;
    }

    const loadedOperation = context.measure(
      'operation.match.loadOperation',
      () => loadOperation(contract, context),
    );
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
      !context.measure('operation.match.requestTypeCompatible', () =>
        isRequestTypeCompatible(
          operationRequestNode,
          loadedOperation.operationNode,
          context.blue,
        ),
      )
    ) {
      return false;
    }

    if (
      request?.allowNewerVersion === false &&
      !isPinnedDocumentAllowed(request, operationRequestNode, context)
    ) {
      return false;
    }

    const operationKey = contract.operation;
    if (!operationKey) {
      return false;
    }

    if (
      !context.measure('operation.match.actorPolicy', () =>
        matchesActorPolicyForOperation(operationKey, eventNode, context),
      )
    ) {
      return false;
    }

    return true;
  }

  async execute(
    contract: SequentialWorkflowOperation,
    context: ContractProcessorContext,
    metadata?: HandlerExecutionMetadata,
  ): Promise<void> {
    const eventNode = context.event();
    if (!eventNode) {
      return;
    }

    if (this.isChangeWorkflow(metadata?.contractNode, context.blue)) {
      await this.applyChangeRequest(eventNode, context);
      return;
    }

    await this.runner.run({
      workflow: contract as SequentialWorkflow,
      eventNode,
      context,
      contractNode: metadata?.contractNode ?? null,
    });
  }

  private isChangeWorkflow(
    contractNode: BlueNode | null | undefined,
    blue: Blue,
  ): boolean {
    return (
      contractNode !== null &&
      contractNode !== undefined &&
      blue.isTypeOfBlueId(
        contractNode,
        conversationBlueIds['Conversation/Change Workflow'],
      )
    );
  }

  private async applyChangeRequest(
    eventNode: BlueNode,
    context: ContractProcessorContext,
  ): Promise<void> {
    const operationRequestNode = extractOperationRequestNode(
      eventNode,
      context.blue,
    );
    const requestNode = operationRequestNode?.getProperties()?.request;
    const changesetNode = requestNode?.getProperties()?.changeset;
    const changes = changesetNode?.getItems() ?? [];
    for (const change of changes) {
      await context.applyPatch(this.changeNodeToPatch(change, context));
    }
  }

  private changeNodeToPatch(
    change: BlueNode,
    context: ContractProcessorContext,
  ): JsonPatch {
    const fields = change.getProperties() ?? {};
    const rawOp = fields.op?.getValue();
    const opText = typeof rawOp === 'string' ? rawOp : 'replace';
    const op = opText.toUpperCase();
    const path = fields.path?.getValue();
    if (typeof path !== 'string' || path.trim().length === 0) {
      return context.throwFatal(
        'Change Request changeset entry requires a path',
      );
    }
    const absolutePath = context.resolvePointer(path);
    if (op === 'REMOVE') {
      return { op, path: absolutePath };
    }
    if (op !== 'ADD' && op !== 'REPLACE') {
      return context.throwFatal(
        `Unsupported Change Request operation "${opText}"`,
      );
    }
    const val = fields.val;
    if (!val) {
      return context.throwFatal(
        `${op} Change Request operation must include a value`,
      );
    }
    return { op, path: absolutePath, val };
  }
}
