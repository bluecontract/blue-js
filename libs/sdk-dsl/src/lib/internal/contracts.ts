import { BlueNode } from '@blue-labs/language';

import type { TypeInput } from '../types.js';
import { toBlueNode } from './node-input.js';
import { resolveTypeInput } from './type-input.js';

export const TYPE_ALIASES = {
  defaultChannel: 'Core/Channel',
  lifecycleEventChannel: 'Core/Lifecycle Event Channel',
  triggeredEventChannel: 'Core/Triggered Event Channel',
  documentUpdateChannel: 'Core/Document Update Channel',
  documentProcessingInitiated: 'Core/Document Processing Initiated',
  documentUpdate: 'Core/Document Update',
  compositeChannel: 'Conversation/Composite Timeline Channel',
  documentSection: 'Conversation/Document Section',
  operation: 'Conversation/Operation',
  sequentialWorkflow: 'Conversation/Sequential Workflow',
  sequentialWorkflowOperation: 'Conversation/Sequential Workflow Operation',
  javascriptCode: 'Conversation/JavaScript Code',
  updateDocument: 'Conversation/Update Document',
  triggerEvent: 'Conversation/Trigger Event',
  namedEvent: 'Common/Named Event',
  documentBootstrapRequested: 'Conversation/Document Bootstrap Requested',
} as const;

function ensureProperties(node: BlueNode): Record<string, BlueNode> {
  const existing = node.getProperties();
  if (existing) {
    return existing;
  }
  const created: Record<string, BlueNode> = {};
  node.setProperties(created);
  return created;
}

export function ensureContracts(document: BlueNode): Record<string, BlueNode> {
  const existing = document.getContracts();
  if (existing) {
    return existing;
  }
  const created: Record<string, BlueNode> = {};
  document.setContracts(created);
  return created;
}

export function buildDefaultChannelContract(): BlueNode {
  return new BlueNode().setType(resolveTypeInput(TYPE_ALIASES.defaultChannel));
}

export function buildCompositeChannelContract(channelKeys: string[]): BlueNode {
  return new BlueNode()
    .setType(resolveTypeInput(TYPE_ALIASES.compositeChannel))
    .addProperty(
      'channels',
      new BlueNode().setItems(
        channelKeys.map((channelKey) => new BlueNode().setValue(channelKey)),
      ),
    );
}

export function buildLifecycleEventChannelContract(eventType?: BlueNode): BlueNode {
  const channel = new BlueNode().setType(
    resolveTypeInput(TYPE_ALIASES.lifecycleEventChannel),
  );
  if (eventType) {
    channel.addProperty('event', new BlueNode().setType(eventType.clone()));
  }
  return channel;
}

export function buildTriggeredEventChannelContract(): BlueNode {
  return new BlueNode().setType(
    resolveTypeInput(TYPE_ALIASES.triggeredEventChannel),
  );
}

export function buildDocumentUpdateChannelContract(path: string): BlueNode {
  return new BlueNode()
    .setType(resolveTypeInput(TYPE_ALIASES.documentUpdateChannel))
    .addProperty('path', new BlueNode().setValue(path));
}

export function buildSequentialWorkflowContract(
  channelKey: string,
  steps: BlueNode[],
  eventNode?: BlueNode,
): BlueNode {
  const workflow = new BlueNode()
    .setType(resolveTypeInput(TYPE_ALIASES.sequentialWorkflow))
    .addProperty('channel', new BlueNode().setValue(channelKey))
    .addProperty(
      'steps',
      new BlueNode().setItems(steps.map((step) => step.clone())),
    );
  if (eventNode) {
    workflow.addProperty('event', eventNode.clone());
  }
  return workflow;
}

