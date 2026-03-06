import { BlueNode } from '@blue-labs/language';

import type { BlueValueInput, TypeInput } from '../types';
import { normalizeRequiredPointer } from '../internal/pointer';
import { resolveTypeInput } from '../internal/type-input';
import { toBlueNode } from '../internal/value-to-node';
import { DocBuilder } from './doc-builder';

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

  replaceValue(name: string, path: string, value: BlueValueInput): this {
    return this.addUpdateDocumentStep(name, [
      createReplaceChange(
        normalizeRequiredPointer(path, 'path'),
        toBlueNode(value),
      ),
    ]);
  }

  replaceExpression(name: string, path: string, expression: string): this {
    return this.addUpdateDocumentStep(name, [
      createReplaceChange(
        normalizeRequiredPointer(path, 'path'),
        toBlueNode(DocBuilder.expr(expression)),
      ),
    ]);
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
    payloadCustomizer?: (eventNode: BlueNode) => void,
  ): this {
    const eventNode = new BlueNode().setType(resolveTypeInput(typeInput));
    payloadCustomizer?.(eventNode);
    return this.triggerEvent(name, eventNode);
  }

  raw(stepNode: BlueNode): this {
    this.steps.push(toBlueNode(stepNode));
    return this;
  }

  build(): BlueNode[] {
    return this.steps.map((step) => step.clone());
  }

  private addUpdateDocumentStep(name: string, changes: BlueNode[]): this {
    const step = new BlueNode()
      .setName(requireNonEmpty(name, 'step name'))
      .setType(resolveTypeInput('Conversation/Update Document'));
    step.addProperty('changeset', new BlueNode().setItems(changes));
    this.steps.push(step);
    return this;
  }
}

function createReplaceChange(path: string, valueNode: BlueNode): BlueNode {
  const change = new BlueNode();
  change.addProperty('op', toBlueNode('replace'));
  change.addProperty('path', toBlueNode(path));
  change.addProperty('val', valueNode);
  return change;
}

function requireNonEmpty(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${label} is required`);
  }
  return trimmed;
}
