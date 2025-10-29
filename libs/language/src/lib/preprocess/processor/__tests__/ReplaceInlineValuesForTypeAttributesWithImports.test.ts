import { describe, it, expect } from 'vitest';
import { ReplaceInlineValuesForTypeAttributesWithImports } from '../ReplaceInlineValuesForTypeAttributesWithImports';
import { BlueNode } from '../../../model';

describe('ReplaceInlineValuesForTypeAttributesWithImports', () => {
  it('should replace known types with BlueIds', () => {
    const processor = new ReplaceInlineValuesForTypeAttributesWithImports(
      new Map([
        ['Integer', 'INTEGER_BLUE_ID'],
        ['Text', 'TEXT_BLUE_ID'],
      ]),
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

  it('should handle complex type structures (non-inline values)', () => {
    const processor = new ReplaceInlineValuesForTypeAttributesWithImports(
      new Map([['Integer', 'INTEGER_BLUE_ID']]),
    );

    // Complex type structure with nested types
    const complexType = new BlueNode()
      .setName('A')
      .setType(
        new BlueNode()
          .setName('B')
          .setType(new BlueNode().setValue('Integer').setInlineValue(true)),
      );

    const node = new BlueNode().setType(complexType); // Not an inline value

    const result = processor.process(node);

    // Verify the nested Integer type was replaced
    expect(result.getType()?.getName()).toBe('A');
    expect(result.getType()?.getType()?.getName()).toBe('B');
    expect(result.getType()?.getType()?.getType()?.getBlueId()).toBe(
      'INTEGER_BLUE_ID',
    );
  });
});
