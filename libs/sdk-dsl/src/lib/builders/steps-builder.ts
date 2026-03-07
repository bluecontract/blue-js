import { BlueNode } from '@blue-labs/language';
import type { ZodTypeAny } from 'zod';

import type {
  BlueValueInput,
  BootstrapOptionsBuilderLike,
  ChannelBindingsInput,
  ChangesetBuilderLike,
  EventPatternInput,
  MyOsCallOperationRequestedOptions,
  MyOsSingleDocumentPermissionGrantRequestedOptions,
  MyOsSubscribeToSessionRequestedOptions,
  StepPayloadBuilder,
  TypeInput,
} from '../types';
import { BootstrapOptionsBuilder } from '../internal/bootstrap-options-builder';
import { ChangesetBuilder } from '../internal/changeset-builder';
import { isBlank, wrapExpression } from '../internal/expression';
import { NodeObjectBuilder } from '../internal/node-object-builder';
import { resolveTypeInput } from '../internal/type-input';
import { toBlueNode } from '../internal/value-to-node';

export class StepsBuilder {
  private readonly steps: BlueNode[] = [];

  jsRaw(name: string, code: string): this {
    const step = new BlueNode()
      .setName(requireNonEmpty(name, 'step name'))
      .setType(resolveTypeInput('Conversation/JavaScript Code'));
    step.addProperty('code', toBlueNode(code));
    this.steps.push(step);
    return this;
  }

  updateDocument(
    name: string,
    customizer: (changeset: ChangesetBuilderLike) => void,
  ): this {
    if (typeof customizer !== 'function') {
      throw new Error('changeset customizer is required');
    }

    const changeset = new ChangesetBuilder();
    customizer(changeset);
    return this.addUpdateDocumentStep(
      requireNonEmpty(name, 'step name'),
      new BlueNode().setItems(changeset.build()),
    );
  }

  updateDocumentFromExpression(name: string, expression: string): this {
    return this.addUpdateDocumentStep(
      requireNonEmpty(name, 'step name'),
      toBlueNode(wrapExpression(expression)),
    );
  }

  replaceValue(name: string, path: string, value: BlueValueInput): this {
    return this.updateDocument(name, (changeset) =>
      changeset.replaceValue(path, value),
    );
  }

  replaceExpression(name: string, path: string, expression: string): this {
    return this.updateDocument(name, (changeset) =>
      changeset.replaceExpression(path, expression),
    );
  }

  triggerEvent(name: string, eventNode: BlueNode): this {
    const step = new BlueNode()
      .setName(requireNonEmpty(name, 'step name'))
      .setType(resolveTypeInput('Conversation/Trigger Event'));
    step.addProperty('event', toBlueNode(eventNode));
    this.steps.push(step);
    return this;
  }

  emit(name: string, event: BlueValueInput): this {
    return this.triggerEvent(name, toBlueNode(event));
  }

  emitType(
    name: string,
    typeInput: TypeInput,
    payloadCustomizer?: (eventNode: StepPayloadBuilder) => void,
  ): this {
    const eventNode = NodeObjectBuilder.create().type(typeInput);
    payloadCustomizer?.(eventNode);
    return this.triggerEvent(name, eventNode.build());
  }

  namedEvent(name: string, eventName: string): this;
  namedEvent(
    name: string,
    eventName: string,
    payloadCustomizer: (payload: StepPayloadBuilder) => void,
  ): this;
  namedEvent(
    name: string,
    eventName: string,
    payloadCustomizer?: (payload: StepPayloadBuilder) => void,
  ): this {
    if (isBlank(eventName)) {
      throw new Error('eventName cannot be blank');
    }

    const eventNode = NodeObjectBuilder.create()
      .type('Common/Named Event')
      .put('name', eventName.trim());

    if (payloadCustomizer) {
      const payload = NodeObjectBuilder.create();
      payloadCustomizer(payload);
      const payloadNode = payload.build();
      if (hasMeaningfulContent(payloadNode)) {
        eventNode.putNode('payload', payloadNode);
      }
    }

    return this.triggerEvent(name, eventNode.build());
  }

