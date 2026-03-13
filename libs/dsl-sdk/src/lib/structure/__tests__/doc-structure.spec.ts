import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../../doc-builder/doc-builder.js';
import { DocStructure } from '../doc-structure.js';

describe('DocStructure', () => {
  it('extracts enriched root fields, contracts, sections, and prompt text', () => {
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
    expect(structure.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/counter',
          value: 0,
          kind: 'primitive',
          valuePreview: '0',
        }),
      ]),
    );
    expect(structure.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'counterOps',
          title: 'Counter operations',
          summary: 'Tracks increment contracts',
          relatedContracts: ['increment', 'incrementImpl', 'ownerChannel'],
        }),
      ]),
    );
    const incrementContract = structure.contracts.find(
      (contract) => contract.key === 'increment',
    );
    expect(incrementContract).toMatchObject({
      key: 'increment',
      kind: 'operation',
      channelBinding: 'ownerChannel',
      requestType: 'Integer',
    });
    expect(incrementContract?.fingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(
      structure.unclassifiedContracts.map((contract) => contract.key).sort(),
    ).toEqual(['increment', 'incrementImpl', 'ownerChannel']);
    const summary = structure.toSummaryJson();
    expect(summary.contracts).toHaveLength(structure.contracts.length);
    expect(summary.fields).toHaveLength(structure.fields.length);
    expect(structure.toPromptText()).toContain('Document: Counter Structure');
    expect(structure.toPromptText()).toContain('Contracts (4)');
    expect(structure.toPromptText()).toContain('increment [operation]');
  });

  it('handles unknown contracts, typed-node-like fields, and root policies safely', () => {
    const structure = DocStructure.from({
      name: 'Unknown Structures',
      profile: {
        type: 'Conversation/Profile',
        version: 1,
      },
      flags: [true, false],
      contracts: {
        unknownContract: {
          foo: 'bar',
        },
        contractsPolicy: {
          type: 'Conversation/Contracts Change Policy',
          requireSectionChanges: true,
        },
      },
      policies: {
        rootPolicy: {
          type: 'Conversation/Contracts Change Policy',
          requireSectionChanges: false,
        },
      },
    });

    expect(structure.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/profile',
          kind: 'typed-node-like object',
          valuePreview: '<Conversation/Profile>',
        }),
        expect.objectContaining({
          path: '/flags',
          kind: 'array',
          valuePreview: '[2 items]',
        }),
      ]),
    );
    expect(structure.contracts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'unknownContract',
          kind: 'other',
        }),
        expect.objectContaining({
          key: 'contractsPolicy',
          kind: 'policy',
        }),
      ]),
    );
    expect(structure.policies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'contractsPolicy',
          summary: 'requireSectionChanges=true',
        }),
        expect.objectContaining({
          key: 'rootPolicy',
          summary: 'requireSectionChanges=false',
        }),
      ]),
    );
    expect(structure.toPromptText()).toContain('Fields (2)');
    expect(structure.toPromptText()).toContain('unknownContract [other]');
  });
});
