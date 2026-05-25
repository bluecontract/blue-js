import { BlueNode } from '@blue-labs/language';
import { describe, expect, it } from 'vitest';
import { BexEngine } from './BexEngine';
import { BexExecutionContext } from './BexExecutionContext';
import { BexProgramSource } from './BexProgramSource';

describe('BEX document views', () => {
  it('reads the canonical document view by default', () => {
    const result = execute(
      {
        expr: { $document: '/status' },
      },
      BexExecutionContext.builder()
        .document(node({ status: 'canonical' }), '/')
        .resolvedDocument(node({ status: 'resolved' }))
        .build(),
    );

    expect(result.value.toSimple()).toBe('canonical');
  });

  it('reads the resolved document view when explicitly requested', () => {
    const result = execute(
      {
        expr: {
          $document: {
            path: '/status',
            view: 'resolved',
          },
        },
      },
      BexExecutionContext.builder()
        .document(node({ status: 'canonical' }), '/')
        .resolvedDocument(node({ status: 'resolved' }))
        .build(),
    );

    expect(result.value.toSimple()).toBe('resolved');
  });

  it('fails deterministically when resolved view is requested but unavailable', () => {
    expect(() =>
      execute(
        {
          expr: {
            $document: {
              path: '/status',
              view: 'resolved',
            },
          },
        },
        BexExecutionContext.builder()
          .document(node({ status: 'canonical' }), '/')
          .build(),
      ),
    ).toThrow(/Resolved document view was requested/);
  });

  it('applies document scope to canonical and resolved document views', () => {
    const context = BexExecutionContext.builder()
      .document(
        node({ contracts: { current: { status: 'canonical' } } }),
        '/contracts/current',
        node({ contracts: { current: { status: 'resolved' } } }),
      )
      .build();

    expect(
      execute({ expr: { $document: 'status' } }, context).value.toSimple(),
    ).toBe('canonical');
    expect(
      execute(
        {
          expr: {
            $document: {
              path: 'status',
              view: 'resolved',
            },
          },
        },
        context,
      ).value.toSimple(),
    ).toBe('resolved');
  });
});

function execute(program: unknown, context: BexExecutionContext) {
  return BexEngine.builder()
    .build()
    .compileAndExecute(BexProgramSource.inline(node(program)), context);
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
