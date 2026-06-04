import { BlueNode, Schema } from '../../model';
import { MergingProcessor } from '../MergingProcessor';
import { BlueNumbers } from '../../utils/BlueNumbers';
import { BlueIdCalculator } from '../../utils/BlueIdCalculator';

export class SchemaVerifier implements MergingProcessor {
  process(target: BlueNode): BlueNode {
    return target;
  }

  postProcess(target: BlueNode): BlueNode {
    const schema = target.getSchema();
    if (schema === undefined) {
      return target;
    }

    this.verifyMultipleOfKeyword(schema);
    this.verifyTextLength('minLength', schema.get('minLength'), target);
    this.verifyTextLength('maxLength', schema.get('maxLength'), target);
    this.verifyMultipleOf(schema.get('multipleOf'), target);
    this.verifyEnum(schema.getEnum(), target);
    return target;
  }

  private verifyMultipleOfKeyword(schema: Schema): void {
    const multipleOf = schema.get('multipleOf');
    if (multipleOf === undefined) {
      return;
    }
    if (this.numericValue(multipleOf) <= 0) {
      throw new Error('Schema keyword "multipleOf" must be greater than zero.');
    }
  }

  private verifyTextLength(
    keyword: 'minLength' | 'maxLength',
    constraint: BlueNode | undefined,
    node: BlueNode,
  ): void {
    if (constraint === undefined) {
      return;
    }
    const value = node.getValue();
    if (value === undefined || value === null) {
      if (!this.hasPayload(node)) {
        return;
      }
      throw this.wrongKind(keyword, 'Text scalar');
    }
    if (typeof value !== 'string') {
      throw this.wrongKind(keyword, 'Text scalar');
    }
    const length = Array.from(value).length;
    const limit = this.numericValue(constraint);
    if (keyword === 'minLength' && length < limit) {
      throw new Error(
        `Value "${value}" is shorter than the minimum length of ${limit}.`,
      );
    }
    if (keyword === 'maxLength' && length > limit) {
      throw new Error(
        `Value "${value}" is longer than the maximum length of ${limit}.`,
      );
    }
  }

  private verifyMultipleOf(
    multipleOf: BlueNode | undefined,
    node: BlueNode,
  ): void {
    if (multipleOf === undefined) {
      return;
    }
    const value = node.getValue();
    if (value === undefined || value === null) {
      if (!this.hasPayload(node)) {
        return;
      }
      throw this.wrongKind('multipleOf', 'numeric scalar');
    }
    if (!this.isNumeric(value)) {
      throw this.wrongKind('multipleOf', 'numeric scalar');
    }
    if (!BlueNumbers.isExactBinary64Multiple(value, multipleOf.getValue())) {
      throw new Error(
        `Value ${String(value)} is not a multiple of ${String(
          multipleOf.getValue(),
        )}.`,
      );
    }
  }

  private verifyEnum(enumValues: BlueNode[] | undefined, node: BlueNode): void {
    if (enumValues === undefined || node.getValue() === undefined) {
      return;
    }
    const nodeBlueId = this.comparableBlueId(node);
    if (
      !enumValues.some(
        (enumValue) => this.comparableBlueId(enumValue) === nodeBlueId,
      )
    ) {
      throw new Error('Node value is not one of the allowed enum values.');
    }
  }

  private comparableBlueId(node: BlueNode): string {
    const comparable = node.clone();
    comparable.setName(undefined);
    comparable.setDescription(undefined);
    comparable.setSchema(undefined);
    return BlueIdCalculator.calculateBlueIdSync(comparable);
  }

  private hasPayload(node: BlueNode): boolean {
    return (
      (node.getValue() !== undefined && node.getValue() !== null) ||
      node.getItems() !== undefined ||
      Object.keys(node.getProperties() ?? {}).length > 0
    );
  }

  private isNumeric(value: unknown): boolean {
    return (
      typeof value === 'number' ||
      (value !== undefined && value !== null && 'toString' in Object(value))
    );
  }

  private numericValue(node: BlueNode): number {
    const value = node.getValue();
    if (!this.isNumeric(value)) {
      throw this.wrongKind('schema', 'numeric scalar');
    }
    return Number(value?.toString());
  }

  private wrongKind(keyword: string, expected: string): Error {
    return new Error(
      `Schema keyword "${keyword}" applies to wrong kind; expected ${expected}.`,
    );
  }
}
