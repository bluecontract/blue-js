import { createBlue } from '../test-support/blue.js';
import { describe, it, expect } from 'vitest';

import {
  IncrementPropertyContractProcessor,
  NormalizingTestEventChannelProcessor,
  RecencyTestChannelProcessor,
  SetPropertyOnEventContractProcessor,
  TestEventChannelProcessor,
} from './processors/index.js';
import {
  expectOk,
  property,
  propertyOptional,
  buildProcessor,
  numericValue,
} from './test-utils.js';
import type { DocumentProcessor } from '../api/document-processor.js';
import { compositeCheckpointKey } from '../registry/processors/composite-timeline-channel-processor.js';

const blue = createBlue();

async function initialize(processor: DocumentProcessor, yaml: string) {
  const document = blue.yamlToNode(yaml);
  const init = await expectOk(processor.initializeDocument(document));
  return init.document.clone();
}

function eventNode(data: {
  readonly eventId?: string;
  readonly kind?: string;
  readonly value?: number;
}) {
  const node = blue.jsonValueToNode({
    type: { blueId: 'TestEvent' },
    ...(data.eventId ? { eventId: data.eventId } : {}),
    ...(data.kind ? { kind: data.kind } : {}),
    ...(data.value != null ? { value: data.value } : {}),
  });
  if (data.eventId) {
    node.setBlueId(data.eventId);
  }
  return node;
}

