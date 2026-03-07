import { BlueNode } from '@blue-labs/language';

import type { BlueValue, TypeInput } from '../types.js';
import { wrapExpression } from './expressions.js';
import { toBlueNode } from './node-input.js';
import { resolveTypeInput } from './type-input.js';

function ensureProperties(node: BlueNode): Record<string, BlueNode> {
  const existing = node.getProperties();
  if (existing) {
    return existing;
  }
  const created: Record<string, BlueNode> = {};
  node.setProperties(created);
  return created;
}

export class NodeObjectBuilder {
  private readonly node = new BlueNode().setProperties({});

  static create(): NodeObjectBuilder {
    return new NodeObjectBuilder();
  }

  type(typeInput: TypeInput): this {
    this.node.setType(resolveTypeInput(typeInput));
    return this;
  }

  put(key: string, value: BlueValue): this {
    ensureProperties(this.node)[key] = toBlueNode(value);
    return this;
  }

  putNode(key: string, value: BlueNode): this {
    ensureProperties(this.node)[key] = value.clone();
    return this;
  }

  putStringMap(
    key: string,
    map: Record<string, string> | Map<string, string>,
  ): this {
    const entries =
      map instanceof Map ? [...map.entries()] : Object.entries(map ?? {});
    const dictionary = new BlueNode().setProperties({});
    for (const [rawKey, rawValue] of entries) {
      const normalizedKey = rawKey.trim();
      if (normalizedKey.length === 0) {
        continue;
      }
      dictionary.addProperty(normalizedKey, new BlueNode().setValue(rawValue));
    }
    ensureProperties(this.node)[key] = dictionary;
    return this;
  }

  putExpression(key: string, expression: string): this {
    ensureProperties(this.node)[key] = new BlueNode().setValue(
      wrapExpression(expression),
    );
    return this;
  }

  build(): BlueNode {
    return this.node.clone();
  }
}
