import { describe, it, expect } from 'vitest';
import { Blue } from '@blue-labs/language';
import { BlueDocumentProcessor } from '../../BlueDocumentProcessor';
import { repository as coreRepository } from '@blue-repository/core-dev';
import { prepareToProcess } from '../../testUtils';

describe('Document Update Channel — loop detection', () => {
  const blue = new Blue({ repositories: [coreRepository] });
  const documentProcessor = new BlueDocumentProcessor(blue);

  it('detects loop when consumer writes to the same path listened by the channel', async () => {
    const doc = {
      contracts: {
        lifecycle: {
          type: 'Lifecycle Event Channel',
          event: { type: 'Document Processing Initiated' },
        },
        documentUpdate: { type: 'Document Update Channel', path: '/flag' },
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
        consumer: {
          type: 'Sequential Workflow',
          channel: 'documentUpdate',
          event: { type: 'Document Update' },
          steps: [
            {
              name: 'Loop',
              type: 'Update Document',
              changeset: [{ op: 'add', path: '/flag', val: true }],
            },
          ],
        },
      },
    } as const;

    await expect(
      prepareToProcess(doc, { blue, documentProcessor })
    ).rejects.toThrow(/Loop detected/);
  });

  it('detects loop within embedded when embedded is processed', async () => {
    const doc = {
      contracts: {
        processEmbedded: { type: 'Process Embedded', paths: ['/embedded'] },
        lifecycle: {
          type: 'Lifecycle Event Channel',
          event: { type: 'Document Processing Initiated' },
        },
        documentUpdate: { type: 'Document Update Channel', path: '/start' },
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
        rootConsumer: {
          type: 'Sequential Workflow',
          channel: 'documentUpdate',
          event: { type: 'Document Update' },
          steps: [
            {
              name: 'RootTouch',
              type: 'Update Document',
              changeset: [{ op: 'add', path: '/start', val: true }],
            },
          ],
        },
      },
      embedded: {
        contracts: {
          lifecycle: {
            type: 'Lifecycle Event Channel',
            event: { type: 'Document Processing Initiated' },
          },
          documentUpdate: {
            type: 'Document Update Channel',
            path: '/embeddedTouch',
          },
          producer: {
            type: 'Sequential Workflow',
            channel: 'lifecycle',
            steps: [
              {
                name: 'StartEmbedded',
                type: 'Update Document',
                changeset: [{ op: 'add', path: '/embeddedTouch', val: true }],
              },
            ],
          },
          embeddedConsumer: {
            type: 'Sequential Workflow',
            channel: 'documentUpdate',
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
      prepareToProcess(doc, { blue, documentProcessor })
    ).rejects.toThrow(/Loop detected/);
  });
});
