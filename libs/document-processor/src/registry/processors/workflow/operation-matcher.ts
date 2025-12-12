import { BlueNode } from '@blue-labs/language';
import type { Blue } from '@blue-labs/language';
import {
  OperationRequestSchema,
  OperationSchema,
  TimelineEntrySchema,
} from '@blue-repository/conversation';
import type {
  Operation,
  OperationRequest,
} from '@blue-repository/conversation';

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

export function extractOperationRequestNode(
  eventNode: BlueNode,
  blue: Blue,
): BlueNode | null {
  if (
    blue.isTypeOf(eventNode, OperationRequestSchema, {
      checkSchemaExtensions: true,
    })
  ) {
    return eventNode;
  }

  if (
    blue.isTypeOf(eventNode, TimelineEntrySchema, {
      checkSchemaExtensions: true,
    })
  ) {
    const entry = blue.nodeToSchemaOutput(eventNode, TimelineEntrySchema);
    const messageNode = entry.message as BlueNode | undefined;
    if (
      messageNode &&
      blue.isTypeOf(messageNode, OperationRequestSchema, {
        checkSchemaExtensions: true,
      })
    ) {
      return messageNode;
    }
  }

  return null;
}

export function isOperationRequestForContract(
  contract: SequentialWorkflowOperation,
  eventNode: BlueNode,
  request: OperationRequest,
  context: ContractProcessorContext,
): boolean {
  const { blue } = context;

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
  requestNode: BlueNode,
  operationNode: BlueNode,
  blue: Blue,
): boolean {
  const requestPayload = requestNode.getProperties()?.request;
  const requiredType = operationNode.getProperties()?.request;
  if (
    !(requestPayload instanceof BlueNode) ||
    !(requiredType instanceof BlueNode)
  ) {
    return false;
  }
  try {
    if (!blue.isTypeOfNode(requestPayload, requiredType)) {
      return false;
    }
  } catch {
    return false;
  }
  return true;
}

export function isPinnedDocumentAllowed(
  request: { allowNewerVersion?: boolean } | null | undefined,
  requestNode: BlueNode,
  context: ContractProcessorContext,
): boolean {
  if (!request || request.allowNewerVersion !== false) {
    return true;
  }

  const pinnedBlueId = extractPinnedDocumentBlueId(requestNode, context);
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
