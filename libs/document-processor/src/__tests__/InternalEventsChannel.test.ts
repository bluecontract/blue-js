import { describe, it, expect } from 'vitest';
import { Blue } from '@blue-labs/language';
import { BlueDocumentProcessor } from '../BlueDocumentProcessor';
import { repository as coreRepository } from '@blue-repository/core-dev';
import { prepareToProcess } from '../testUtils';

describe('Internal Events Channel — channel-less Sequential Workflow', () => {
  const blue = new Blue({ repositories: [coreRepository] });
  const documentProcessor = new BlueDocumentProcessor(blue);

  it('runs a Sequential Workflow only when an internal event is received', async () => {
    const doc = {
      markers: {
        explicit: false,
        implicit: false,
      },
      contracts: {
        lifecycle: {
          type: 'Lifecycle Event Channel',
          event: { type: 'Document Processing Initiated' },
        },

        internalEvents: {
          type: 'Internal Events Channel',
        },

        swWithLifecycleChannel: {
          type: 'Sequential Workflow',
          channel: 'lifecycle',
          steps: [
            {
              name: 'MarkExplicit',
              type: 'Update Document',
              changeset: [{ op: 'add', path: '/markers/explicit', val: true }],
            },
          ],
        },
        swNoInternalEventsChannel: {
          type: 'Sequential Workflow',
          channel: 'internalEvents',
          event: { type: 'Document Processing Initiated' },
          steps: [
            {
              name: 'MarkImplicit',
              type: 'Update Document',
              changeset: [{ op: 'add', path: '/markers/implicit', val: true }],
            },
          ],
        },
        // Channel-less workflow without event — must not run
        swNoChannelNoEvent: {
          type: 'Sequential Workflow',
          steps: [
            {
              name: 'ShouldNotRun',
              type: 'Update Document',
              changeset: [{ op: 'add', path: '/shouldNotRun', val: true }],
            },
          ],
        },
      },
    } as const;

    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    const json = blue.nodeToJson(initializedState, 'simple') as any;
    expect(json.markers?.explicit).toBe(true);
    expect(json.markers?.implicit).toBe(true);
    expect(json.shouldNotRun).toBeUndefined();
  });

  it('workflow can react to internal Document Update events via the Internal Events Channel', async () => {
    const doc = {
      contracts: {
        lifecycle: {
          type: 'Lifecycle Event Channel',
          event: { type: 'Document Processing Initiated' },
        },

        internalEvents: {
          type: 'Internal Events Channel',
        },
        // Producer workflow: on init, update a field (emits internal Document Update event)
        producer: {
          type: 'Sequential Workflow',
          channel: 'lifecycle',
          steps: [
            {
              name: 'UpdateFlag',
              type: 'Update Document',
              changeset: [{ op: 'add', path: '/flag', val: true }],
            },
          ],
        },
        // Consumer workflow reacts to Document Update, then updates the document again
        // which would create a loop through Internal Events Channel. We now expect a loop error.
        consumer: {
          type: 'Sequential Workflow',
          channel: 'internalEvents',
          event: { type: 'Document Update' },
          steps: [
            {
              name: 'MarkConsumed',
              type: 'Update Document',
              changeset: [{ op: 'add', path: '/consumed', val: true }],
            },
          ],
        },
      },
    } as const;

    await expect(
      prepareToProcess(doc, {
        blue,
        documentProcessor,
      })
    ).rejects.toThrow(/Loop detected/);
  });

  it('detects ping-pong loops between root and embedded workflows via Internal Events Channel', async () => {
    const doc = {
      // No Process Embedded here, so root can see internal events; add one if you want routing into embedded
      contracts: {
        lifecycle: {
          type: 'Lifecycle Event Channel',
          event: { type: 'Document Processing Initiated' },
        },
        internalEvents: {
          type: 'Internal Events Channel',
        },
        // Root producer kicks things off
        producer: {
          type: 'Sequential Workflow',
          channel: 'lifecycle',
          steps: [
            {
              name: 'Kick',
              type: 'Update Document',
              changeset: [{ op: 'add', path: '/start', val: true }],
            },
          ],
        },
        // Root consumer reacts to any internal doc update and updates a root field
        rootConsumer: {
          type: 'Sequential Workflow',
          channel: 'internalEvents',
          event: { type: 'Document Update' },
          steps: [
            {
              name: 'RootTouch',
              type: 'Update Document',
              changeset: [{ op: 'add', path: '/rootTouch', val: true }],
            },
          ],
        },
      },
      // Embedded document with its own internal events channel + consumer
      embedded: {
        contracts: {
          internalEvents: { type: 'Internal Events Channel' },
          embeddedConsumer: {
            type: 'Sequential Workflow',
            channel: 'internalEvents',
            event: { type: 'Document Update' },
            steps: [
              {
                name: 'EmbeddedTouch',
                type: 'Update Document',
                changeset: [{ op: 'add', path: '/embeddedTouch', val: true }],
              },
            ],
          },
        },
      },
    } as const;

    await expect(
      prepareToProcess(doc, {
        blue,
        documentProcessor,
      })
    ).rejects.toThrow(/Loop detected/);
  });

  it('lifecycle producer emits custom event handled by internal-events consumer', async () => {
    const doc = {
      contracts: {
        lifecycle: {
          type: 'Lifecycle Event Channel',
          event: { type: 'Document Processing Initiated' },
        },
        internalEvents: {
          type: 'Internal Events Channel',
        },
        // Producer: on lifecycle, emit custom event
        producer: {
          type: 'Sequential Workflow',
          channel: 'lifecycle',
          steps: [
            {
              name: 'EmitCompleted',
              type: 'Trigger Event',
              event: { type: 'Status Completed' },
            },
          ],
        },
        // Consumer: on internal events, react to that custom event and update document
        consumer: {
          type: 'Sequential Workflow',
          channel: 'internalEvents',
          event: { type: 'Status Completed' },
          steps: [
            {
              name: 'Acknowledge',
              type: 'Update Document',
              changeset: [
                { op: 'add', path: '/statusAcknowledged', val: true },
              ],
            },
          ],
        },
      },
    } as const;

    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    const json = blue.nodeToJson(initializedState, 'simple') as any;
    expect(json.statusAcknowledged).toBe(true);
  });
});
