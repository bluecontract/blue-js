import { describe, it, expect } from 'vitest';
import { Blue } from '@blue-labs/language';
import { BlueDocumentProcessor } from '../../BlueDocumentProcessor';
import { repository as coreRepository } from '@blue-repository/core-dev';
import { prepareToProcess } from '../../testUtils';

describe('Triggered Event Channel — step-triggered Sequential Workflow', () => {
  const blue = new Blue({ repositories: [coreRepository] });
  const documentProcessor = new BlueDocumentProcessor(blue);

  it('runs a Sequential Workflow only when a triggered event is received', async () => {
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

        triggeredEventsChannel: {
          type: 'Triggered Event Channel',
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
        // Consumer reacts only to a triggered event
        triggeredConsumer: {
          type: 'Sequential Workflow',
          channel: 'triggeredEventsChannel',
          event: { type: 'Status Completed' },
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
        // Producer emits a custom event via Trigger step
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

  it('works with embedded documents via Process Embedded (triggered event routed to embedded)', async () => {
    const doc = {
      contracts: {
        processEmbedded: { type: 'Process Embedded', paths: ['/embedded'] },
        lifecycle: {
          type: 'Lifecycle Event Channel',
          event: { type: 'Document Processing Initiated' },
        },
        triggeredEventsChannel: { type: 'Triggered Event Channel' },
        // Root emits a triggered event
        producer: {
          type: 'Sequential Workflow',
          channel: 'lifecycle',
          steps: [
            { name: 'Emit', type: 'Trigger Event', event: { name: 'Ping' } },
          ],
        },
      },
      embedded: {
        contracts: {
          triggeredEventsChannel: { type: 'Triggered Event Channel' },
          consumer: {
            type: 'Sequential Workflow',
            channel: 'triggeredEventsChannel',
            event: { name: 'Ping' },
            steps: [
              {
                name: 'Ack',
                type: 'Update Document',
                changeset: [{ op: 'add', path: '/embeddedAck', val: true }],
              },
            ],
          },
        },
      },
    } as const;

    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    const json = blue.nodeToJson(initializedState, 'simple') as any;
    expect(json.embedded?.embeddedAck).toBe(true);
  });

  it('lifecycle producer emits custom event handled by triggered-events consumer', async () => {
    const doc = {
      contracts: {
        lifecycle: {
          type: 'Lifecycle Event Channel',
          event: { type: 'Document Processing Initiated' },
        },
        triggeredEventsChannel: {
          type: 'Triggered Event Channel',
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
        // Consumer: on triggered events, react to that custom event and update document
        consumer: {
          type: 'Sequential Workflow',
          channel: 'triggeredEventsChannel',
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
