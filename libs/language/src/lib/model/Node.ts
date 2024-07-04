import Big from 'big.js';
import { JsonPrimitive } from '../../schema';

export class BlueNode {
  static INTEGER: BlueNode = new BlueNode('Integer');

  private name?: string;
  private description?: string;
  private type?: BlueNode;
  private value?: Exclude<JsonPrimitive, number> | Big;
  private items?: BlueNode[];
  private properties?: Record<string, BlueNode>;
  private ref?: string;
  private blueId?: string;
  private constraints?: Constraints;
  private features?: Feature[];

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
      this.type = isBasicType(type)
        ? new BlueNode().setValue(type)
        : new BlueNode().setBlueId(type);
    } else {
      this.type = type;
    }
    return this;
  }

  eraseType(): BlueNode {
    this.type = undefined;
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

  getRef() {
    return this.ref;
  }

  setRef(ref: string): BlueNode {
    this.ref = ref;
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

  setFeatures(features: Feature[]): BlueNode {
    this.features = features;
    return this;
  }

  clone(): BlueNode {
    const cloned = new BlueNode(this.name);
    cloned.description = this.description;
    cloned.type = this.type?.clone();
    cloned.value = this.value;
    cloned.items = this.items?.map((item) => item.clone());
    cloned.properties = { ...this.properties };
    cloned.ref = this.ref;
    cloned.blueId = this.blueId;
    cloned.constraints = this.constraints;
    return cloned;
  }

  toString(): string {
    return `BlueNode{name='${this.name}', description='${this.description}', type=${this.type}, value=${this.value}, items=${this.items}, properties=${this.properties}, ref='${this.ref}', blueId='${this.blueId}', constraints=${this.constraints}}`;
  }
}

// Helper function to determine if a type is basic
function isBasicType(type: string): boolean {
  return ['string', 'number', 'boolean'].includes(type);
}

// Dummy classes to simulate environment
class Constraints {}
class Feature {}
