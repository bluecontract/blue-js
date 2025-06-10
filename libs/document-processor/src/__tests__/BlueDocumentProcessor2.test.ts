import { describe, it, expect, vi } from 'vitest';
import { Blue } from '@blue-labs/language';
import { BlueDocumentProcessor } from '../BlueDocumentProcessor';
import { repository as coreRepository } from '@blue-repository/core-dev';

const timelineEvent = (
  timelineId: string,
  message: unknown = { type: 'Ping' }
) => {
  return {
    type: 'Timeline Entry',
    timeline: { timelineId },
    message,
  };
};

describe('BlueDocumentProcessor', () => {
  const blue = new Blue({
    repositories: [coreRepository],
  });
  const documentProcessor = new BlueDocumentProcessor(blue);
  it('ignores an event that matches no contract (state remains unchanged)', async () => {
    const doc = { foo: 123, contracts: {} };

    const docNode = blue.jsonValueToNode(doc);

    const { state, emitted } = await documentProcessor.processEvents(docNode, [
      { type: 'SomeRandomEvent' },
    ]);

    const jsonState = blue.nodeToJson(state, 'simple') as any;

    expect(jsonState).toMatchInlineSnapshot(`
      {
        "foo": 123,
      }
    `);
    expect(emitted).toHaveLength(0);
  });

  it('accumulates state over multiple events in sequence', async () => {
    const doc = {
      counter: 0,
      contracts: {
        timelineCh: { type: 'Timeline Channel', timelineId: 't1' },
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
                  val: '${document("/counter")+2}',
                },
              ],
            },
          ],
        },
      },
    };

    const docNode = blue.jsonValueToNode(doc);

    let result = await documentProcessor.processEvents(docNode, [
      timelineEvent('t1'),
    ]);
    result = await documentProcessor.processEvents(result.state, [
      timelineEvent('t1'),
    ]);

    const jsonState = blue.nodeToJson(result.state, 'simple') as any;

    expect(jsonState.counter).toBe(4);
  });

  it('correctly orders two Update-Document steps within the same contract', async () => {
    const doc = {
      counter: 0,
      contracts: {
        timelineCh: { type: 'Timeline Channel', timelineId: 'x' },
        wf: {
          type: 'Sequential Workflow',
          channel: 'timelineCh',
          steps: [
            {
              // first sets to 1
              type: 'Update Document',
              changeset: [{ op: 'replace', path: '/counter', val: 1 }],
            },
            {
              // then immediately sets to 2
              type: 'Update Document',
              changeset: [{ op: 'replace', path: '/counter', val: 2 }],
            },
          ],
        },
      },
    };

    const docNode = blue.jsonValueToNode(doc);

    const { state } = await documentProcessor.processEvents(docNode, [
      timelineEvent('x'),
    ]);

    const jsonState = blue.nodeToJson(state, 'simple') as any;

    // final should be 2, not 1
    expect(jsonState.counter).toBe(2);
  });

  it('throws if a patch is invalid (e.g. removing non-existent path)', async () => {
    const originalConsoleError = console.error;
    console.error = vi.fn();

    try {
      const doc = {
        counter: 0,
        contracts: {
          timelineCh: { type: 'Timeline Channel', timelineId: 'e' },
          wf: {
            type: 'Sequential Workflow',
            channel: 'timelineCh',
            steps: [
              {
                type: 'Update Document',
                changeset: [
                  // remove a path that doesn't exist → PatchApplicationError
                  { op: 'replace', path: '/doesNotExist/foo', val: 'bar' },
                ],
              },
            ],
          },
        },
      };

      const docNode = blue.jsonValueToNode(doc);

      await expect(
        documentProcessor.processEvents(docNode, [timelineEvent('e')])
      ).rejects.toThrow();

      // Verify that console.error was called (optional)
      expect(console.error).toHaveBeenCalled();
    } finally {
      console.error = originalConsoleError;
    }
  });

  it('handles multiple embedded documents in parallel', async () => {
    const doc = {
      a: 0,
      b: 10,
      embedded1: {
        val: 5,
        contracts: {
          ch: { type: 'Timeline Channel', timelineId: 'u1' },
          wf: {
            type: 'Sequential Workflow',
            channel: 'ch',
            steps: [
              {
                type: 'Update Document',
                changeset: [{ op: 'replace', path: '/val', val: 6 }],
              },
            ],
          },
        },
      },
      embedded2: {
        val: 20,
        contracts: {
          ch: { type: 'Timeline Channel', timelineId: 'u2' },
          wf: {
            type: 'Sequential Workflow',
            channel: 'ch',
            steps: [
              {
                type: 'Update Document',
                changeset: [{ op: 'replace', path: '/val', val: 21 }],
              },
            ],
          },
        },
      },
      contracts: {
        emb1: { type: 'Process Embedded', paths: ['/embedded1', '/embedded2'] },
        ch1: { type: 'Embedded Node Channel', path: '/embedded1' },
        ch2: { type: 'Embedded Node Channel', path: '/embedded2' },
      },
    };

    const docNode = blue.jsonValueToNode(doc);

    // Ping both timelines; they should both update their own embedded val
    const r1 = await documentProcessor.processEvents(docNode, [
      timelineEvent('u1'),
    ]);

    const r2 = await documentProcessor.processEvents(r1.state, [
      timelineEvent('u2'),
    ]);

    const jsonState = blue.nodeToJson(r2.state, 'simple') as any;

    expect(jsonState.embedded1.val).toBe(6);
    expect(jsonState.embedded2.val).toBe(21);
  });
});
