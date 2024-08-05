import Big from 'big.js';
import { JsonPrimitive } from '@blue-company/shared-utils';
import { NodePathAccessor } from '../utils/NodePathAccessor';

export class BlueNode {
  static INTEGER: BlueNode = new BlueNode('Integer');

  private name?: string;
  private description?: string;
  private type?: BlueNode;
  private itemType?: BlueNode;
  private keyType?: BlueNode;
  private valueType?: BlueNode;
  private value?: Exclude<JsonPrimitive, number> | Big;
  private items?: BlueNode[];
  private properties?: Record<string, BlueNode>;
  private blueId?: string;
  private constraints?: Constraints;
  private blue?: BlueNode;
  private inlineValue = false;

  constructor(name?: string) {
    this.name = name;
  }

  getName() {
    return this.name;
  }

  setName(name: string): BlueNode {
    this.name = name;
    return this;
  }

  getDescription() {
    return this.description;
  }

  setDescription(description: string): BlueNode {
    this.description = description;
    return this;
  }

  getType() {
    return this.type;
  }

  setType(type: BlueNode | string): BlueNode {
    if (typeof type === 'string') {
      this.type = new BlueNode().setValue(type).setInlineValue(true);
    } else {
      this.type = type;
    }
    return this;
  }

  getItemType() {
    return this.itemType;
  }

  setItemType(itemType: BlueNode | string): BlueNode {
    if (typeof itemType === 'string') {
      this.itemType = new BlueNode().setValue(itemType).setInlineValue(true);
    } else {
      this.itemType = itemType;
    }
    return this;
  }

  getKeyType() {
    return this.keyType;
  }

  setKeyType(keyType: BlueNode | string): BlueNode {
    if (typeof keyType === 'string') {
      this.keyType = new BlueNode().setValue(keyType).setInlineValue(true);
    } else {
      this.keyType = keyType;
    }
    return this;
  }

  getValueType() {
    return this.valueType;
  }

  setValueType(valueType: BlueNode | string): BlueNode {
    if (typeof valueType === 'string') {
      this.valueType = new BlueNode().setValue(valueType).setInlineValue(true);
    } else {
      this.valueType = valueType;
    }
    return this;
  }

  getValue() {
    return this.value;
  }

  setValue(value: JsonPrimitive | Big): BlueNode {
    if (typeof value === 'number') {
      this.value = new Big(value.toString());
    } else {
      this.value = value;
    }
    return this;
  }

  getItems() {
    return this.items;
  }

  setItems(items: BlueNode[]): BlueNode {
    this.items = items;
    return this;
  }

  addItems(...items: BlueNode[]): BlueNode {
    if (!this.items) {
      this.items = [];
    }
    this.items.push(...items);
    return this;
  }

  getProperties() {
    return this.properties;
  }

  setProperties(properties: Record<string, BlueNode>): BlueNode {
    this.properties = properties;
    return this;
  }

  addProperty(key: string, value: BlueNode): BlueNode {
    if (!this.properties) {
      this.properties = {};
    }
    this.properties[key] = value;
    return this;
  }

  getBlueId() {
    return this.blueId;
  }

  setBlueId(blueId: string): BlueNode {
    this.blueId = blueId;
    return this;
  }

  getConstraints() {
    return this.constraints;
  }

  setConstraints(constraints: Constraints): BlueNode {
    this.constraints = constraints;
    return this;
  }

  getBlue() {
    return this.blue;
  }

  setBlue(blue: BlueNode): BlueNode {
    this.blue = blue;
    return this;
  }

  isInlineValue() {
    return this.inlineValue;
  }

  setInlineValue(inlineValue: boolean): BlueNode {
    this.inlineValue = inlineValue;
    return this;
  }

  get(path: string, linkingProvider?: (node: BlueNode) => BlueNode | null) {
    return NodePathAccessor.get(this, path, linkingProvider);
  }

  clone(): BlueNode {
    const cloned = new BlueNode(this.name);
    cloned.description = this.description;
    cloned.type = this.type?.clone();
    cloned.itemType = this.itemType?.clone();
    cloned.keyType = this.keyType?.clone();
    cloned.valueType = this.valueType?.clone();
    cloned.value = this.value;
    cloned.items = this.items?.map((item) => item.clone());
    cloned.properties = this.properties
      ? Object.fromEntries(
          Object.entries(this.properties).map(([k, v]) => [k, v.clone()])
        )
      : undefined;
    cloned.blueId = this.blueId;
    cloned.constraints = this.constraints;
    cloned.blue = this.blue?.clone();
    cloned.inlineValue = this.inlineValue;
    return cloned;
  }

  toString(): string {
    return `BlueNode{name='${this.name}', description='${this.description}', type=${this.type}, itemType=${this.itemType}, keyType=${this.keyType}, valueType=${this.valueType}, value=${this.value}, items=${this.items}, properties=${this.properties}, blueId='${this.blueId}', constraints=${this.constraints}, blue=${this.blue}, inlineValue=${this.inlineValue}}`;
  }
}

// Dummy class to simulate environment
class Constraints {}
