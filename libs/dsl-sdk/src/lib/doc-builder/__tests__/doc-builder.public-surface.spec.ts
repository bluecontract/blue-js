import { BlueNode } from '@blue-labs/language';
import { describe, expect, it } from 'vitest';
import { DocBuilder, SimpleDocBuilder } from '../index.js';

describe('DocBuilder public surface', () => {
  it('keeps SimpleDocBuilder as a public entry point for generic documents', () => {
    const built = SimpleDocBuilder.doc()
      .name('Simple parity')
      .field('/counter', 1)
      .buildDocument();

    expect(built).toBeInstanceOf(BlueNode);
  });

  it('contract helper inserts explicit contracts and keeps the builder editable', () => {
    const builder = DocBuilder.doc().name('Editable').contract('auditChannel', {
      type: 'Core/Channel',
      description: 'Audit trail',
    });

    const before = builder.buildJson();
    const after = builder.field('/status', 'ok').buildJson();

    expect(before).toMatchObject({
      name: 'Editable',
      contracts: {
        auditChannel: {
          type: 'Core/Channel',
          description: 'Audit trail',
        },
      },
    });
    expect(after).toMatchObject({
      status: 'ok',
    });
  });

  it('contracts helper inserts multiple contracts deterministically', () => {
    const json = DocBuilder.doc()
      .contracts({
        ownerChannel: {
          type: 'Core/Channel',
        },
        auditChannel: {
          type: 'Core/Channel',
        },
      })
      .buildJson();

    expect(json.contracts).toEqual({
      ownerChannel: {
        type: 'Core/Channel',
      },
      auditChannel: {
        type: 'Core/Channel',
      },
    });
  });

  it('rejects whitespace-only event type aliases with a clear error', () => {
    expect(() =>
      DocBuilder.doc()
        .name('Whitespace alias')
        .onEvent('watch', '   ', (steps) =>
          steps.replaceValue('Set', '/status', 'ok'),
        ),
    ).toThrow(/cannot resolve type alias from empty string/i);
  });
});