  bootstrapDocument(
    stepName: string,
    documentNode: BlueValueInput,
    channelBindings: ChannelBindingsInput,
  ): this;
  bootstrapDocument(
    stepName: string,
    documentNode: BlueValueInput,
    channelBindings: ChannelBindingsInput,
    optionsCustomizer: (options: BootstrapOptionsBuilderLike) => void,
  ): this;
  bootstrapDocument(
    stepName: string,
    documentNode: BlueValueInput,
    channelBindings: ChannelBindingsInput,
    optionsCustomizer?: (options: BootstrapOptionsBuilderLike) => void,
  ): this {
    const eventNode = NodeObjectBuilder.create()
      .type('Conversation/Document Bootstrap Requested')
      .putNode('document', documentNode)
      .putStringMap('channelBindings', channelBindings);

    applyBootstrapOptions(eventNode, optionsCustomizer);
    return this.triggerEvent(stepName, eventNode.build());
  }

  bootstrapDocumentExpr(
    stepName: string,
    documentExpression: string,
    channelBindings: ChannelBindingsInput,
    optionsCustomizer?: (options: BootstrapOptionsBuilderLike) => void,
  ): this {
    if (isBlank(documentExpression)) {
      throw new Error('documentExpression cannot be blank');
    }

    const eventNode = NodeObjectBuilder.create()
      .type('Conversation/Document Bootstrap Requested')
      .putExpression('document', documentExpression)
      .putStringMap('channelBindings', channelBindings);

    applyBootstrapOptions(eventNode, optionsCustomizer);
    return this.triggerEvent(stepName, eventNode.build());
  }

  ext<TExtension>(
    extensionFactory: (steps: StepsBuilder) => TExtension,
  ): TExtension {
    if (extensionFactory == null) {
      throw new Error('extensionFactory cannot be null');
    }

    const extension = extensionFactory(this);
    if (extension == null) {
      throw new Error('extensionFactory cannot return null');
    }

    return extension;
  }

  myOs(): MyOsSteps {
    return this.ext((steps) => new MyOsSteps(steps));
  }

  raw(stepNode: BlueNode): this {
    this.steps.push(toBlueNode(stepNode));
    return this;
  }

  build(): BlueNode[] {
    return this.steps.map((step) => step.clone());
  }

  private addUpdateDocumentStep(name: string, changesetNode: BlueNode): this {
    const step = new BlueNode()
      .setName(name)
      .setType(resolveTypeInput('Conversation/Update Document'));
    step.addProperty('changeset', changesetNode);
    this.steps.push(step);
    return this;
  }
}

export class MyOsSteps {
  constructor(private readonly parent: StepsBuilder) {}

  singleDocumentPermissionGrantRequested(
    onBehalfOf: string,
    targetSessionId: BlueValueInput,
    permissions: BlueValueInput,
    options?: MyOsSingleDocumentPermissionGrantRequestedOptions,
  ): StepsBuilder {
    requireValueInput(targetSessionId, 'targetSessionId');
    if (permissions == null) {
      throw new Error('permissions is required');
    }

    const eventNode = NodeObjectBuilder.create()
      .type('MyOS/Single Document Permission Grant Requested')
      .put('onBehalfOf', requireNonEmpty(onBehalfOf, 'onBehalfOf'))
      .putNode('targetSessionId', targetSessionId)
      .putNode('permissions', permissions);

    putOptionalStepMetadata(eventNode, options);
    const requestId = normalizeOptional(options?.requestId);
    if (requestId) {
      eventNode.put('requestId', requestId);
    }

    return this.parent.triggerEvent(
      resolveStepName(options?.stepName, 'RequestSingleDocumentPermission'),
      eventNode.build(),
    );
  }

  subscribeToSessionRequested(
    targetSessionId: BlueValueInput,
    subscriptionId: string,
    options?: MyOsSubscribeToSessionRequestedOptions,
  ): StepsBuilder {
    requireValueInput(targetSessionId, 'targetSessionId');

    const subscription = NodeObjectBuilder.create().put(
      'id',
      requireNonEmpty(subscriptionId, 'subscriptionId'),
    );
    if (options?.events != null) {
      subscription.putNode(
        'events',
        new BlueNode().setItems(
          options.events.map((eventPattern) =>
            toEventPatternNode(eventPattern),
          ),
        ),
      );
    }

    const eventNode = NodeObjectBuilder.create()
      .type('MyOS/Subscribe to Session Requested')
      .putNode('targetSessionId', targetSessionId)
      .putNode('subscription', subscription.build());

    putOptionalStepMetadata(eventNode, options);
    const requestId = normalizeOptional(options?.requestId);
    if (requestId) {
      eventNode.put('requestId', requestId);
    }

    return this.parent.triggerEvent(
      resolveStepName(options?.stepName, 'SubscribeToSession'),
      eventNode.build(),
    );
  }