export function mergeSpecialization(
  base: BlueNode | undefined,
  specialization: BlueNode,
): BlueNode {
  if (!base) {
    return specialization.clone();
  }

  const merged = base.clone();
  if (specialization.getName() !== undefined) {
    merged.setName(specialization.getName());
  }
  if (specialization.getDescription() !== undefined) {
    merged.setDescription(specialization.getDescription());
  }
  if (specialization.getType() !== undefined) {
    merged.setType(specialization.getType()?.clone());
  }
  if (specialization.getItemType() !== undefined) {
    merged.setItemType(specialization.getItemType()?.clone());
  }
  if (specialization.getKeyType() !== undefined) {
    merged.setKeyType(specialization.getKeyType()?.clone());
  }
  if (specialization.getValueType() !== undefined) {
    merged.setValueType(specialization.getValueType()?.clone());
  }
  if (specialization.getValue() !== undefined) {
    merged.setValue(specialization.getValue() ?? null);
  }
  if (specialization.getBlueId() !== undefined) {
    merged.setBlueId(specialization.getBlueId());
  }
  if (specialization.getBlue() !== undefined) {
    merged.setBlue(specialization.getBlue()?.clone());
  }
  if (specialization.getItems() !== undefined) {
    merged.setItems(
      specialization.getItems()?.map((item: BlueNode) => item.clone()) ??
        undefined,
    );
  }
  const specializationProperties = specialization.getProperties();
  if (specializationProperties) {
    const mergedProperties = ensureProperties(merged);
    for (const [key, value] of Object.entries(
      specializationProperties,
    ) as Array<[string, BlueNode]>) {
      mergedProperties[key] = value.clone();
    }
  }
  return merged;
}

export function getImplementationContractKey(operationKey: string): string {
  return `${operationKey}Impl`;
}

export function ensureOperationContract(
  contracts: Record<string, BlueNode>,
  operationKey: string,
): BlueNode {
  const existing = contracts[operationKey];
  if (existing) {
    existing.setType(resolveTypeInput(TYPE_ALIASES.operation));
    return existing;
  }

  const created = new BlueNode().setType(
    resolveTypeInput(TYPE_ALIASES.operation),
  );
  contracts[operationKey] = created;
  return created;
}

export function getOperationChannel(operation: BlueNode): string | undefined {
  const value = operation.getProperties()?.channel?.getValue();
  return typeof value === 'string' ? value : undefined;
}

export function setOperationChannel(
  operation: BlueNode,
  channelKey: string,
): void {
  ensureProperties(operation).channel = new BlueNode().setValue(channelKey);
}

export function setOperationDescription(
  operation: BlueNode,
  description: string,
): void {
  operation.setDescription(description);
}

export function setOperationRequestType(
  operation: BlueNode,
  requestType: TypeInput,
): void {
  const request = ensureOperationRequest(operation);
  request.setType(resolveTypeInput(requestType));
}

export function setOperationRequestNode(
  operation: BlueNode,
  requestNode: BlueNode,
): void {
  ensureProperties(operation).request = requestNode;
}

export function removeOperationRequest(operation: BlueNode): void {
  const properties = operation.getProperties();
  if (properties) {
    delete properties.request;
  }
}

export function ensureOperationRequest(operation: BlueNode): BlueNode {
  const properties = ensureProperties(operation);
  const existing = properties.request;
  if (existing) {
    return existing;
  }
  const created = new BlueNode();
  properties.request = created;
  return created;
}

export function setOperationRequestDescription(
  operation: BlueNode,
  description: string,
): void {
  const request = ensureOperationRequest(operation);
  request.setDescription(description);
}

export function appendOperationImplementationSteps(
  contracts: Record<string, BlueNode>,
  operationKey: string,
  steps: BlueNode[],
): BlueNode {
  const implementationKey = getImplementationContractKey(operationKey);
  const existing = contracts[implementationKey];
  const implementation =
    existing ??
    new BlueNode().setType(
      resolveTypeInput(TYPE_ALIASES.sequentialWorkflowOperation),
    );
  implementation.setType(
    resolveTypeInput(TYPE_ALIASES.sequentialWorkflowOperation),
  );
  ensureProperties(implementation).operation = new BlueNode().setValue(
    operationKey,
  );

  const properties = ensureProperties(implementation);
  const stepsNode = properties.steps ?? new BlueNode().setItems([]);
  if (!stepsNode.getItems()) {
    stepsNode.setItems([]);
  }
  const items = stepsNode.getItems();
  if (!items) {
    throw new Error('Implementation steps array could not be created.');
  }
  items.push(...steps.map((step) => step.clone()));
  properties.steps = stepsNode;
  contracts[implementationKey] = implementation;
  return implementation;
}

export function toSpecializedContractNode(input: unknown): BlueNode {
  return toBlueNode(input as never);
}
