import { BlueNode } from '@blue-labs/language';

import { TYPE_ALIASES } from './internal/contracts.js';
import { BootstrapOptionsBuilder } from './internal/bootstrap-options-builder.js';
import { ChangesetBuilder } from './internal/changeset-builder.js';
import { wrapExpression } from './internal/expressions.js';
import { NodeObjectBuilder } from './internal/node-object-builder.js';
import { toBlueNode } from './internal/node-input.js';
import { resolveTypeInput } from './internal/type-input.js';
import type { BlueValue, TypeInput } from './types.js';

function requireNonBlank(value: string, label: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${label} cannot be empty.`);
  }
  return normalized;
}

function buildNamedStep(name: string, typeAlias: string): BlueNode {
  return new BlueNode()
    .setName(requireNonBlank(name, 'Step name'))
    .setType(resolveTypeInput(typeAlias));
}

export class StepsBuilder {
  private readonly steps: BlueNode[] = [];

  jsRaw(name: string, code: string): this {
    const normalizedCode = requireNonBlank(code, 'JavaScript code');
    const step = buildNamedStep(name, TYPE_ALIASES.javascriptCode).addProperty(
      'code',
      new BlueNode().setValue(normalizedCode),
    );
    this.steps.push(step);
    return this;
  }

  updateDocument(
    name: string,
    customizer: (changeset: ChangesetBuilder) => void,
  ): this {
    const builder = new ChangesetBuilder();
    customizer(builder);

    const step = buildNamedStep(name, TYPE_ALIASES.updateDocument).addProperty(
      'changeset',
      new BlueNode().setItems(builder.build()),
    );
    this.steps.push(step);
    return this;
  }

  updateDocumentFromExpression(name: string, expression: string): this {
    const step = buildNamedStep(name, TYPE_ALIASES.updateDocument).addProperty(
      'changeset',
      new BlueNode().setValue(wrapExpression(expression)),
    );
    this.steps.push(step);
    return this;
  }

  replaceValue(name: string, path: string, value: BlueValue): this {
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
    const step = buildNamedStep(name, TYPE_ALIASES.triggerEvent).addProperty(
      'event',
      eventNode.clone(),
    );
    this.steps.push(step);
    return this;
  }

  emit(name: string, event: BlueValue): this {
    return this.triggerEvent(name, toBlueNode(event));
  }

  emitType(
    name: string,
    typeInput: TypeInput,
    payloadCustomizer?: (eventNode: BlueNode) => void,
  ): this {
    const eventNode = new BlueNode().setType(resolveTypeInput(typeInput));
    payloadCustomizer?.(eventNode);
    return this.triggerEvent(name, eventNode);
  }

  namedEvent(
    name: string,
    eventName: string,
    payloadCustomizer?: (payload: NodeObjectBuilder) => void,
  ): this {
    const normalizedEventName = requireNonBlank(eventName, 'Event name');
    const event = new BlueNode()
      .setType(resolveTypeInput(TYPE_ALIASES.namedEvent))
      .addProperty('name', new BlueNode().setValue(normalizedEventName));

    if (payloadCustomizer) {
      const payload = NodeObjectBuilder.create();
      payloadCustomizer(payload);
      event.addProperty('payload', payload.build());
    }

    return this.triggerEvent(name, event);
  }

  bootstrapDocument(
    stepName: string,
    documentNode: BlueNode,
    channelBindings: Record<string, string>,
    optionsCustomizer?: (options: BootstrapOptionsBuilder) => void,
  ): this {
    const payload = NodeObjectBuilder.create()
      .type(TYPE_ALIASES.documentBootstrapRequested)
      .putNode('document', documentNode)
      .putStringMap('channelBindings', channelBindings);
    if (optionsCustomizer) {
      const options = new BootstrapOptionsBuilder();
      optionsCustomizer(options);
      options.applyTo(payload);
    }
    return this.triggerEvent(stepName, payload.build());
  }

  bootstrapDocumentExpr(
    stepName: string,
    documentExpression: string,
    channelBindings: Record<string, string>,
    optionsCustomizer?: (options: BootstrapOptionsBuilder) => void,
  ): this {
    const normalizedExpression = documentExpression.trim();
    if (normalizedExpression.length === 0) {
      throw new Error('Document expression cannot be empty.');
    }

    const payload = NodeObjectBuilder.create()
      .type(TYPE_ALIASES.documentBootstrapRequested)
      .putExpression('document', normalizedExpression)
      .putStringMap('channelBindings', channelBindings);
    if (optionsCustomizer) {
      const options = new BootstrapOptionsBuilder();
      optionsCustomizer(options);
      options.applyTo(payload);
    }
    return this.triggerEvent(stepName, payload.build());
  }

  ext<TExtension>(
    factory: ((steps: StepsBuilder) => TExtension) | null,
  ): TExtension {
    if (!factory) {
      throw new Error('extensionFactory cannot be null');
    }
    const extension = factory(this);
    if (extension == null) {
      throw new Error('extensionFactory cannot return null');
    }
    return extension;
  }

  raw(stepNode: BlueNode): this {
    this.steps.push(stepNode.clone());
    return this;
  }

  build(): BlueNode[] {
    return this.steps.map((step) => step.clone());
  }
}
