import { BlueNode } from '@blue-labs/language';
import { describe, expect, it } from 'vitest';

import { BexException } from '../BexException';
import { BexValues } from '../value/BexValues';
import { BexEngine } from './BexEngine';
import { BexExecutionContext } from './BexExecutionContext';
import { BexProgramSource } from './BexProgramSource';

const ECHO_BLUE_ID = 'TestIntrinsicEcho';
const GAS_BLUE_ID = 'TestIntrinsicGas';

describe('BEX intrinsics', () => {
  it('passes evaluated fields and intrinsic metadata to registered processors', () => {
    const engine = BexEngine.builder()
      .intrinsic(ECHO_BLUE_ID, (invocation) => {
        invocation.chargeGas(7);
        return BexValues.fromSimple({
          blueId: invocation.blueId,
          fieldCount: invocation.fields().size,
          missingIsUndefined: invocation.field('missing').isUndefined(),
          payload: invocation.field('payload').toSimple(),
          type: invocation.type.toSimple(),
        });
      })
      .build();

    const result = engine.compileAndExecute(
      source({
        expr: {
          $intrinsic: {
            type: { blueId: ECHO_BLUE_ID },
            payload: {
              $concat: ['hel', 'lo'],
            },
            omitted: {
              $document: '/missing',
            },
          },
        },
      }),
      BexExecutionContext.builder().build(),
    );

    expect(result.value.toSimple()).toEqual({
      blueId: ECHO_BLUE_ID,
      fieldCount: 1,
      missingIsUndefined: true,
      payload: 'hello',
      type: { blueId: ECHO_BLUE_ID },
    });
    expect(result.gasUsed).toBeGreaterThanOrEqual(7);
  });

  it('rejects unsupported intrinsics at compile time', () => {
    expect(() =>
      BexEngine.builder()
        .build()
        .compile(
          source({
            expr: {
              $intrinsic: {
                type: { blueId: ECHO_BLUE_ID },
              },
            },
          }),
        ),
    ).toThrow(`Unsupported intrinsic BlueId: ${ECHO_BLUE_ID}`);
  });

  it('enforces gas charged by intrinsic processors', () => {
    const engine = BexEngine.builder()
      .intrinsic(GAS_BLUE_ID, (invocation) => {
        invocation.chargeGas(25);
        return BexValues.fromSimple(true);
      })
      .build();

    expect(() =>
      engine.compileAndExecute(
        source({
          expr: {
            $intrinsic: {
              type: { blueId: GAS_BLUE_ID },
            },
          },
        }),
        BexExecutionContext.builder().gasLimit(10).build(),
      ),
    ).toThrow(BexException);
  });
});

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
