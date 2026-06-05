import { BlueNode } from '@blue-labs/language';
import { describe, expect, it } from 'vitest';

import { BexValues } from '../value/BexValues';
import { BexEngine } from './BexEngine';
import { BexDocumentView, BexExecutionContext } from './BexExecutionContext';
import { BexProgramSource } from './BexProgramSource';

describe('$resultValue', () => {
  const document = {
    hotelOrder: {
      amount: 100,
      status: 'pending',
    },
  };

  const replaceHotelStatusProgram = {
    do: [
      {
        $appendChange: {
          op: 'replace',
          path: '/hotelOrder/status',
          val: 'confirmed',
        },
      },
      {
        $return: {
          hotelOrder: {
            $resultValue: '/hotelOrder',
          },
        },
      },
    ],
  };

  it('seeds the result overlay from a documentView root', () => {
    const requestedPointers: string[] = [];
    const context = BexExecutionContext.builder()
      .documentView(
        documentView(
          {
            '/': document,
            '/hotelOrder': document.hotelOrder,
            '/hotelOrder/status': 'pending',
          },
          requestedPointers,
        ),
      )
      .build();

    const result = execute(replaceHotelStatusProgram, context);

    expect(result.value.toSimple()).toEqual({
      hotelOrder: {
        amount: 100,
        status: 'confirmed',
      },
    });
    expect(requestedPointers).toEqual(['/']);
  });

  it('keeps materialized document result overlays intact', () => {
    const context = BexExecutionContext.builder()
      .document(node(document))
      .build();

    const result = execute(replaceHotelStatusProgram, context);

    expect(result.value.toSimple()).toEqual({
      hotelOrder: {
        amount: 100,
        status: 'confirmed',
      },
    });
  });

  it('keeps the default result as accumulated changeset and events', () => {
    const result = execute(
      {
        do: [
          {
            $appendChange: {
              op: 'replace',
              path: '/hotelOrder/status',
              val: 'confirmed',
            },
          },
        ],
      },
      BexExecutionContext.builder().document(node(document)).build(),
    );

    expect(result.value.toSimple()).toEqual({
      changeset: [
        {
          op: 'replace',
          path: '/hotelOrder/status',
          val: 'confirmed',
        },
      ],
      events: [],
    });
    expect(result.changeset.toSimple()).toEqual([
      {
        op: 'replace',
        path: '/hotelOrder/status',
        val: 'confirmed',
      },
    ]);
  });

  it('reads list removals as non-shifting overlay updates', () => {
    const result = execute(
      {
        do: [
          {
            $appendChange: {
              op: 'remove',
              path: '/items/0',
            },
          },
          {
            $return: {
              first: {
                $resultValue: '/items/0',
              },
              second: {
                $resultValue: '/items/1',
              },
              size: {
                $size: {
                  $resultValue: '/items',
                },
              },
            },
          },
        ],
      },
      BexExecutionContext.builder()
        .document(node({ items: ['A', 'B', 'C'] }))
        .build(),
    );

    expect(result.value.toSimple()).toEqual({
      second: 'B',
      size: 3,
    });
  });

  it('reads list add/set as non-shifting overlay updates', () => {
    const result = execute(
      {
        do: [
          {
            $appendChange: {
              op: 'add',
              path: '/items/1',
              val: 'X',
            },
          },
          {
            $return: {
              i0: {
                $resultValue: '/items/0',
              },
              i1: {
                $resultValue: '/items/1',
              },
              i2: {
                $resultValue: '/items/2',
              },
              size: {
                $size: {
                  $resultValue: '/items',
                },
              },
            },
          },
        ],
      },
      BexExecutionContext.builder()
        .document(node({ items: ['A', 'B', 'C'] }))
        .build(),
    );

    // $resultValue is an overlay preview, not the host JSON Patch application
    // engine. List add/remove updates do not splice or shift existing indexes.
    expect(result.value.toSimple()).toEqual({
      i0: 'A',
      i1: 'X',
      i2: 'C',
      size: 3,
    });
  });

  it('does not treat sparse overlay lists as portable Blue output', () => {
    const result = execute(
      {
        do: [
          {
            $appendChange: {
              op: 'remove',
              path: '/items/0',
            },
          },
          {
            $return: {
              items: {
                $resultValue: '/items',
              },
            },
          },
        ],
      },
      BexExecutionContext.builder()
        .document(node({ items: ['A', 'B', 'C'] }))
        .build(),
    );

    expect(result.value.toSimple()).toEqual({
      items: [undefined, 'B', 'C'],
    });
    expect(() => result.valueAsBlueNodeStrict()).toThrow(/cannot be undefined/);
  });
});

function execute(program: unknown, context: BexExecutionContext) {
  return BexEngine.builder()
    .build()
    .compileAndExecute(BexProgramSource.inline(node(program)), context);
}

function documentView(
  values: Record<string, unknown>,
  requestedPointers: string[],
): BexDocumentView {
  return {
    canonicalAt(pointer: string) {
      requestedPointers.push(pointer);
      return BexValues.fromSimple(values[pointer]);
    },
    resolvedAt(pointer: string) {
      return BexValues.fromSimple(values[pointer]);
    },
  };
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
