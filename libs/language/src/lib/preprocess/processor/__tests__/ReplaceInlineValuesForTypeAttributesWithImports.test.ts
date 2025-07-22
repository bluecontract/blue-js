import { describe, it, expect } from 'vitest';
import { ReplaceInlineValuesForTypeAttributesWithImports } from '../ReplaceInlineValuesForTypeAttributesWithImports';
import { BlueNode } from '../../../model';

describe('ReplaceInlineValuesForTypeAttributesWithImports', () => {
  it('should throw error for unknown inline types in all type fields', () => {
    const processor = new ReplaceInlineValuesForTypeAttributesWithImports(
      new Map([['KnownType', 'KNOWN_BLUE_ID']])
    );

    // Test type field
    const nodeWithType = new BlueNode().setType(
      new BlueNode().setValue('UnknownType').setInlineValue(true)
    );
    expect(() => processor.process(nodeWithType)).toThrow(
      'Unknown type "UnknownType" found in type field. No BlueId mapping exists for this type.'
    );

    // Test itemType field
    const nodeWithItemType = new BlueNode().setItemType(
      new BlueNode().setValue('UnknownItemType').setInlineValue(true)
    );
    expect(() => processor.process(nodeWithItemType)).toThrow(
      'Unknown type "UnknownItemType" found in itemType field. No BlueId mapping exists for this type.'
    );

    // Test keyType field
    const nodeWithKeyType = new BlueNode().setKeyType(
      new BlueNode().setValue('UnknownKeyType').setInlineValue(true)
    );
    expect(() => processor.process(nodeWithKeyType)).toThrow(
      'Unknown type "UnknownKeyType" found in keyType field. No BlueId mapping exists for this type.'
    );

    // Test valueType field
    const nodeWithValueType = new BlueNode().setValueType(
      new BlueNode().setValue('UnknownValueType').setInlineValue(true)
    );
    expect(() => processor.process(nodeWithValueType)).toThrow(
      'Unknown type "UnknownValueType" found in valueType field. No BlueId mapping exists for this type.'
    );
  });

  it('should replace known types with BlueIds', () => {
    const processor = new ReplaceInlineValuesForTypeAttributesWithImports(
      new Map([
        ['Integer', 'INTEGER_BLUE_ID'],
        ['Text', 'TEXT_BLUE_ID'],
      ])
    );

    const node = new BlueNode()
      .setType(new BlueNode().setValue('Integer').setInlineValue(true))
      .setItemType(new BlueNode().setValue('Text').setInlineValue(true));

    const result = processor.process(node);

    expect(result.getType()?.getBlueId()).toBe('INTEGER_BLUE_ID');
    expect(result.getType()?.getValue()).toBeUndefined();
    expect(result.getType()?.isInlineValue()).toBe(false);

    expect(result.getItemType()?.getBlueId()).toBe('TEXT_BLUE_ID');
    expect(result.getItemType()?.getValue()).toBeUndefined();
    expect(result.getItemType()?.isInlineValue()).toBe(false);
  });

  it('should not throw error for non-inline type values', () => {
    const processor = new ReplaceInlineValuesForTypeAttributesWithImports(
      new Map([['KnownType', 'KNOWN_BLUE_ID']])
    );

    // Type with blueId (not inline value)
    const node = new BlueNode().setType(
      new BlueNode().setBlueId('SOME_BLUE_ID')
    );

    // Should not throw
    const result = processor.process(node);
    expect(result.getType()?.getBlueId()).toBe('SOME_BLUE_ID');
  });

  it('should not throw for complex type structures (non-inline values)', () => {
    const processor = new ReplaceInlineValuesForTypeAttributesWithImports(
      new Map([['Integer', 'INTEGER_BLUE_ID']])
    );

    // Complex type structure with nested types
    const complexType = new BlueNode()
      .setName('A')
      .setType(
        new BlueNode()
          .setName('B')
          .setType(new BlueNode().setValue('Integer').setInlineValue(true))
      );

    const node = new BlueNode().setType(complexType); // Not an inline value

    // Should not throw because the top-level type is not an inline value
    const result = processor.process(node);

    // Verify the nested Integer type was replaced
    expect(result.getType()?.getName()).toBe('A');
    expect(result.getType()?.getType()?.getName()).toBe('B');
    expect(result.getType()?.getType()?.getType()?.getBlueId()).toBe(
      'INTEGER_BLUE_ID'
    );
  });

  it('should process nested structures recursively and throw error for unknown types', () => {
    const processor = new ReplaceInlineValuesForTypeAttributesWithImports(
      new Map([['Integer', 'INTEGER_BLUE_ID']])
    );

    // Test that processor works recursively through nested structures
    const node = new BlueNode().setProperties({
      nested: new BlueNode().setType(
        new BlueNode().setValue('UnknownType').setInlineValue(true)
      ),
    });

    expect(() => processor.process(node)).toThrow(
      'Unknown type "UnknownType" found in type field. No BlueId mapping exists for this type.'
    );
  });
});
