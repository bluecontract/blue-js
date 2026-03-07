import { BlueNode } from '@blue-labs/language';

import type {
  BlueValueInput,
  StepPayloadBuilder,
  StringMapInput,
  TypeInput,
} from '../types';
import { wrapExpression } from './expression';
import { resolveTypeInput } from './type-input';
import { toBlueNode } from './value-to-node';

export class NodeObjectBuilder implements StepPayloadBuilder {
  private readonly node: BlueNode;

  private constructor(node?: BlueNode) {
    this.node = node?.clone() ?? new BlueNode();
  }

  static create(node?: BlueValueInput): NodeObjectBuilder {
    if (!node) {
      return new NodeObjectBuilder();
    }
    return new NodeObjectBuilder(toBlueNode(node));
  }

  type(typeInput: TypeInput): this {
    this.node.setType(resolveTypeInput(typeInput));
    return this;
  }

  setName(name: string | undefined): this {
    this.node.setName(name);
    return this;
  }

  setDescription(description: string | undefined): this {
    this.node.setDescription(description);
    return this;
  }

  put(key: string, value: BlueValueInput): this {
    this.node.addProperty(requireNonEmpty(key, 'key'), toBlueNode(value));
    return this;
  }

  putNode(key: string, value: BlueValueInput): this {
    return this.put(key, value);
  }

  putStringMap(key: string, map: StringMapInput): this {
    const dictionary = new BlueNode();
    const properties: Record<string, BlueNode> = {};

    for (const [rawKey, value] of iterateBindings(map)) {
      const normalizedKey = rawKey.trim();
      if (normalizedKey.length === 0) {
        continue;
      }
      properties[normalizedKey] = toBlueNode(value);
    }

    dictionary.setProperties(properties);
    this.node.addProperty(requireNonEmpty(key, 'key'), dictionary);
    return this;
  }

  putExpression(key: string, expression: string): this {
    this.node.addProperty(
      requireNonEmpty(key, 'key'),
      toBlueNode(wrapExpression(expression)),
    );
    return this;
  }

  addProperty(key: string, value: BlueNode): this {
    this.node.addProperty(key, value);
    return this;
  }

  removeProperty(key: string): this {
    this.node.removeProperty(key);
    return this;
  }

  setType(type: BlueNode): this {
    this.node.setType(type);
    return this;
  }

  setItems(items: BlueNode[]): this {
    this.node.setItems(items);
    return this;
  }

  getItems(): BlueNode[] | null | undefined {
    return this.node.getItems();
  }

  setProperties(properties: Record<string, BlueNode>): this {
    this.node.setProperties(properties);
    return this;
  }

  getProperties(): Record<string, BlueNode> | null | undefined {
    return this.node.getProperties();
  }

  clone(): BlueNode {
    return this.node.clone();
  }

  build(): BlueNode {
    return this.node.clone();
  }

  toNode(): BlueNode {
    return this.node.clone();
  }
}

function iterateBindings(
  map: StringMapInput,
): Iterable<[string, string | null]> {
  return map instanceof Map ? map.entries() : Object.entries(map);
}

function requireNonEmpty(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${label} is required`);
  }
  return trimmed;
}
