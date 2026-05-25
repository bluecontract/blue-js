import { BlueNode } from '@blue-labs/language';
import { describe, expect, it } from 'vitest';
import { BexEngine } from '../api/BexEngine';
import { BexExecutionContext } from '../api/BexExecutionContext';
import { BexProgramSource } from '../api/BexProgramSource';
import { compareUnicodeCodePoints, sortBexKeys } from './key-order';

describe('BEX key ordering', () => {
  it('sorts object keys by Unicode code point order', () => {
    expect(sortBexKeys(['a', '😀', '\uE000'])).toEqual(['a', '\uE000', '😀']);
  });

  it('exposes the ordering through the comparator', () => {
    expect(compareUnicodeCodePoints('😀', '\uE000')).toBeGreaterThan(0);
    expect(['a', '😀', '\uE000'].sort(compareUnicodeCodePoints)).toEqual([
      'a',
      '\uE000',
      '😀',
    ]);
  });

  it('uses code-point order for $keys', () => {
    const result = BexEngine.builder()
      .build()
      .compileAndExecute(
        BexProgramSource.inline(
          node({
            expr: {
              $keys: {
                a: 1,
                '\uE000': 2,
                '😀': 3,
              },
            },
          }),
        ),
        BexExecutionContext.builder().build(),
      );

    expect(result.value.toSimple()).toEqual(['a', '\uE000', '😀']);
  });
});

function node(value: unknown): BlueNode {
  if (value === undefined) {
    return new BlueNode();
  }
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return new BlueNode().setValue(value);
  }
  if (Array.isArray(value)) {
    return new BlueNode().setItems(value.map(node));
  }
  const result = new BlueNode();
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    result.addProperty(key, node(child));
  }
  return result;
}
