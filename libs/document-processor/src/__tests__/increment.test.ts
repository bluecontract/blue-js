import { describe, it } from 'vitest';
import { Blue } from '@blue-labs/language';
import { repository as coreRepository } from '@blue-repository/core-dev';
import { repository as myosRepository } from '@blue-repository/myos-dev';
import { BlueDocumentProcessor } from '../BlueDocumentProcessor';
import { prepareToProcess } from '../testUtils';
import { createMyOSTimelineEntryEvent } from '../utils/eventFactories';

describe('increment', () => {
  const blue = new Blue({
    repositories: [coreRepository, myosRepository],
  });
  const documentProcessor = new BlueDocumentProcessor(blue);
  const doc = {
    name: 'Simple Counter',
    counter: 0,
    contracts: {
      ignoreChannel: {
        type: 'MyOS Timeline Channel',
        timelineId: 'ignore-timeline',
      },
      incrementChannel: {
        type: 'MyOS Timeline Channel',
        timelineId: 'timeline-1',
      },
      counterWorkflow: {
        type: 'Sequential Workflow',
        channel: 'incrementChannel',
        steps: [
          {
            name: 'Increment Counter',
            type: 'Update Document',
            changeset: [
              {
                op: 'replace',
                path: '/counter',
                val: "${document('/counter') + 1}",
              },
            ],
          },
        ],
      },
    },
  };

  it('should increment the number', async () => {
    const { initializedState } = await prepareToProcess(doc, {
      documentProcessor,
      blue,
    });

    const eventToIgnore = createMyOSTimelineEntryEvent(
      'ignore-timeline',
      'foo',
      blue
    );

    const { state: state1, emitted: emitted1 } =
      await documentProcessor.processEvents(initializedState, [
        blue.resolve(eventToIgnore),
      ]);

    expect(emitted1.length).toEqual(0);
    const jsonState1 = blue.nodeToJson(state1, 'simple') as any;
    expect(jsonState1.counter).toBe(0);

    const { state: state2, emitted: emitted2 } =
      await documentProcessor.processEvents(state1, [
        blue.resolve(eventToIgnore),
      ]);
    expect(emitted2.length).toEqual(0);

    const jsonState2 = blue.nodeToJson(state2, 'simple') as any;
    expect(jsonState2.counter).toBe(0);

    const eventTimeline = createMyOSTimelineEntryEvent(
      'timeline-1',
      'bar',
      blue
    );

    const { state: state3, emitted: emitted3 } =
      await documentProcessor.processEvents(state2, [
        blue.resolve(eventTimeline),
      ]);
    expect(emitted3.length).toEqual(1);

    const jsonState3 = blue.nodeToJson(state3, 'simple') as any;
    expect(jsonState3.counter).toBe(1);
  });
});
