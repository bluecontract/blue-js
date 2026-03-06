import { BlueNode } from '@blue-labs/language';

import { TYPE_ALIASES } from './internal/contracts.js';
import { wrapExpression } from './internal/expressions.js';
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

function buildReplaceChangesetEntry(path: string, value: BlueNode): BlueNode {
  return new BlueNode().setProperties({
    op: new BlueNode().setValue('replace'),
    path: new BlueNode().setValue(path),
    val: value,
  });
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

  replaceValue(name: string, path: string, value: BlueValue): this {
    const step = buildNamedStep(name, TYPE_ALIASES.updateDocument).addProperty(
      'changeset',
      new BlueNode().setItems([
        buildReplaceChangesetEntry(path, toBlueNode(value)),
      ]),
    );
    this.steps.push(step);
    return this;
  }

  replaceExpression(name: string, path: string, expression: string): this {
    const step = buildNamedStep(name, TYPE_ALIASES.updateDocument).addProperty(
      'changeset',
      new BlueNode().setItems([
        buildReplaceChangesetEntry(
          path,
          new BlueNode().setValue(wrapExpression(expression)),
        ),
      ]),
    );
    this.steps.push(step);
    return this;
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

  raw(stepNode: BlueNode): this {
    this.steps.push(stepNode.clone());
    return this;
  }

  build(): BlueNode[] {
    return this.steps.map((step) => step.clone());
  }
}
