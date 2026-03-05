import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../../doc-builder/doc-builder.js';
import { DocPatch } from '../doc-patch.js';
import { toOfficialJson } from '../../core/serialization.js';

describe('DocPatch', () => {
  it('builds RFC-6902 operations and applies roundtrip edits', () => {
    const original = DocBuilder.doc()
      .name('Patch Counter')
      .field('/counter', 0)
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .operation(
        'increment',
        'ownerChannel',
        Number,
        'Increment counter',
        (steps) =>
          steps.replaceExpression(
            'IncrementCounter',
            '/counter',
            "document('/counter') + event.message.request",
          ),
      )
      .buildDocument();

    const expected = DocBuilder.from(original)
      .field('/counter', 5)
      .operation('increment')
      .description('Increment counter v2')
      .done()
      .buildDocument();

    const patch = DocPatch.from(original).mutate((doc) => {
      doc.field('/counter', 5);
      doc.operation('increment').description('Increment counter v2').done();
    });

    const operations = patch.build();
    expect(operations.length).toBeGreaterThan(0);
    expect(operations.some((operation) => operation.path === '/counter')).toBe(
      true,
    );

    const patched = patch.applyTo(original, false);
    expect(toOfficialJson(patched)).toEqual(toOfficialJson(expected));
  });

  it('can remove contracts via generated patch operations', () => {
    const original = DocBuilder.doc()
      .name('Patch Remove Contract')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .operation(
        'increment',
        'ownerChannel',
        Number,
        'Increment counter',
        (steps) =>
          steps.replaceExpression(
            'IncrementCounter',
            '/counter',
            "document('/counter') + event.message.request",
          ),
      )
      .buildDocument();

    const patch = DocPatch.from(original).removeContract('incrementImpl');
    expect(patch.build()).toEqual([
      {
        op: 'remove',
        path: '/contracts/incrementImpl',
      },
    ]);
  });

  it('supports nested pointer updates and mutateOriginal application mode', () => {
    const original = DocBuilder.doc()
      .name('Patch Nested')
      .field('/profile/name', 'Alice')
      .field('/profile/active', false)
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .buildDocument();

    const patch = DocPatch.from(original)
      .field('/profile/active', true)
      .field('/profile/role', 'admin')
      .remove('/profile/name')
      .contract('auditChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'audit-timeline',
      });

    const operations = patch.build();
    expect(operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: 'replace',
          path: '/profile/active',
          val: true,
        }),
        expect.objectContaining({
          op: 'remove',
          path: '/profile/name',
        }),
        expect.objectContaining({
          op: 'add',
          path: '/profile/role',
          val: 'admin',
        }),
      ]),
    );

    patch.applyTo(original, true);
    const mutated = toOfficialJson(original);
    expect(mutated.profile).toMatchObject({
      active: true,
      role: 'admin',
    });
    expect(mutated.profile).not.toHaveProperty('name');
    expect(mutated.contracts?.auditChannel).toMatchObject({
      type: 'Conversation/Timeline Channel',
      timelineId: 'audit-timeline',
    });
  });
});