  callOperationRequested(
    onBehalfOf: string,
    targetSessionId: BlueValueInput,
    operation: string,
    request?: BlueValueInput,
    options?: MyOsCallOperationRequestedOptions,
  ): StepsBuilder {
    requireValueInput(targetSessionId, 'targetSessionId');

    const eventNode = NodeObjectBuilder.create()
      .type('MyOS/Call Operation Requested')
      .put('onBehalfOf', requireNonEmpty(onBehalfOf, 'onBehalfOf'))
      .putNode('targetSessionId', targetSessionId)
      .put('operation', requireNonEmpty(operation, 'operation'));

    if (request != null) {
      eventNode.putNode('request', request);
    }

    putOptionalStepMetadata(eventNode, options);
    const requestId = normalizeOptional(options?.requestId);
    if (requestId) {
      eventNode.put('requestId', requestId);
    }

    return this.parent.triggerEvent(
      resolveStepName(options?.stepName, 'CallOperation'),
      eventNode.build(),
    );
  }
}

function applyBootstrapOptions(
  payload: NodeObjectBuilder,
  optionsCustomizer?: (options: BootstrapOptionsBuilderLike) => void,
): void {
  if (!optionsCustomizer) {
    return;
  }

  const options = new BootstrapOptionsBuilder();
  optionsCustomizer(options);
  options.applyTo(payload);
}

function hasMeaningfulContent(node: BlueNode): boolean {
  return (
    node.getValue() !== undefined ||
    node.getBlueId() !== undefined ||
    node.getType() != null ||
    node.getName() != null ||
    node.getDescription() != null ||
    (node.getItems()?.length ?? 0) > 0 ||
    Object.keys(node.getProperties() ?? {}).length > 0
  );
}

function putOptionalStepMetadata(
  node: NodeObjectBuilder,
  options:
    | MyOsSingleDocumentPermissionGrantRequestedOptions
    | MyOsSubscribeToSessionRequestedOptions
    | MyOsCallOperationRequestedOptions
    | undefined,
): void {
  const name = normalizeOptional(options?.name);
  if (name) {
    node.put('name', name);
  }

  const description = normalizeOptional(options?.description);
  if (description) {
    node.put('description', description);
  }
}

function toEventPatternNode(eventPattern: EventPatternInput): BlueNode {
  if (eventPattern == null) {
    throw new Error('eventPattern cannot be null');
  }

  if (typeof eventPattern === 'string') {
    return new BlueNode().setType(resolveTypeInput(eventPattern));
  }

  if (eventPattern instanceof BlueNode) {
    return eventPattern.clone();
  }

  if (isBlueIdObject(eventPattern) || isLikelyZodSchema(eventPattern)) {
    return new BlueNode().setType(resolveTypeInput(eventPattern));
  }

  return toBlueNode(eventPattern as BlueValueInput);
}

function resolveStepName(
  provided: string | null | undefined,
  fallback: string,
): string {
  return normalizeOptional(provided) ?? fallback;
}

function normalizeOptional(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function requireValueInput(value: BlueValueInput, label: string): void {
  if (value == null) {
    throw new Error(`${label} is required`);
  }

  if (typeof value === 'string' && isBlank(value)) {
    throw new Error(`${label} is required`);
  }
}

function isBlueIdObject(value: unknown): value is { blueId: string } {
  return (
    value != null &&
    typeof value === 'object' &&
    'blueId' in value &&
    typeof (value as { blueId?: unknown }).blueId === 'string'
  );
}

function isLikelyZodSchema(value: unknown): value is ZodTypeAny {
  return (
    value != null &&
    typeof value === 'object' &&
    typeof (value as { safeParse?: unknown }).safeParse === 'function' &&
    '_def' in value
  );
}

function requireNonEmpty(
  value: string | null | undefined,
  label: string,
): string {
  const trimmed = value?.trim() ?? '';
  if (trimmed.length === 0) {
    throw new Error(`${label} is required`);
  }
  return trimmed;
}
