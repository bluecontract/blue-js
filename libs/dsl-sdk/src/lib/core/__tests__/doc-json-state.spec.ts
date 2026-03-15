import { describe, expect, it } from 'vitest';
import { DocJsonState } from '../doc-json-state.js';
import { ensureExpression } from '../serialization.js';

describe('core/DocJsonState', () => {
  it('builds root metadata and fields', () => {
    const state = new DocJsonState()
      .setName('Counter')
      .setDescription('Simple')
      .setType('MyOS/Agent')
      .setValue('/counter', 0);

    expect(state.build()).toEqual({
      name: 'Counter',
      description: 'Simple',
      type: 'MyOS/Agent',
      counter: 0,
    });
  });

  it('tracks section related fields and contracts', () => {
    const state = new DocJsonState()
      .section('counterOps', 'Counter Operations', 'Counter actions')
      .setValue('/counter', 0)
      .setContract('increment', {
        type: 'Conversation/Operation',
        channel: 'ownerChannel',
      })
      .setContract('incrementImpl', {
        type: 'Conversation/Sequential Workflow Operation',
        operation: 'increment',
      })
      .endSection();

    expect(state.build()).toEqual({
      counter: 0,
      contracts: {
        increment: {
          type: 'Conversation/Operation',
          channel: 'ownerChannel',
        },
        incrementImpl: {
          type: 'Conversation/Sequential Workflow Operation',
          operation: 'increment',
        },
        counterOps: {
          type: 'Conversation/Document Section',
          title: 'Counter Operations',
          summary: 'Counter actions',
          relatedFields: ['/counter'],
          relatedContracts: ['increment', 'incrementImpl'],
        },
      },
    });
  });

  it('removes deleted field paths from active section metadata', () => {
    const state = new DocJsonState()
      .section('counterOps', 'Counter Operations')
      .setValue('/counter', 0)
      .removeValue('/counter')
      .endSection();

    expect(state.build()).toEqual({
      contracts: {
        counterOps: {
          type: 'Conversation/Document Section',
          title: 'Counter Operations',
        },
      },
    });
  });

  it('reopens an existing section and preserves related entries', () => {
    const state = new DocJsonState()
      .section('participants', 'Participants')
      .setContract('ownerChannel', { type: 'MyOS/MyOS Timeline Channel' })
      .endSection()
      .section('participants')
      .setContract('adminChannel', { type: 'MyOS/MyOS Timeline Channel' })
      .endSection();

    const section = (state.build().contracts as Record<string, unknown>)
      .participants as {
      relatedContracts: string[];
    };
    expect(section.relatedContracts).toEqual(['ownerChannel', 'adminChannel']);
  });

  it('resumes an existing persisted section contract', () => {
    const state = new DocJsonState({
      contracts: {
        participants: {
          type: 'Conversation/Document Section',
          title: 'Participants',
          relatedContracts: ['ownerChannel'],
        },
        ownerChannel: {
          type: 'MyOS/MyOS Timeline Channel',
        },
      },
    })
      .section('participants')
      .setContract('adminChannel', { type: 'MyOS/MyOS Timeline Channel' })
      .endSection();

    const contracts = state.build().contracts as Record<string, unknown>;
    expect(contracts.participants).toEqual({
      type: 'Conversation/Document Section',
      title: 'Participants',
      relatedContracts: ['ownerChannel', 'adminChannel'],
    });
  });

  it('fails when a section key collides with a non-section contract', () => {
    const state = new DocJsonState({
      contracts: {
        ownerChannel: {
          type: 'Conversation/Timeline Channel',
          timelineId: 'owner-timeline',
        },
      },
    });

    expect(() => state.section('ownerChannel', 'Owner')).toThrow(
      /conflicts with an existing non-section contract/i,
    );
    expect(state.build()).toEqual({
      contracts: {
        ownerChannel: {
          type: 'Conversation/Timeline Channel',
          timelineId: 'owner-timeline',
        },
      },
    });
  });

  it('fails when a contract key collides with the active section key', () => {
    const state = new DocJsonState().section('billing', 'Billing');

    expect(() =>
      state.setContract('billing', {
        type: 'Conversation/Operation',
        channel: 'ownerChannel',
      }),
    ).toThrow(/conflicts with the active section key/i);

    state.endSection();
    expect(state.build()).toEqual({
      contracts: {
        billing: {
          type: 'Conversation/Document Section',
          title: 'Billing',
        },
      },
    });
  });

  it('fails when build is called with unclosed section', () => {
    const state = new DocJsonState().section('open', 'Open');
    expect(() => state.build()).toThrow(/unclosed section/i);
  });

  it('normalizes expressions', () => {
    expect(ensureExpression("document('/counter') + 1")).toBe(
      "${document('/counter') + 1}",
    );
    expect(ensureExpression("${document('/counter') + 1}")).toBe(
      "${document('/counter') + 1}",
    );
  });

  it('does not create an empty contracts root when removing from a document without contracts', () => {
    const state = new DocJsonState()
      .setName('Counter')
      .removeContract('missing');

    expect(state.build()).toEqual({
      name: 'Counter',
    });
  });

  it('removes the contracts root when deleting the last contract', () => {
    const state = new DocJsonState()
      .setName('Counter')
      .setContract('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .removeContract('ownerChannel');

    expect(state.build()).toEqual({
      name: 'Counter',
    });
  });
});
