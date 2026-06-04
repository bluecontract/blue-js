import { BlueNode, Properties } from '@blue-labs/language';
import Big from 'big.js';
import { describe, expect, it } from 'vitest';
import { BexException } from '../BexException';
import { BexValues, nodeToSimple, nodeToValueSimple } from '../value/BexValues';
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

  it('creates value-local snapshots for resolved event payloads', () => {
    const input = new BlueNode()
      .setDescription('Resolved schema description')
      .setType(new BlueNode().setReferenceBlueId('IntegerType'))
      .setValue(7);

    expect(nodeToValueSimple(input)).toEqual({
      description: 'Resolved schema description',
      type: { blueId: 'IntegerType' },
      value: 7,
    });
  });

  it('exposes value-local object metadata in node snapshots', () => {
    const input = new BlueNode()
      .setName('Display')
      .setDescription('Resolved description')
      .setProperties({ child: node(1) });

    expect(nodeToValueSimple(input)).toEqual({
      name: 'Display',
      description: 'Resolved description',
      child: 1,
    });
  });

  it('exposes schema, merge policy, and contracts in value snapshots', () => {
    const schema = BexValues.toBlueNodeStrict({
      schema: { required: true },
    }).getSchema();
    if (schema === undefined) {
      throw new Error('schema should have been created');
    }
    const input = new BlueNode()
      .setSchema(schema)
      .setMergePolicy('append')
      .setContractsNode(new BlueNode().setProperties({ marker: node(true) }));

    expect(nodeToValueSimple(input)).toEqual({
      schema: { required: true },
      mergePolicy: 'append',
      contracts: { marker: true },
    });
  });

  it('returns an object for metadata-only value snapshots', () => {
    expect(
      nodeToValueSimple(new BlueNode().setDescription('metadata only')),
    ).toEqual({
      description: 'metadata only',
    });
  });

  it('preserves large integer snapshots exactly', () => {
    const input = new BlueNode()
      .setType(
        new BlueNode().setReferenceBlueId(Properties.INTEGER_TYPE_BLUE_ID),
      )
      .setValue('9007199254740993');

    expect(nodeToValueSimple(input)).toBe('9007199254740993');
  });

  it('preserves large integer BEX bindings exactly', () => {
    expect(BexValues.fromSimple(new Big('9007199254740993')).toSimple()).toBe(
      '9007199254740993',
    );
  });

  it('preserves decimal money values without number rounding', () => {
    expect(BexValues.fromSimple(new Big('10.2300')).toSimple()).toBe('10.23');
    expect(
      execute({ expr: { $number: '1234567890.123456789' } }).value.toSimple(),
    ).toBe('1234567890.123456789');
  });

  it('does not convert decimal arithmetic through JavaScript number rounding', () => {
    expect(() => execute({ expr: { $add: ['0.1', '0.2'] } })).toThrow(
      /Cannot convert value to integer/,
    );
  });

  it('bexDecimalBindingRemainsTextUnlessExplicitNumberOrDouble', () => {
    const context = BexExecutionContext.builder()
      .binding('amount', BexValues.fromSimple(new Big('123.4500')))
      .build();

    expect(
      execute({ expr: { $binding: 'amount' } }, context).value.toSimple(),
    ).toBe('123.45');
    expect(execute({ expr: { $number: '123.4500' } }).value.toSimple()).toBe(
      '123.4500',
    );
  });

  it('bexUnsafeIntegerBindingRemainsExact', () => {
    const context = BexExecutionContext.builder()
      .binding('unsafe', BexValues.fromSimple(new Big('9007199254740993123')))
      .build();

    expect(
      execute({ expr: { $binding: 'unsafe' } }, context).value.toSimple(),
    ).toBe('9007199254740993123');
  });

  it('bexPayNoteAmountDoesNotRoundThroughNumber', () => {
    const context = BexExecutionContext.builder()
      .binding(
        'payNote',
        BexValues.fromSimple({
          amount: new Big('9999999999999999.99'),
        }),
      )
      .build();

    expect(
      execute(
        { expr: { $binding: { name: 'payNote', path: '/amount' } } },
        context,
      ).value.toSimple(),
    ).toBe('9999999999999999.99');
  });

  it('bexAddRejectsDecimalUnlessExplicitDecimalOperatorExists', () => {
    expect(() => execute({ expr: { $add: ['1.5', '2.5'] } })).toThrow(
      /Cannot convert value to integer/,
    );
  });

  it('bexComparisonDoesNotCoerceLargeIntegerToNumber', () => {
    expect(
      execute({
        expr: { $gt: ['9007199254740993123', '9007199254740993122'] },
      }).value.toSimple(),
    ).toBe(true);
  });

  it('compacts primitive scalar snapshots with named primitive type metadata', () => {
    expect(
      nodeToValueSimple(new BlueNode().setType('Boolean').setValue(true)),
    ).toBe(true);
  });

  it('allows processor event snapshots to compact scalar metadata explicitly', () => {
    const input = new BlueNode()
      .setDescription('resolved metadata')
      .setType('Boolean')
      .setValue(true);

    expect(
      BexValues.nodeValueSnapshot(input, {
        compactScalarsWithMetadata: true,
      }).toSimple(),
    ).toBe(true);
  });

  it('allows processor event snapshots to compact list metadata explicitly', () => {
    const input = new BlueNode()
      .setItemType('Event')
      .setItems([node({ type: 'Example/Event' })]);

    expect(
      BexValues.nodeValueSnapshot(input, {
        compactListsWithMetadata: true,
      }).toSimple(),
    ).toEqual([{ type: 'Example/Event' }]);
  });

  it('allows processor event snapshots to omit metadata-only resolved fields', () => {
    const input = new BlueNode().setDescription('resolved schema field');

    expect(
      BexValues.nodeValueSnapshot(input, {
        omitMetadataOnly: true,
      }).toSimple(),
    ).toBeUndefined();
  });

  it('preserves type-only contract descriptors when omitting metadata-only nodes', () => {
    const input = new BlueNode().setProperties({
      contracts: new BlueNode().setProperties({
        sellerChannel: new BlueNode().setType(
          new BlueNode().setReferenceBlueId('MyOSTimelineChannelBlueId'),
        ),
      }),
    });

    expect(
      BexValues.nodeValueSnapshot(input, {
        omitMetadataOnly: true,
      }).toSimple(),
    ).toEqual({
      contracts: {
        sellerChannel: {
          type: { blueId: 'MyOSTimelineChannelBlueId' },
        },
      },
    });
  });

  it('keeps BEX program sources frozen until extraction', () => {
    const frozen = {
      toNode() {
        throw new Error('BexProgramSource.inline must not materialize input');
      },
    } as unknown as Parameters<typeof BexProgramSource.inline>[0];

    expect(BexProgramSource.inline(frozen).node).toBe(frozen);
  });

  it('ignores inherited metadata on resolved function containers', () => {
    const functions = new BlueNode().setDescription('inherited').setProperties({
      main: node({ expr: 'ok' }),
    });
    const program = new BlueNode().setProperties({
      expr: node({ $call: { function: 'main', args: {} } }),
      functions,
    });

    expect(
      engine()
        .compileAndExecute(
          BexProgramSource.inline(program, { inputKind: 'resolved' }),
          BexExecutionContext.builder().build(),
        )
        .value.toSimple(),
    ).toBe('ok');
  });

  it('ignores inherited metadata on resolved constants containers', () => {
    const constants = new BlueNode().setDescription('inherited').setProperties({
      answer: node(42),
    });
    const program = new BlueNode().setProperties({
      expr: node({ $const: 'answer' }),
      constants,
    });

    expect(
      engine()
        .compileAndExecute(
          BexProgramSource.inline(program, { inputKind: 'resolved' }),
          BexExecutionContext.builder().build(),
        )
        .value.toSimple(),
    ).toBe(42);
  });

  it('ignores inherited metadata on resolved function and call arg containers', () => {
    const declaredArgs = new BlueNode()
      .setDescription('inherited')
      .setProperties({
        input: node({}),
      });
    const callArgs = new BlueNode().setDescription('inherited').setProperties({
      input: node('ok'),
    });
    const program = new BlueNode().setProperties({
      expr: new BlueNode().setProperties({
        $call: new BlueNode().setProperties({
          function: node('main'),
          args: callArgs,
        }),
      }),
      functions: new BlueNode().setProperties({
        main: new BlueNode().setProperties({
          args: declaredArgs,
          expr: node({ $var: 'input' }),
        }),
      }),
    });

    expect(
      engine()
        .compileAndExecute(
          BexProgramSource.inline(program, { inputKind: 'resolved' }),
          BexExecutionContext.builder().build(),
        )
        .value.toSimple(),
    ).toBe('ok');
  });

  it('ignores Blue metadata when detecting resolved expression operators', () => {
    const expression = new BlueNode().setType('Text').setProperties({
      $unwrap: node({ $literal: 'ok' }),
    });
    const program = new BlueNode().setProperties({
      expr: expression,
    });

    expect(
      engine()
        .compileAndExecute(
          BexProgramSource.inline(program, { inputKind: 'resolved' }),
          BexExecutionContext.builder().build(),
        )
        .value.toSimple(),
    ).toBe('ok');
  });

  it('does not treat mixed dollar objects as expression operators', () => {
    expect(
      execute({
        expr: {
          type: 'Text',
          $document: 'not-op',
          x: 1,
        },
      }).value.toSimple(),
    ).toEqual({
      $document: 'not-op',
      type: 'Text',
      x: 1,
    });
  });

  it('uses Java-parity multi-let ordering semantics', () => {
    expect(
      execute({
        do: [
          { $let: { name: 'a', expr: 'old' } },
          {
            $let: {
              vars: {
                a: 'new',
                b: { $var: 'a' },
              },
            },
          },
          { $return: { a: { $var: 'a' }, b: { $var: 'b' } } },
        ],
      }).value.toSimple(),
    ).toEqual({ a: 'new', b: 'old' });

    expect(
      execute({
        do: [
          { $let: { name: 'a', expr: 'old' } },
          {
            $let: {
              order: ['a', 'b'],
              vars: {
                a: 'new',
                b: { $var: 'a' },
              },
            },
          },
          { $return: { a: { $var: 'a' }, b: { $var: 'b' } } },
        ],
      }).value.toSimple(),
    ).toEqual({ a: 'new', b: 'new' });

    expect(() =>
      execute({
        do: [
          {
            $let: {
              order: ['a'],
              vars: { a: 1, b: 2 },
            },
          },
        ],
      }),
    ).toThrow(/\$let\.order missing variable: b/);

    expect(() =>
      execute({
        do: [
          {
            $let: {
              order: ['a', 'a'],
              vars: { a: 1 },
            },
          },
        ],
      }),
    ).toThrow(/\$let\.order contains duplicate variable: a/);

    expect(() =>
      execute({
        do: [
          {
            $let: {
              order: ['a', 'b'],
              vars: { a: 1 },
            },
          },
        ],
      }),
    ).toThrow(/\$let\.order references unknown variable: b/);

    expect(() =>
      execute({
        do: [
          {
            $let: {
              order: 'a',
              vars: { a: 1 },
            },
          },
        ],
      }),
    ).toThrow(/\$let\.order must be a list/);
  });

  it('rejects source-authored reserved BEX names', () => {
    expect(() =>
      engine().compile(
        source({
          functions: {
            description: { expr: 'bad' },
          },
        }),
      ),
    ).toThrow(/reserved Blue key: description/);

    expect(() =>
      engine().compile(
        source({
          constants: {
            type: 'bad',
          },
        }),
      ),
    ).toThrow(/reserved Blue key: type/);

    expect(() =>
      engine().compile(
        source({
          functions: {
            main: {
              args: {
                value: {},
              },
              expr: 'bad',
            },
          },
        }),
      ),
    ).toThrow(/reserved Blue key: value/);
  });

  it('does not let resolved function definition metadata overwrite executable body', () => {
    const main = new BlueNode()
      .setDescription('inherited')
      .setValue('metadata payload')
      .setProperties({
        expr: node('body result'),
      });
    const program = new BlueNode().setProperties({
      expr: node({ $call: { function: 'main', args: {} } }),
      functions: new BlueNode().setProperties({ main }),
    });

    expect(
      engine()
        .compileAndExecute(
          BexProgramSource.inline(program, { inputKind: 'resolved' }),
          BexExecutionContext.builder().build(),
        )
        .value.toSimple(),
    ).toBe('body result');
  });

  it('uses exact integer arithmetic beyond the JavaScript safe range', () => {
    expect(
      execute({
        expr: { $add: ['9007199254740993', '7'] },
      }).value.toSimple(),
    ).toBe('9007199254741000');
  });

  it('defaults object-form $binding reads to the event binding', () => {
    const context = BexExecutionContext.builder()
      .event(
        BexValues.fromSimple({
          message: {
            request: 'payload',
          },
        }),
      )
      .build();

    expect(
      execute(
        { expr: { $binding: { path: '/message/request' } } },
        context,
      ).value.toSimple(),
    ).toBe('payload');
  });

  it('keeps documentation-only function argument declarations', () => {
    expect(
      execute({
        expr: {
          $call: {
            function: 'echo',
            args: {
              val: 'ok',
            },
          },
        },
        functions: {
          echo: {
            args: {
              val: undefined,
            },
            expr: {
              $var: 'val',
            },
          },
        },
      }).value.toSimple(),
    ).toBe('ok');
  });

  it('honors Blue type blueId patterns in $is', () => {
    expect(
      execute({
        expr: {
          $is: {
            node: {
              type: { blueId: 'HotelOrderType' },
              status: 'confirmed',
            },
            pattern: {
              blueId: 'HotelOrderType',
            },
          },
        },
      }).value.toSimple(),
    ).toBe(true);

    expect(
      execute({
        expr: {
          $is: {
            node: {
              type: { blueId: 'HotelOrderType' },
              status: 'confirmed',
            },
            pattern: {
              type: { blueId: 'HotelOrderType' },
            },
          },
        },
      }).value.toSimple(),
    ).toBe(true);

    expect(
      execute({
        expr: {
          $is: {
            node: {
              type: { blueId: 'RestaurantOrderType' },
              status: 'confirmed',
            },
            pattern: {
              type: { blueId: 'HotelOrderType' },
            },
          },
        },
      }).value.toSimple(),
    ).toBe(false);
  });

  it('does not treat type.name as authored alias syntax in $is', () => {
    expect(
      execute({
        expr: {
          $is: {
            node: 10,
            pattern: {
              type: {
                name: 'Integer',
              },
            },
          },
        },
      }).value.toSimple(),
    ).toBe(false);
  });

  it('normalizes static type-position aliases in $is patterns', () => {
    expect(
      execute({
        expr: {
          $is: {
            node: [1, 2],
            pattern: {
              type: 'List',
              itemType: 'Integer',
            },
          },
        },
      }).value.toSimple(),
    ).toBe(true);

    expect(
      execute({
        expr: {
          $is: {
            node: [1, 'nope'],
            pattern: {
              type: 'List',
              itemType: 'Integer',
            },
          },
        },
      }).value.toSimple(),
    ).toBe(false);

    expect(
      execute({
        expr: {
          $is: {
            node: {
              a: 1,
              b: 2,
            },
            pattern: {
              type: 'Dictionary',
              keyType: 'Text',
              valueType: 'Integer',
            },
          },
        },
      }).value.toSimple(),
    ).toBe(true);

    expect(
      execute({
        expr: {
          $is: {
            node: {
              a: 1,
              b: 'nope',
            },
            pattern: {
              type: 'Dictionary',
              keyType: 'Text',
              valueType: 'Integer',
            },
          },
        },
      }).value.toSimple(),
    ).toBe(false);
  });

  it('uses the same Blue matcher for function argument patterns', () => {
    expect(
      execute({
        expr: {
          $call: {
            function: 'acceptHotelOrder',
            args: {
              order: {
                type: { blueId: 'HotelOrderType' },
                status: 'confirmed',
              },
            },
          },
        },
        functions: {
          acceptHotelOrder: {
            args: {
              order: {
                type: { blueId: 'HotelOrderType' },
              },
            },
            expr: 'accepted',
          },
        },
      }).value.toSimple(),
    ).toBe('accepted');

    expect(() =>
      execute({
        expr: {
          $call: {
            function: 'acceptHotelOrder',
            args: {
              order: {
                type: { blueId: 'RestaurantOrderType' },
                status: 'confirmed',
              },
            },
          },
        },
        functions: {
          acceptHotelOrder: {
            args: {
              order: {
                type: { blueId: 'HotelOrderType' },
              },
            },
            expr: 'accepted',
          },
        },
      }),
    ).toThrow(/does not match declared Blue pattern/);
  });

  it('normalizes static type-position aliases in function argument patterns', () => {
    expect(
      execute({
        expr: {
          $call: {
            function: 'acceptIntegerList',
            args: {
              values: [1, 2],
            },
          },
        },
        functions: {
          acceptIntegerList: {
            args: {
              values: {
                type: 'List',
                itemType: 'Integer',
              },
            },
            expr: 'accepted',
          },
        },
      }).value.toSimple(),
    ).toBe('accepted');

    expect(() =>
      execute({
        expr: {
          $call: {
            function: 'acceptIntegerList',
            args: {
              values: [1, 'nope'],
            },
          },
        },
        functions: {
          acceptIntegerList: {
            args: {
              values: {
                type: 'List',
                itemType: 'Integer',
              },
            },
            expr: 'accepted',
          },
        },
      }),
    ).toThrow(/does not match declared Blue pattern/);

    expect(
      execute({
        expr: {
          $call: {
            function: 'acceptIntegerDictionary',
            args: {
              values: {
                a: 1,
                b: 2,
              },
            },
          },
        },
        functions: {
          acceptIntegerDictionary: {
            args: {
              values: {
                type: 'Dictionary',
                keyType: 'Text',
                valueType: 'Integer',
              },
            },
            expr: 'accepted',
          },
        },
      }).value.toSimple(),
    ).toBe('accepted');

    expect(() =>
      execute({
        expr: {
          $call: {
            function: 'acceptIntegerDictionary',
            args: {
              values: {
                a: 1,
                b: 'nope',
              },
            },
          },
        },
        functions: {
          acceptIntegerDictionary: {
            args: {
              values: {
                type: 'Dictionary',
                keyType: 'Text',
                valueType: 'Integer',
              },
            },
            expr: 'accepted',
          },
        },
      }),
    ).toThrow(/does not match declared Blue pattern/);
  });

  it('preserves primitive type patterns in $is', () => {
    expect(
      execute({
        expr: {
          $is: {
            node: 'ready',
            pattern: { type: 'Text' },
          },
        },
      }).value.toSimple(),
    ).toBe(true);

    expect(
      execute({
        expr: {
          $is: {
            node: true,
            pattern: { type: 'Text' },
          },
        },
      }).value.toSimple(),
    ).toBe(false);

    expect(
      execute({
        expr: {
          $is: {
            node: { type: 'Integer', value: 7 },
            pattern: { type: 'Integer' },
          },
        },
      }).value.toSimple(),
    ).toBe(false);
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
