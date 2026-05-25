import { BlueNode } from '@blue-labs/language';
import { describe, expect, it } from 'vitest';
import { BexEngine } from './BexEngine';
import { BexExecutionContext } from './BexExecutionContext';
import { BexProgramSource } from './BexProgramSource';

describe('BexProgramSource definition and entry execution', () => {
  it('loads definition constants and functions before program overrides', () => {
    const definition = node({
      constants: {
        word: 'definition',
      },
      functions: {
        selected: {
          expr: {
            $const: 'word',
          },
        },
      },
    });
    const program = node({
      entry: 'entry',
      constants: {
        word: 'program',
      },
      functions: {
        entry: {
          do: [
            {
              $return: {
                $call: {
                  function: 'selected',
                  args: {},
                },
              },
            },
          ],
        },
      },
    });

    const result = BexEngine.builder()
      .build()
      .compileAndExecute(
        BexProgramSource.withDefinition(program, definition),
        BexExecutionContext.builder().build(),
      );

    expect(result.value.toSimple()).toBe('program');
  });

  it('uses explicit source entry before the root entry field', () => {
    const definition = node({
      functions: {
        right: {
          expr: 'right',
        },
        wrong: {
          expr: 'wrong',
        },
      },
    });
    const program = node({
      entry: 'wrong',
    });

    const result = BexEngine.builder()
      .build()
      .compileAndExecute(
        BexProgramSource.withDefinition(program, definition, 'right'),
        BexExecutionContext.builder().build(),
      );

    expect(result.value.toSimple()).toBe('right');
  });

  it('rejects entry functions that require args', () => {
    const program = node({
      entry: 'entry',
      functions: {
        entry: {
          args: {
            input: {},
          },
          expr: {
            $var: 'input',
          },
        },
      },
    });

    expect(() =>
      BexEngine.builder().build().compile(BexProgramSource.inline(program)),
    ).toThrow(/declares arguments/);
  });
});

function node(value: unknown): BlueNode {
  if (value === undefined) {
    return new BlueNode();
  }
  if (value === null) {
    return new BlueNode().setValue(null);
  }
  if (
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
