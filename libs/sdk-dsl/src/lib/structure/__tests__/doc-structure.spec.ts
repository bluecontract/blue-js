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
});
