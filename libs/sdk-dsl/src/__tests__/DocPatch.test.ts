/*
Java references:
- references/java-sdk/src/test/java/blue/language/sdk/patch/PatchSetTest.java
*/

import { DocBuilder, DocPatch } from '../lib';
import { assertCanonicalNodeEquals } from './editing-support';

describe('DocPatch', () => {
  type ReservedPayload = Record<string, string | string[]>;

  it('adds one root field as a single add operation and applies it', () => {
    const before = DocBuilder.doc()
      .name('Doc')
      .field('/counter', 1)
      .buildDocument();
    const after = DocBuilder.from(before.clone())
      .field('/status', 'ready')
      .buildDocument();

    const patch = DocPatch.from(before).diff(after);
    const operations = patch.build();

    expect(operations).toHaveLength(1);
    expect(operations[0]).toMatchObject({
      op: 'add',
      path: '/status',
      value: {
        $sdkDslNode: {
          type: 'Text',
          value: 'ready',
          inlineValue: true,
        },
      },
    });
    assertCanonicalNodeEquals(patch.apply(), after);
  });

  it('replaces a scalar root field deterministically', () => {
    const before = DocBuilder.doc()
      .name('Doc')
      .field('/counter', 1)
      .buildDocument();
    const after = DocBuilder.from(before.clone())
      .replace('/counter', 2)
      .buildDocument();

    const operations = DocPatch.from(before).diff(after).build();

    expect(operations).toHaveLength(1);
    expect(operations[0]).toMatchObject({
      op: 'replace',
      path: '/counter',
      value: {
        $sdkDslNode: {
          type: 'Integer',
          value: 2,
          inlineValue: true,
        },
      },
    });
  });

  it('replaces nested objects and arrays as whole values in the generic diff', () => {
    const before = DocBuilder.doc()
      .name('Doc')
      .field('/settings', {
        enabled: true,
        retries: [1, 2],
      })
      .buildDocument();
    const after = DocBuilder.doc()
      .name('Doc')
      .field('/settings', {
        enabled: false,
        retries: [1, 3, 5],
      })
      .buildDocument();

    const operations = DocPatch.from(before).diff(after).build();

    expect(operations).toHaveLength(1);
    expect(operations[0]).toMatchObject({
      op: 'replace',
      path: '/settings',
      value: {
        enabled: {
          $sdkDslNode: {
            type: 'Boolean',
            value: false,
            inlineValue: true,
          },
        },
      },
    });
    expect(Array.isArray((operations[0] as { value?: unknown }).value)).toBe(
      false,
    );
  });

  it('orders removals, replacements, and additions deterministically', () => {
    const before = DocBuilder.doc()
      .name('Doc')
      .field('/a', 1)
      .field('/b', 2)
      .field('/c', 3)
      .buildDocument();
    const after = DocBuilder.doc()
      .name('Doc')
      .field('/a', 1)
      .field('/b', 20)
      .field('/d', 4)
      .buildDocument();

    const patch = DocPatch.from(before).diff(after);

    expect(patch.build()).toMatchObject([
      {
        op: 'remove',
        path: '/c',
      },
      {
        op: 'replace',
        path: '/b',
        value: {
          $sdkDslNode: {
            type: 'Integer',
            value: 20,
            inlineValue: true,
          },
        },
      },
      {
        op: 'add',
        path: '/d',
        value: {
          $sdkDslNode: {
            type: 'Integer',
            value: 4,
            inlineValue: true,
          },
        },
      },
    ]);
    assertCanonicalNodeEquals(patch.apply(), after);
  });

  it.each([
    {
      label: '$sdkDslNode only',
      beforePayload: {
        $sdkDslNode: 'before',
      } as ReservedPayload,
      afterPayload: {
        $sdkDslNode: 'after',
      } as ReservedPayload,
    },
    {
      label: '$sdkDslItems only',
      beforePayload: {
        $sdkDslItems: ['a', 'b'],
      } as ReservedPayload,
      afterPayload: {
        $sdkDslItems: ['a', 'b', 'c'],
      } as ReservedPayload,
    },
    {
      label: 'both reserved-looking keys together',
      beforePayload: {
        $sdkDslNode: 'before',
        $sdkDslItems: ['a', 'b'],
      } as ReservedPayload,
      afterPayload: {
        $sdkDslNode: 'after',
        $sdkDslItems: ['c', 'd'],
      } as ReservedPayload,
    },
    {
      label: '$sdkDslEnvelope marker-looking key',
      beforePayload: {
        $sdkDslEnvelope: 'before',
      } as ReservedPayload,
      afterPayload: {
        $sdkDslEnvelope: 'after',
      } as ReservedPayload,
    },
  ])(
    'roundtrips root payload objects containing $label',
    ({ beforePayload, afterPayload }) => {
      const before = DocBuilder.doc()
        .name('Reserved keys')
        .field('/payload', beforePayload)
        .buildDocument();
      const after = DocBuilder.doc()
        .name('Reserved keys')
        .field('/payload', afterPayload)
        .buildDocument();

      assertCanonicalNodeEquals(DocPatch.from(before).apply(), before);

      const patch = DocPatch.from(before).diff(after);
      expect(patch.build()).toHaveLength(1);
      expect(patch.build()[0]?.path).toBe('/payload');
      assertCanonicalNodeEquals(patch.apply(), after);
    },
  );

  it('can patch inside contracts generically without BLUE-aware atomicity', () => {
    const before = DocBuilder.doc()
      .name('Counter')
      .field('/counter', 0)
      .channel('ownerChannel')
      .operation('increment')
      .channel('ownerChannel')
      .description('Increment counter')
      .requestType('Integer')
      .steps((steps) =>
        steps.replaceExpression(
          'Apply',
          '/counter',
          "document('/counter') + event.message.request",
        ),
      )
      .done()
      .buildDocument();
    const after = DocBuilder.from(before.clone())
      .replace(
        '/contracts/incrementImpl/steps/0/changeset/0/val/value',
        "${document('/counter') + (event.message.request * 2)}",
      )
      .buildDocument();

    const operations = DocPatch.from(before).diff(after).build();

    expect(
      operations.some((operation) =>
        operation.path.startsWith('/contracts/incrementImpl/steps'),
      ),
    ).toBe(true);
    assertCanonicalNodeEquals(DocPatch.from(before).diff(after).apply(), after);
  });
});
