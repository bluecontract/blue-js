import { describe, it, expect } from 'vitest';
import { Blue } from '@blue-labs/language';
import { BlueDocumentProcessor } from '../BlueDocumentProcessor';
import {
  repository as coreRepository,
  DocumentUpdateSchema,
} from '@blue-repository/core-dev';
import { prepareToProcess } from '../testUtils';
import { createTimelineEntryEvent } from '../utils/eventFactories';

describe('BlueDocumentProcessor', () => {
  const blue = new Blue({
    repositories: [coreRepository],
  });
  const documentProcessor = new BlueDocumentProcessor(blue);

  const timelineEvent = (
    timelineId: string,
    message: unknown = { name: 'Ping' },
  ) => {
    return createTimelineEntryEvent(timelineId, message, blue);
  };

  it('processes embedded documents before parent init contracts', async () => {
    const doc = {
      counter: 0,
      embedded: {
        counter: 0,
        contracts: {
          timelineCh: {
            type: 'Timeline Channel',
            timelineId: 'user-123',
          },
          childWf: {
            type: 'Sequential Workflow',
            channel: 'timelineCh',
            steps: [
              {
                type: 'Update Document',
                changeset: [{ op: 'replace', path: '/counter', val: 1 }],
              },
            ],
          },
        },
      },
      contracts: {
        emb: { type: 'Process Embedded', paths: ['/embedded'] },
        localCh: { type: 'Embedded Node Channel', path: '/embedded' },
        parentWf: {
          type: 'Sequential Workflow',
          channel: 'localCh',
          steps: [
            {
              type: 'Update Document',
              changeset: [{ op: 'replace', path: '/counter', val: 2 }],
            },
          ],
        },
      },
    };

    const timelineEntry = timelineEvent('user-123');
    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });
    const { state, emitted } = await documentProcessor.processEvents(
      initializedState,
      [timelineEntry],
    );
    const stateMap = blue.nodeToJson(state, 'simple') as any;
    expect(stateMap?.counter).toBe(2);
    expect(emitted.some((e) => blue.isTypeOf(e, DocumentUpdateSchema))).toBe(
      true,
    );
  });

  it('processes Sequential Workflow contracts in alphabetical name order and evaluates expressions correctly', async () => {
    const doc = {
      counter: 0,
      contracts: {
        timelineCh: {
          type: 'Timeline Channel',
          timelineId: 'timeline-1',
        },
        contract2: {
          type: 'Sequential Workflow',
          channel: 'timelineCh',
          steps: [
            {
              name: 'Increment Counter',
              type: 'Update Document',
              changeset: [
                {
                  op: 'replace',
                  path: '/counter',
                  val: '${document("/counter") * 3}',
                },
              ],
            },
          ],
        },
        contract1: {
          type: 'Sequential Workflow',
          channel: 'timelineCh',
          steps: [
            {
              name: 'Increment Counter',
              type: 'Update Document',
              changeset: [
                {
                  op: 'replace',
                  path: '/counter',
                  val: '${document("/counter") + 1}',
                },
              ],
            },
          ],
        },
      },
    };

    const timelineEntry = timelineEvent('timeline-1');

    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    const { state } = await documentProcessor.processEvents(initializedState, [
      timelineEntry,
    ]);
    const stateMap = blue.nodeToJson(state, 'simple') as any;
    expect(stateMap?.counter).toBe(3);
  });

  it('processes Sequential Workflow contracts in explicit order with correct expression evaluation', async () => {
    const doc = {
      counter: 0,
      contracts: {
        timelineCh: {
          type: 'Timeline Channel',
          timelineId: 'timeline-1',
        },
        contract2: {
          type: 'Sequential Workflow',
          channel: 'timelineCh',
          order: 1,
          steps: [
            {
              name: 'Increment Counter',
              type: 'Update Document',
              changeset: [
                {
                  op: 'replace',
                  path: '/counter',
                  val: '${document("/counter") * 3}',
                },
              ],
            },
          ],
        },
        contract1: {
          type: 'Sequential Workflow',
          channel: 'timelineCh',
          order: 2,
          steps: [
            {
              name: 'Increment Counter',
              type: 'Update Document',
              changeset: [
                {
                  op: 'replace',
                  path: '/counter',
                  val: '${document("/counter") + 1}',
                },
              ],
            },
          ],
        },
      },
    };

    const timelineEntry = timelineEvent('timeline-1');

    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    const { state } = await documentProcessor.processEvents(initializedState, [
      timelineEntry,
    ]);

    const stateMap = blue.nodeToJson(state, 'simple') as any;
    expect(stateMap?.counter).toBe(1);
  });

  it('allows workflows to modify document structure by removing other contracts', async () => {
    const doc = {
      counter: 0,
      contracts: {
        timelineCh: {
          type: 'Timeline Channel',
          timelineId: 'timeline-1',
        },
        contract2: {
          type: 'Sequential Workflow',
          channel: 'timelineCh',
          steps: [
            {
              name: 'Multiply Counter',
              type: 'Update Document',
              changeset: [
                {
                  op: 'replace',
                  path: '/counter',
                  val: '${document("/counter") + 5}',
                },
              ],
            },
          ],
        },
        contract1: {
          type: 'Sequential Workflow',
          channel: 'timelineCh',
          steps: [
            {
              name: 'Increment Counter',
              type: 'Update Document',
              changeset: [
                {
                  op: 'replace',
                  path: '/counter',
                  val: '${document("/counter") + 10}',
                },
              ],
            },
            {
              name: 'Remove Contract 2',
              type: 'Update Document',
              changeset: [
                {
                  op: 'remove',
                  path: '/contracts/contract2',
                },
              ],
            },
          ],
        },
      },
    };

    const timelineEntry = timelineEvent('timeline-1');

    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    const { state } = await documentProcessor.processEvents(initializedState, [
      timelineEntry,
    ]);

    const stateMap = blue.nodeToJson(state, 'simple') as any;
    expect(stateMap?.counter).toBe(10);
    expect(stateMap?.contracts?.contract2).toBeUndefined();
  });

  it('processes deeply nested embedded documents with multiple channels', async () => {
    const doc = {
      counter: 0,
      level1: {
        counter: 0,
        level2: {
          counter: 0,
          level3: {
            counter: 0,
            contracts: {
              timelineCh: {
                type: 'Timeline Channel',
                timelineId: 'level3-timeline',
              },
              level3Wf: {
                type: 'Sequential Workflow',
                channel: 'timelineCh',
                steps: [
                  {
                    type: 'Update Document',
                    changeset: [{ op: 'replace', path: '/counter', val: 3 }],
                  },
                ],
              },
            },
          },
          contracts: {
            embLevel3: { type: 'Process Embedded', paths: ['/level3'] },
            nodeChLevel3: { type: 'Embedded Node Channel', path: '/level3' },
            level2Wf: {
              type: 'Sequential Workflow',
              channel: 'nodeChLevel3',
              steps: [
                {
                  type: 'Update Document',
                  changeset: [{ op: 'replace', path: '/counter', val: 2 }],
                },
              ],
            },
          },
        },
        contracts: {
          embLevel2: { type: 'Process Embedded', paths: ['/level2'] },
          nodeChLevel2: { type: 'Embedded Node Channel', path: '/level2' },
          level1Wf: {
            type: 'Sequential Workflow',
            channel: 'nodeChLevel2',
            steps: [
              {
                type: 'Update Document',
                changeset: [{ op: 'replace', path: '/counter', val: 1 }],
              },
            ],
          },
        },
      },
      contracts: {
        embLevel1: { type: 'Process Embedded', paths: ['/level1'] },
        nodeChLevel1: { type: 'Embedded Node Channel', path: '/level1' },
        rootWf: {
          type: 'Sequential Workflow',
          channel: 'nodeChLevel1',
          steps: [
            {
              type: 'Update Document',
              changeset: [{ op: 'replace', path: '/counter', val: 10 }],
            },
          ],
        },
      },
    };

    // Create timeline entry for deepest level
    const timelineEntry = timelineEvent('level3-timeline');

    // Process the event - should bubble up through all levels
    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    const result = await documentProcessor.processEvents(initializedState, [
      timelineEntry,
    ]);

    const state = blue.nodeToJson(result.state, 'simple') as any;
    const emitted = result.emitted;

    // Verify each level's counter was updated
    expect(state.counter).toBe(10);
    expect(state.level1.counter).toBe(1);
    expect(state.level1.level2.counter).toBe(2);
    expect(state.level1.level2.level3.counter).toBe(3);

    // Verify event propagation path
    const documentUpdates = emitted.filter((e) =>
      blue.isTypeOf(e, DocumentUpdateSchema),
    );

    expect(documentUpdates.length).toBe(4); // One update per level
  });

  it('processes workflows using the timeline channel from simple.yaml', async () => {
    const doc = {
      name: 'root',
      a: 123,
      x: 0,
      sub1: {
        x: 1,
        contracts: {
          alice: {
            type: 'Timeline Channel',
            timelineId: 'Alice',
          },
          workflow: {
            type: 'Sequential Workflow',
            channel: 'alice',
            steps: [
              {
                type: 'Update Document',
                changeset: [{ op: 'replace', path: '/x', val: 2 }],
              },
              {
                type: 'Trigger Event',
                event: {
                  type: {
                    name: 'Payment Succeeded',
                    amountUsd: {
                      type: 'Integer',
                    },
                  },
                  amountUsd: 120,
                },
              },
            ],
          },
        },
      },
      sub2: {
        y: 1,
      },
      contracts: {
        embSub1: { type: 'Process Embedded', paths: ['/sub1'] },
        alice: {
          type: 'Timeline Channel',
          timelineId: 'Alice',
        },
        bob: {
          type: 'Timeline Channel',
          timelineId: 'Bob',
        },
        sub1Channel: {
          type: 'Embedded Node Channel',
          path: '/sub1',
        },
        workflow1: {
          type: 'Sequential Workflow',
          channel: 'alice',
          steps: [
            {
              type: 'Update Document',
              changeset: [{ op: 'replace', path: '/x', val: 1 }],
            },
          ],
        },
        workflow2: {
          type: 'Sequential Workflow',
          channel: 'alice',
          steps: [
            {
              type: 'Update Document',
              changeset: [{ op: 'replace', path: '/x', val: 5 }],
            },
          ],
        },
        workflow3: {
          type: 'Sequential Workflow',
          channel: 'sub1Channel',
          steps: [
            {
              type: 'Update Document',
              changeset: [{ op: 'replace', path: '/x', val: 10 }],
            },
          ],
        },
      },
    };

    // Create a timeline entry for Alice
    const timelineEntry = timelineEvent('Alice');

    // Process the event
    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    const result = await documentProcessor.processEvents(initializedState, [
      timelineEntry,
    ]);

    const state = blue.nodeToJson(result.state, 'simple') as any;

    // Check that all workflows connected to alice's channel were executed
    expect(state.sub2.y).toBe(1);
    expect(state.sub1.x).toBe(2); // The embedded workflow should have run
    expect(state.x).toBe(10);

    // Check for emitted events
    const paymentSucceededEvent = result.emitted
      .map((e) => blue.nodeToJson(e, 'simple') as any)
      .find((e) => e.type.name === 'Payment Succeeded' && e.amountUsd === 120);

    expect(paymentSucceededEvent).toBeDefined();
  });

  it('dynamically adds contracts that respond to document updates in the same processing cycle', async () => {
    const doc = {
      name: 'root',
      counter: 0,
      secondCounter: 0,
      contracts: {
        timelineCh: { type: 'Timeline Channel', timelineId: 't' },
        counterUpdateChannel: {
          type: 'Document Update Channel',
          path: '/counter',
        },
        wf: {
          type: 'Sequential Workflow',
          channel: 'timelineCh',
          steps: [
            {
              type: 'Update Document',
              changeset: [
                {
                  op: 'replace',
                  path: '/counter',
                  val: '${document("/counter") + 1}',
                },
              ],
            },
            {
              type: 'Update Document',
              changeset: [
                {
                  op: 'replace',
                  path: '/contracts/wf2',
                  val: {
                    type: 'Sequential Workflow',
                    channel: 'counterUpdateChannel',
                    steps: [
                      {
                        type: 'Update Document',
                        changeset: [
                          {
                            op: 'replace',
                            path: '/secondCounter',
                            val: '${document("/secondCounter") + 1}',
                          },
                        ],
                      },
                    ],
                  },
                },
              ],
            },
            {
              type: 'Update Document',
              changeset: [
                {
                  op: 'replace',
                  path: '/counter',
                  val: '${document("/counter") + 1}',
                },
              ],
            },
          ],
        },
      },
    };

    const timelineEntry = timelineEvent('t');

    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    const result = await documentProcessor.processEvents(initializedState, [
      timelineEntry,
    ]);

    const state = blue.nodeToJson(result.state, 'simple') as any;

    expect(state.counter).toBe(2);
    expect(state.secondCounter).toBe(1);
  });
});
