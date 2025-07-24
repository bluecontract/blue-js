import { describe, it, expect } from 'vitest';
import { ValidateInlineTypesReplaced } from '../ValidateInlineTypesReplaced';
import { BlueNode } from '../../../model';

describe('ValidateInlineTypesReplaced', () => {
  const processor = new ValidateInlineTypesReplaced();

  it('should throw error for inline types in type field', () => {
    const node = new BlueNode().setType(
      new BlueNode().setValue('UnknownType').setInlineValue(true)
    );

    expect(() => processor.process(node)).toThrow(
      'Unknown type "UnknownType" found in type field. No BlueId mapping exists for this type.'
    );
  });

  it('should throw error for inline types in itemType field', () => {
    const node = new BlueNode().setItemType(
      new BlueNode().setValue('UnknownItemType').setInlineValue(true)
    );

    expect(() => processor.process(node)).toThrow(
      'Unknown type "UnknownItemType" found in itemType field. No BlueId mapping exists for this type.'
    );
  });

  it('should throw error for inline types in keyType field', () => {
    const node = new BlueNode().setKeyType(
      new BlueNode().setValue('UnknownKeyType').setInlineValue(true)
    );

    expect(() => processor.process(node)).toThrow(
      'Unknown type "UnknownKeyType" found in keyType field. No BlueId mapping exists for this type.'
    );
  });

  it('should throw error for inline types in valueType field', () => {
    const node = new BlueNode().setValueType(
      new BlueNode().setValue('UnknownValueType').setInlineValue(true)
    );

    expect(() => processor.process(node)).toThrow(
      'Unknown type "UnknownValueType" found in valueType field. No BlueId mapping exists for this type.'
    );
  });

  it('should not throw error for types with BlueIds', () => {
    const node = new BlueNode()
      .setType(new BlueNode().setBlueId('SOME_BLUE_ID'))
      .setItemType(new BlueNode().setBlueId('ANOTHER_BLUE_ID'));

    // Should not throw
    const result = processor.process(node);
    expect(result).toBe(node);
  });

  it('should not throw for non-inline type values', () => {
    // Complex type structure (not an inline value)
    const complexType = new BlueNode()
      .setName('ComplexType')
      .setType(new BlueNode().setBlueId('BASE_TYPE_ID'));

    const node = new BlueNode().setType(complexType);

    // Should not throw
    const result = processor.process(node);
    expect(result).toBe(node);
  });

  it('should validate nested structures recursively', () => {
    const node = new BlueNode().setProperties({
      valid: new BlueNode().setType(new BlueNode().setBlueId('VALID_TYPE_ID')),
      invalid: new BlueNode().setType(
        new BlueNode().setValue('InvalidType').setInlineValue(true)
      ),
    });

    expect(() => processor.process(node)).toThrow(
      'Unknown type "InvalidType" found in type field. No BlueId mapping exists for this type.'
    );
  });

  it('should validate deeply nested structures', () => {
    const node = new BlueNode().setItems([
      new BlueNode().setProperties({
        deep: new BlueNode().setProperties({
          nested: new BlueNode().setValueType(
            new BlueNode().setValue('DeepType').setInlineValue(true)
          ),
        }),
      }),
    ]);

    expect(() => processor.process(node)).toThrow(
      'Unknown type "DeepType" found in valueType field. No BlueId mapping exists for this type.'
    );
  });

  it('should return the document unchanged if all types are valid', () => {
    const node = new BlueNode()
      .setType(new BlueNode().setBlueId('TYPE_ID'))
      .setProperties({
        prop1: new BlueNode()
          .setValue('some value')
          .setType(new BlueNode().setBlueId('TEXT_ID')),
        prop2: new BlueNode()
          .setItems([new BlueNode().setValue(1), new BlueNode().setValue(2)])
          .setItemType(new BlueNode().setBlueId('INTEGER_ID')),
      });

    const result = processor.process(node);
    expect(result).toBe(node);
  });
});
