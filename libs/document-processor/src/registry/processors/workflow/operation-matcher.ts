import { BlueNode, Properties } from '@blue-labs/language';
import type { Blue } from '@blue-labs/language';
import {
  OperationRequestSchema,
  type OperationRequest,
} from '@blue-repository/types/packages/coordination/schemas/OperationRequest';
import {
  OperationSchema,
  type Operation,
} from '@blue-repository/types/packages/coordination/schemas/Operation';
import { TimelineEntrySchema } from '@blue-repository/types/packages/coordination/schemas/TimelineEntry';

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
    !context.blue.isTypeOf(operationNode, OperationSchema, {
      checkSchemaExtensions: true,
    })
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
  if (!(requiredType instanceof BlueNode)) {
    return true;
  }
  if (isDocumentationOnlyMatcher(requiredType)) {
    return true;
  }
  if (!(requestPayload instanceof BlueNode)) {
    return false;
  }
  if (
    isUnconstrainedCoreCollectionMatch(requestPayload, requiredType) ||
    blue.isTypeOfNode(requestPayload, requiredType) ||
    isSimpleTypedPayloadMatch(requestPayload, requiredType, blue)
  ) {
    return true;
  }
  return false;
}

function isSimpleTypedPayloadMatch(
  requestPayload: BlueNode,
  requiredType: BlueNode,
  blue: Blue,
): boolean {
  if (hasMatcherShapeBeyondType(requiredType)) {
    return false;
  }

  const requiredNodeType = requiredType.getType();
  if (!(requiredNodeType instanceof BlueNode)) {
    return false;
  }

  const requiredBlueId = requiredNodeType.getBlueId();
  if (typeof requiredBlueId === 'string' && requiredBlueId.length > 0) {
    return blue.isTypeOfBlueId(requestPayload, requiredBlueId);
  }

  if (
    requiredNodeType.getType() !== undefined ||
    requiredNodeType.getBlueId() !== undefined
  ) {
    return blue.isTypeOfNode(requestPayload, requiredNodeType);
  }

  return false;
}

function hasMatcherShapeBeyondType(node: BlueNode): boolean {
  return (
    node.getBlueId() !== undefined ||
    node.getItemType() !== undefined ||
    node.getKeyType() !== undefined ||
    node.getValueType() !== undefined ||
    node.getValue() !== undefined ||
    node.getItems() !== undefined ||
    node.getProperties() !== undefined
  );
}

function isDocumentationOnlyMatcher(node: BlueNode): boolean {
  return (
    node.getType() === undefined &&
    node.getBlueId() === undefined &&
    node.getItemType() === undefined &&
    node.getKeyType() === undefined &&
    node.getValueType() === undefined &&
    node.getValue() === undefined &&
    node.getItems() === undefined &&
    node.getProperties() === undefined &&
    node.getContractsNode() === undefined &&
    node.getSchema() === undefined &&
    node.getMergePolicy() === undefined &&
    node.getPreviousBlueId() === undefined &&
    node.getPosition() === undefined &&
    node.getBlue() === undefined
  );
}

function isUnconstrainedCoreCollectionMatch(
  requestPayload: BlueNode,
  requiredType: BlueNode,
): boolean {
  const requiredTypeBlueId = requiredType.getType()?.getBlueId();
  if (
    requiredTypeBlueId === Properties.LIST_TYPE_BLUE_ID &&
    requiredType.getItemType() === undefined &&
    requiredType.getItems() === undefined &&
    requestPayload.getItems() !== undefined
  ) {
    return true;
  }
  if (
    requiredTypeBlueId === Properties.DICTIONARY_TYPE_BLUE_ID &&
    requiredType.getKeyType() === undefined &&
    requiredType.getValueType() === undefined &&
    requiredType.getProperties() === undefined &&
    requestPayload.getProperties() !== undefined
  ) {
    return true;
  }
  return false;
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
