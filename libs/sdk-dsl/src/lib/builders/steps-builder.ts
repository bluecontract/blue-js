import { BlueNode } from '@blue-labs/language';

import type {
  BlueValueInput,
  BootstrapOptionsBuilderLike,
  ChannelBindingsInput,
  ChangesetBuilderLike,
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
