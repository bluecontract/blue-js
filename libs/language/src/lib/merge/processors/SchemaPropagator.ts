import { BlueNode, Schema, SCHEMA_FIELDS } from '../../model';
import type { SchemaField } from '../../model/Schema';
import { MergingProcessor } from '../MergingProcessor';
import { BlueIdCalculator } from '../../utils/BlueIdCalculator';
import { NodeToBlueIdInput } from '../../utils/NodeToBlueIdInput';

const MIN_FIELDS = new Set<SchemaField>([
  'minLength',
  'minimum',
  'exclusiveMinimum',
  'minItems',
  'minFields',
]);
const MAX_FIELDS = new Set<SchemaField>([
  'maxLength',
  'maximum',
  'exclusiveMaximum',
  'maxItems',
  'maxFields',
]);
const BOOLEAN_TRUE_FIELDS = new Set<SchemaField>(['required', 'uniqueItems']);

export class SchemaPropagator implements MergingProcessor {
  process(target: BlueNode, source: BlueNode): BlueNode {
    const sourceSchema = source.getSchema();
    if (sourceSchema === undefined) {
      return target;
    }

    const targetSchema = target.getSchema()?.clone() ?? new Schema();
    for (const field of SCHEMA_FIELDS) {
      const sourceValue = sourceSchema.get(field);
      if (sourceValue === undefined) {
        continue;
      }
      const targetValue = targetSchema.get(field);
      targetSchema.set(
        field,
        this.propagateField(field, targetValue, sourceValue),
      );
    }
    targetSchema.setEnum(
      this.propagateEnum(targetSchema.getEnum(), sourceSchema.getEnum()),
    );

    return target.cloneShallow().setSchema(targetSchema);
  }

  private propagateField(
    field: SchemaField,
    target: BlueNode | undefined,
    source: BlueNode,
  ): BlueNode {
    if (target === undefined) {
      return source.clone();
    }
    if (BOOLEAN_TRUE_FIELDS.has(field)) {
      return source.getValue() === true ? source.clone() : target.clone();
    }
    if (field === 'multipleOf') {
      return this.multipleOf(target, source);
    }
    if (MIN_FIELDS.has(field)) {
      return this.numericValue(source) > this.numericValue(target)
        ? source.clone()
        : target.clone();
    }
    if (MAX_FIELDS.has(field)) {
      return this.numericValue(source) < this.numericValue(target)
        ? source.clone()
        : target.clone();
    }
    return source.clone();
  }

  private multipleOf(target: BlueNode, source: BlueNode): BlueNode {
    const targetValue = this.numericValue(target);
    const sourceValue = this.numericValue(source);
    if (Number.isInteger(targetValue) && Number.isInteger(sourceValue)) {
      return new BlueNode().setValue(
        Number(lcm(BigInt(targetValue), BigInt(sourceValue))),
      );
    }
    return sourceValue > targetValue ? source.clone() : target.clone();
  }

  private propagateEnum(
    target: BlueNode[] | undefined,
    source: BlueNode[] | undefined,
  ): BlueNode[] | undefined {
    if (source === undefined) {
      return target?.map((node) => node.clone());
    }
    if (target === undefined) {
      return this.canonicalizeEnum(source);
    }

    const targetByIdentity = new Map(
      target.map((node) => [this.enumComparableBlueId(node), node] as const),
    );
    return this.canonicalizeEnum(
      source.flatMap((sourceValue) => {
        const targetValue = targetByIdentity.get(
          this.enumComparableBlueId(sourceValue),
        );
        return targetValue === undefined ? [] : [targetValue];
      }),
    );
  }

  private canonicalizeEnum(nodes: BlueNode[]): BlueNode[] {
    const unique = new Map<string, BlueNode>();
    for (const node of nodes) {
      unique.set(this.enumComparableBlueId(node), node.clone());
    }
    return [...unique.values()].sort((left, right) =>
      this.enumCanonicalKey(left).localeCompare(this.enumCanonicalKey(right)),
    );
  }

  private enumComparableBlueId(node: BlueNode): string {
    const comparable = node.clone();
    comparable.setSchema(undefined);
    return BlueIdCalculator.calculateBlueIdSync(comparable);
  }

  private enumCanonicalKey(node: BlueNode): string {
    const comparable = node.clone();
    comparable.setSchema(undefined);
    return JSON.stringify(NodeToBlueIdInput.get(comparable));
  }

  private numericValue(node: BlueNode): number {
    const value = node.getValue();
    if (typeof value === 'number') {
      return value;
    }
    if (value !== undefined && value !== null && 'toString' in Object(value)) {
      return Number(value.toString());
    }
    throw new Error('Schema keyword value must be numeric.');
  }
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a;
}

function lcm(left: bigint, right: bigint): bigint {
  if (left === 0n || right === 0n) {
    return 0n;
  }
  return (left / gcd(left, right)) * right;
}