describe('ChannelRunnerTest', () => {
  it('skipsDuplicateEventsUsingCheckpoint', async () => {
    const processor = buildProcessor(
      blue,
      new TestEventChannelProcessor(),
      new IncrementPropertyContractProcessor(),
    );

    const yaml = `contracts:
  testChannel:
    type:
      blueId: TestEventChannel
  increment:
    channel: testChannel
    type:
      blueId: IncrementProperty
    propertyKey: /counter
`;
    let current = await initialize(processor, yaml);

    const firstEvent = eventNode({ eventId: 'evt-1', kind: 'original' });
    const afterFirst = await expectOk(
      processor.processDocument(current.clone(), firstEvent),
    );
    current = afterFirst.document.clone();

    const counterNode = property(current, 'counter');
    expect(Number(counterNode.getValue())).toBe(1);
    const checkpoint = property(property(current, 'contracts'), 'checkpoint');
    expect(checkpoint).toBeDefined();

    const duplicateEvent = eventNode({ eventId: 'evt-1', kind: 'original' });
    const afterDuplicate = await expectOk(
      processor.processDocument(current.clone(), duplicateEvent),
    );
    current = afterDuplicate.document.clone();
    expect(Number(property(current, 'counter').getValue())).toBe(1);

    const secondEvent = eventNode({ eventId: 'evt-2', kind: 'original' });
    const afterSecond = await expectOk(
      processor.processDocument(current.clone(), secondEvent),
    );
    current = afterSecond.document.clone();
    expect(Number(property(current, 'counter').getValue())).toBe(2);
  });

  it('skipsDuplicateEventsByEventIdEvenIfPayloadChanges', async () => {
    const processor = buildProcessor(
      blue,
      new TestEventChannelProcessor(),
      new IncrementPropertyContractProcessor(),
    );

    const yaml = `contracts:
  testChannel:
    type:
      blueId: TestEventChannel
  increment:
    channel: testChannel
    type:
      blueId: IncrementProperty
    propertyKey: /counter
`;
    let current = await initialize(processor, yaml);

    const first = eventNode({ eventId: 'evt-1', kind: 'original' });
    current = (
      await expectOk(processor.processDocument(current.clone(), first))
    ).document.clone();

    const sameIdDifferentPayload = eventNode({
      eventId: 'evt-1',
      kind: 'mutated',
    });
    current = (
      await expectOk(
        processor.processDocument(current.clone(), sameIdDifferentPayload),
      )
    ).document.clone();

    current = (
      await expectOk(
        processor.processDocument(current.clone(), sameIdDifferentPayload),
      )
    ).document.clone();

    const newId = eventNode({ eventId: 'evt-2', kind: 'mutated' });
    current = (
      await expectOk(processor.processDocument(current.clone(), newId))
    ).document.clone();

    expect(Number(property(current, 'counter').getValue())).toBe(2);
  });

  it('skipsDuplicateEventsByCanonicalPayloadWhenNoEventIdPresent', async () => {
    const processor = buildProcessor(
      blue,
      new TestEventChannelProcessor(),
      new IncrementPropertyContractProcessor(),
    );

    const yaml = `contracts:
  testChannel:
    type:
      blueId: TestEventChannel
  increment:
    channel: testChannel
    type:
      blueId: IncrementProperty
    propertyKey: /counter
`;
    let current = await initialize(processor, yaml);

    current = (
      await expectOk(
        processor.processDocument(
          current.clone(),
          eventNode({ kind: 'original' }),
        ),
      )
    ).document.clone();

    current = (
      await expectOk(
        processor.processDocument(
          current.clone(),
          eventNode({ kind: 'original' }),
        ),
      )
    ).document.clone();

    current = (
      await expectOk(
        processor.processDocument(
          current.clone(),
          eventNode({ kind: 'other' }),
        ),
      )
    ).document.clone();

    expect(Number(property(current, 'counter').getValue())).toBe(2);
  });

  it('deliversChannelizedEventToHandlersAndPersistsOriginalInCheckpoint', async () => {
    const processor = buildProcessor(
      blue,
      new NormalizingTestEventChannelProcessor(),
      new SetPropertyOnEventContractProcessor(),
    );

    const yaml = `contracts:
  testChannel:
    type:
      blueId: TestEventChannel
  setFlag:
    channel: testChannel
    type:
      blueId: SetPropertyOnEvent
    expectedKind: ${NormalizingTestEventChannelProcessor.NORMALIZED_KIND}
    propertyKey: /flag
    propertyValue: 7
`;

    let current = await initialize(processor, yaml);
    const firstEvent = eventNode({ eventId: 'evt-1', kind: 'original' });
    current = (
      await expectOk(processor.processDocument(current.clone(), firstEvent))
    ).document.clone();

    const originalKind = firstEvent.getProperties()?.kind?.getValue();
    expect(originalKind).toBe('original');

    const flagNode = property(current, 'flag');
    expect(Number(flagNode.getValue())).toBe(7);

    const checkpoint = property(property(current, 'contracts'), 'checkpoint');
    const lastEvents = property(checkpoint, 'lastEvents');
    const storedEvent = propertyOptional(lastEvents, 'testChannel');
    expect(storedEvent).toBeDefined();
    // Channel delivered channelized event to handlers (verified by flag above),
    // but checkpoint should persist the original external event
    expect(storedEvent?.getProperties()?.kind?.getValue()).toBe('original');
  });

  it('delivers composite channel once per matching child and respects recency', async () => {
    const processor = buildProcessor(
      blue,
      new RecencyTestChannelProcessor(),
      new IncrementPropertyContractProcessor(),
    );

    const yaml = `contracts:
  childA:
    type:
      blueId: RecencyTestChannel
    minDelta: 0
  childB:
    type:
      blueId: RecencyTestChannel
    minDelta: 5
  compositeChannel:
    type: Conversation/Composite Timeline Channel
    channels: [childA, childB]
  increment:
    channel: compositeChannel
    type:
      blueId: IncrementProperty
    propertyKey: /counter
`;

    let current = await initialize(processor, yaml);

    current = (
      await expectOk(
        processor.processDocument(current.clone(), eventNode({ value: 5 })),
      )
    ).document.clone();
    expect(Number(property(current, 'counter').getValue())).toBe(2);

    current = (
      await expectOk(
        processor.processDocument(current.clone(), eventNode({ value: 8 })),
      )
    ).document.clone();
    expect(Number(property(current, 'counter').getValue())).toBe(3);

    console.log(blue.nodeToYaml(current));

    const checkpoint = property(property(current, 'contracts'), 'checkpoint');
    const lastEvents = property(checkpoint, 'lastEvents');
    const storedA = property(
      lastEvents,
      compositeCheckpointKey('compositeChannel', 'childA'),
    );
    const storedB = property(
      lastEvents,
      compositeCheckpointKey('compositeChannel', 'childB'),
    );
    const storedAValueNode = storedA.getProperties()?.value ?? storedA;
    const storedBValueNode = storedB.getProperties()?.value ?? storedB;
    expect(numericValue(storedAValueNode)).toBe(8);
    expect(numericValue(storedBValueNode)).toBe(5);
  });
});
