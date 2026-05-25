import { BlueNode } from '@blue-labs/language';
import { describe, expect, it } from 'vitest';
import { BexException } from '../BexException';
import { BexValues, nodeToSimple } from '../value/BexValues';
import { BexEngine } from './BexEngine';
import { BexExecutionContext } from './BexExecutionContext';
import { BexProgramSource } from './BexProgramSource';

describe('BEX strict spec hardening', () => {
  it('uses collection/cardinality semantics for $size', () => {
    expect(execute({ expr: { $size: 'abcd' } }).value.toSimple()).toBe(1);
    expect(execute({ expr: { $size: 123 } }).value.toSimple()).toBe(1);
    expect(execute({ expr: { $size: false } }).value.toSimple()).toBe(1);
    expect(execute({ expr: { $size: null } }).value.toSimple()).toBe(0);
    expect(execute({ expr: { $size: ['a', 'b'] } }).value.toSimple()).toBe(2);
    expect(execute({ expr: { $size: { a: 1, b: 2 } } }).value.toSimple()).toBe(
      2,
    );
  });

  it('returns default statement result for empty and completed do bodies', () => {
    expect(execute({ do: [] }).value.toSimple()).toEqual({
      changeset: [],
      events: [],
    });
    expect(
      execute({
        do: [{ $appendEvent: 'created' }],
      }).value.toSimple(),
    ).toEqual({
      changeset: [],
      events: ['created'],
    });
  });

  it('returns default statement result from statement functions without return', () => {
    expect(
      execute({
        expr: { $call: { function: 'noop', args: {} } },
        functions: {
          noop: {},
        },
      }).value.toSimple(),
    ).toEqual({
      changeset: [],
      events: [],
    });
  });

  it('treats empty or null $return as default statement result', () => {
    expect(
      execute({
        do: [{ $appendEvent: 'created' }, { $return: null }],
      }).value.toSimple(),
    ).toEqual({
      changeset: [],
      events: ['created'],
    });
  });

  it('rejects list literals containing undefined evaluated items', () => {
    expect(() =>
      execute({
        expr: ['ok', { $document: '/missing' }],
      }),
    ).toThrow(/Undefined cannot appear in list literal item 1/);
  });

  it('does not evaluate or charge a missing $choose else branch', () => {
    const result = execute({
      expr: {
        $choose: {
          cond: false,
          then: { $document: '/not-charged' },
        },
      },
    });

    expect(result.value.toSimple()).toBeUndefined();
    expect(result.gasUsed).toBe(4);
  });

  it('rejects unknown expression operators during compile with diagnostics', () => {
    expect(() =>
      engine().compile(source({ expr: { $unknown: true } })),
    ).toThrow(/Unknown BEX operator/);
    try {
      engine().compile(source({ expr: { $unknown: true } }));
      throw new Error('compile should have failed');
    } catch (error) {
      expect(error).toBeInstanceOf(BexException);
      expect((error as BexException).errorClass).toBe('compile-error');
      expect((error as BexException).operator).toBe('$unknown');
      expect((error as BexException).sourcePath).toBe('/expr');
    }
  });

  it('rejects undeclared $set during compile', () => {
    expect(() =>
      engine().compile(
        source({
          do: [{ $set: { name: 'missing', expr: 1 } }],
        }),
      ),
    ).toThrow(/Unknown local variable/);
  });

  it('rejects duplicate $forEach binding names during compile', () => {
    expect(() =>
      engine().compile(
        source({
          do: [
            {
              $forEach: {
                in: [1],
                item: 'same',
                index: 'same',
                do: [],
              },
            },
          ],
        }),
      ),
    ).toThrow(/bindings must be distinct/);
  });

  it('rejects invalid root entry shape during compile', () => {
    expect(() =>
      engine().compile(
        source({
          entry: { name: 'main' },
          functions: {},
        }),
      ),
    ).toThrow(/entry must be text/);
  });

  it('adds structured diagnostics to pointer and function argument errors', () => {
    try {
      execute({
        expr: {
          $pointerGet: {
            object: {},
            path: { $document: '/missing' },
          },
        },
      });
      throw new Error('pointer read should have failed');
    } catch (error) {
      expect(error).toBeInstanceOf(BexException);
      expect((error as BexException).pointer).toBe('undefined');
    }

    try {
      execute({
        expr: {
          $call: {
            function: 'expectsInteger',
            args: { amount: 'nope' },
          },
        },
        functions: {
          expectsInteger: {
            args: {
              amount: { type: 'Integer' },
            },
            expr: { $var: 'amount' },
          },
        },
      });
      throw new Error('function call should have failed');
    } catch (error) {
      expect(error).toBeInstanceOf(BexException);
      expect((error as BexException).functionName).toBe('expectsInteger');
    }
  });

  it('preserves full Blue node surface in nodeToSimple', () => {
    const schema = BexValues.toBlueNodeStrict({
      schema: { required: true },
    }).getSchema();
    if (schema === undefined) {
      throw new Error('schema should have been created');
    }
    const input = new BlueNode()
      .setName('Field')
      .setDescription('Description')
      .setType(new BlueNode().setReferenceBlueId('TypeBlueId'))
      .setItemType(new BlueNode().setName('ItemType'))
      .setKeyType(new BlueNode().setName('KeyType'))
      .setValueType(new BlueNode().setName('ValueType'))
      .setSchema(schema)
      .setMergePolicy('append-only')
      .setContractsNode(new BlueNode().setProperties({ marker: node(true) }))
      .setValue('value');

    expect(nodeToSimple(input)).toEqual({
      name: 'Field',
      description: 'Description',
      type: { blueId: 'TypeBlueId' },
      itemType: { name: 'ItemType' },
      keyType: { name: 'KeyType' },
      valueType: { name: 'ValueType' },
      schema: { required: true },
      mergePolicy: 'append-only',
      contracts: { marker: true },
      value: 'value',
    });
  });

  it('validates strict output schema fields', () => {
    expect(() =>
      BexValues.toBlueNodeStrict({
        schema: {
          allowMultiple: true,
        },
      }),
    ).toThrow(/unsupported key allowMultiple/);

    expect(() =>
      BexValues.toBlueNodeStrict({
        schema: { required: true },
        constraints: {},
      }),
    ).toThrow(/mix schema and constraints/);

    expect(
      BexValues.toBlueNodeStrict({
        schema: { required: true },
      })
        .getSchema()
        ?.get('required')
        ?.getValue(),
    ).toBe(true);
  });
});

function engine(): BexEngine {
  return BexEngine.builder().build();
}

function execute(
  program: unknown,
  context = BexExecutionContext.builder().build(),
) {
  return engine().compileAndExecute(source(program), context);
}

function source(program: unknown): BexProgramSource {
  return BexProgramSource.inline(node(program));
}

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
