import { describe, test, expect } from 'vitest';
import { Blue } from '@blue-labs/language';
import { BlueDocumentProcessor } from '../../BlueDocumentProcessor';
import { JsonObject } from '@blue-labs/shared-utils';
import { repository as coreRepository } from '@blue-repository/core-dev';
import { repository as myosRepository } from '@blue-repository/myos-dev';

describe('MyOS Timeline Channel + JavaScript Code step — merger resolve and expression evaluation"', () => {
  const blue = new Blue({ repositories: [coreRepository, myosRepository] });
  const documentProcessor = new BlueDocumentProcessor(blue);

  test("executes when message is an object and event.message.name === 'Start' (after merger resolve)", async () => {
    const doc: JsonObject = {
      contracts: {
        channelName: {
          type: 'MyOS Timeline Channel',
          timelineId: 'timeline-1',
        },
        counterWorkflow: {
          type: 'Sequential Workflow',
          channel: 'channelName',
          steps: [
            {
              name: 'EmitEvent',
              type: 'JavaScript Code',
              code: `return { events: event.message && event.message.name === 'Start' ? [{ name: 'X' }] : [] };`,
            },
          ],
        },
      },
    };

    const initial = await documentProcessor.initialize(
      blue.jsonValueToNode(doc)
    );

    const event = blue.resolve(
      blue.jsonValueToNode({
        type: 'MyOS Timeline Entry',
        timeline: {
          timelineId: 'timeline-1',
        },
        message: { name: 'Start' },
        timestamp: 1749540750150,
      })
    );

    const { emitted } = await documentProcessor.processEvents(initial.state, [
      event,
    ]);
    expect(emitted.length).toEqual(1);
  });

  test("executes when message is a string and event.message === 'Start'", async () => {
    const doc: JsonObject = {
      contracts: {
        channelName: {
          type: 'MyOS Timeline Channel',
          timelineId: 'timeline-1',
        },
        counterWorkflow: {
          type: 'Sequential Workflow',
          channel: 'channelName',
          steps: [
            {
              name: 'EmitEvent',
              type: 'JavaScript Code',
              code: `return { events: event.message === 'Start' ? [{ name: 'X' }] : [] };`,
            },
          ],
        },
      },
    };

    const initial = await documentProcessor.initialize(
      blue.jsonValueToNode(doc)
    );

    const event = blue.jsonValueToNode({
      type: 'MyOS Timeline Entry',
      timeline: {
        timelineId: 'timeline-1',
      },
      message: 'Start',
      timestamp: 1749540750150,
    });

    const { emitted } = await documentProcessor.processEvents(initial.state, [
      event,
    ]);
    expect(emitted.length).toEqual(1);
  });
});
