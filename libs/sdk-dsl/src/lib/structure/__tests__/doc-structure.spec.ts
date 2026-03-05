import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../../doc-builder/doc-builder.js';
import { DocStructure } from '../doc-structure.js';

describe('DocStructure', () => {
  it('extracts root fields, contracts, and sections from a Blue document', () => {
    const document = DocBuilder.doc()
      .name('Counter Structure')
      .description('Structure extraction')
      .field('/counter', 0)
      .section('counterOps', 'Counter operations', 'Tracks increment contracts')
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
      .endSection()
      .buildDocument();

    const structure = DocStructure.from(document);
    expect(structure.name).toBe('Counter Structure');
    expect(structure.description).toBe('Structure extraction');
    expect(structure.fields).toEqual([{ path: '/counter', value: 0 }]);
    expect(structure.sections).toEqual([
      {
        key: 'counterOps',
        title: 'Counter operations',
        summary: 'Tracks increment contracts',
        relatedFields: [],
        relatedContracts: ['ownerChannel', 'increment', 'incrementImpl'],
      },
    ]);
    expect(
      structure.unclassifiedContracts.map((contract) => contract.key).sort(),
    ).toEqual(['increment', 'incrementImpl', 'ownerChannel']);
  });

  it('extracts nested field pointers and section metadata from complex documents', () => {
    const document = DocBuilder.doc()
      .name('Complex Structure')
      .description('Nested field extraction')
      .field('/profile/name', 'Alice')
      .field('/profile/preferences/notifications', true)
      .field('/scores', [1, 2, 3])
      .section('profileSection', 'Profile Section', 'Profile related data')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .operation(
        'syncProfile',
        'ownerChannel',
        Number,
        'Sync profile',
        (steps) => steps.replaceValue('MarkSynced', '/profile/synced', true),
      )
      .endSection()
      .buildDocument();

    const structure = DocStructure.from(document);
    expect(structure.fields).toEqual(
      expect.arrayContaining([
        { path: '/profile/name', value: 'Alice' },
        { path: '/profile/preferences/notifications', value: true },
        { path: '/scores', value: [1, 2, 3] },
      ]),
    );
    expect(structure.sections).toEqual([
      {
        key: 'profileSection',
        title: 'Profile Section',
        summary: 'Profile related data',
        relatedFields: [],
        relatedContracts: ['ownerChannel', 'syncProfile', 'syncProfileImpl'],
      },
    ]);
    expect(structure.contracts.map((contract) => contract.key)).toEqual(
      expect.arrayContaining([
        'profileSection',
        'ownerChannel',
        'syncProfile',
        'syncProfileImpl',
      ]),
    );
  });
});
