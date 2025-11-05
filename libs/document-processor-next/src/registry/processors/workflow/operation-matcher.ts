import { BlueNode } from '@blue-labs/language';
import type { Blue } from '@blue-labs/language';
import {
  OperationRequestSchema,
  OperationSchema,
} from '@blue-repository/conversation';
import type { Operation } from '@blue-repository/conversation';

import type { ContractProcessorContext } from '../../types.js';
import type { SequentialWorkflowOperation } from '../../../model/index.js';
import {
  extractOperationChannelKey,
  extractPinnedDocumentBlueId,
} from '../utils/operation-utils.js';

export type LoadedOperation = {
  operationNode: BlueNode;
  operation: Operation;
  channelKey: string | null;
};

export function isOperationRequestForContract(
  contract: SequentialWorkflowOperation,
  eventNode: BlueNode,
  context: ContractProcessorContext,
): boolean {
  const { blue } = context;

  if (
    !blue.isTypeOf(eventNode, OperationRequestSchema, {
      checkSchemaExtensions: true,
    })
  ) {
    return false;
  }

  const request = blue.nodeToSchemaOutput(eventNode, OperationRequestSchema);
  const operationKey = contract.operation;
  if (!operationKey || request.operation !== operationKey) {
    return false;
  }

  if (contract.event && !blue.isTypeOfNode(eventNode, contract.event)) {
    return false;
  }

  return true;
}

export function loadOperation(
  contract: SequentialWorkflowOperation,
  context: ContractProcessorContext,
): LoadedOperation | null {
  const operationKey = contract.operation;
  if (!operationKey) {
    return null;
  }

  const operationPointer = context.resolvePointer(`/contracts/${operationKey}`);
  const operationNode = context.documentAt(operationPointer);
  if (
    !operationNode ||
    !context.blue.isTypeOf(operationNode, OperationSchema)
  ) {
    return null;
  }

  const operation = context.blue.nodeToSchemaOutput(
    operationNode,
    OperationSchema,
  );
  const channelKey = extractOperationChannelKey(operation);
  return { operationNode, operation, channelKey };
}

export function channelsCompatible(
  operationChannelKey: string | null,
  handlerChannel: string | null,
): boolean {
  if (
    operationChannelKey &&
    handlerChannel &&
    operationChannelKey !== handlerChannel
  ) {
    return false;
  }
  return true;
}

export function isRequestTypeCompatible(
  eventNode: BlueNode,
  operationNode: BlueNode,
  blue: Blue,
): boolean {
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
  return true;
}

export function isPinnedDocumentAllowed(
  request: { allowNewerVersion?: boolean } | null | undefined,
  eventNode: BlueNode,
  context: ContractProcessorContext,
): boolean {
  if (!request || request.allowNewerVersion !== false) {
    return true;
  }

  const pinnedBlueId = extractPinnedDocumentBlueId(eventNode, context);
  if (!pinnedBlueId) {
    return true;
  }

  const scopeRootPointer = context.resolvePointer('/');
  const scopeRoot = context.documentAt(scopeRootPointer);
  if (!scopeRoot) {
    return false;
  }
  const scopeRootContracts = scopeRoot.getContracts();
  const initializedNode = scopeRootContracts?.initialized ?? null;
  const storedBlueId = initializedNode?.get('/documentId') ?? null;
  const expectedBlueId =
    typeof storedBlueId === 'string' && storedBlueId.length > 0
      ? storedBlueId
      : context.blue.calculateBlueIdSync(scopeRoot);

  return pinnedBlueId === expectedBlueId;
}
