import { describe, it, expect } from 'vitest';
import { Blue } from '@blue-labs/language';

import {
  IncrementPropertyContractProcessor,
  NormalizingTestEventChannelProcessor,
  SetPropertyOnEventContractProcessor,
  TestEventChannelProcessor,
} from './processors/index.js';
import { expectOk, property, propertyOptional, buildProcessor } from './test-utils.js';
import type { DocumentProcessor } from '../api/document-processor.js';

const blue = new Blue();

function initialize(processor: DocumentProcessor, yaml: string) {
  const document = blue.yamlToNode(yaml);
  const init = expectOk(processor.initializeDocument(document));
  return init.document.clone();
}

function eventNode(data: {
  readonly eventId?: string;
  readonly kind?: string;
  readonly value?: number;
}) {
  return blue.jsonValueToNode({
    type: { blueId: 'TestEvent' },
    ...(data.eventId ? { eventId: data.eventId } : {}),
    ...(data.kind ? { kind: data.kind } : {}),
    ...(data.value != null ? { value: data.value } : {}),
  });
}

describe('ChannelRunnerTest', () => {
  it('skipsDuplicateEventsUsingCheckpoint', () => {
    const processor = buildProcessor(
      blue,
      new TestEventChannelProcessor(),
      new IncrementPropertyContractProcessor()
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
    let current = initialize(processor, yaml);

    const firstEvent = eventNode({ eventId: 'evt-1', kind: 'original' });
    const afterFirst = expectOk(
      processor.processDocument(current.clone(), firstEvent)
    );
    current = afterFirst.document.clone();

    const counterNode = property(current, 'counter');
    expect(Number(counterNode.getValue())).toBe(1);
    const checkpoint = property(property(current, 'contracts'), 'checkpoint');
    expect(checkpoint).toBeDefined();

    const duplicateEvent = eventNode({ eventId: 'evt-1', kind: 'original' });
    const afterDuplicate = expectOk(
      processor.processDocument(current.clone(), duplicateEvent)
    );
    current = afterDuplicate.document.clone();
    expect(Number(property(current, 'counter').getValue())).toBe(1);

    const secondEvent = eventNode({ eventId: 'evt-2', kind: 'original' });
    const afterSecond = expectOk(
      processor.processDocument(current.clone(), secondEvent)
    );
    current = afterSecond.document.clone();
    expect(Number(property(current, 'counter').getValue())).toBe(2);
  });

  it('skipsDuplicateEventsByEventIdEvenIfPayloadChanges', () => {
    const processor = buildProcessor(
      blue,
      new TestEventChannelProcessor(),
      new IncrementPropertyContractProcessor()
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
    let current = initialize(processor, yaml);

    const first = eventNode({ eventId: 'evt-1', kind: 'original' });
    current = expectOk(
      processor.processDocument(current.clone(), first)
    ).document.clone();

    const sameIdDifferentPayload = eventNode({
      eventId: 'evt-1',
      kind: 'mutated',
    });
    current = expectOk(
      processor.processDocument(current.clone(), sameIdDifferentPayload)
    ).document.clone();

    current = expectOk(
      processor.processDocument(current.clone(), sameIdDifferentPayload)
    ).document.clone();

    const newId = eventNode({ eventId: 'evt-2', kind: 'mutated' });
    current = expectOk(
      processor.processDocument(current.clone(), newId)
    ).document.clone();

    expect(Number(property(current, 'counter').getValue())).toBe(2);
  });

  it('skipsDuplicateEventsByCanonicalPayloadWhenNoEventIdPresent', () => {
    const processor = buildProcessor(
      blue,
      new TestEventChannelProcessor(),
      new IncrementPropertyContractProcessor()
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
    let current = initialize(processor, yaml);

    current = expectOk(
      processor.processDocument(
        current.clone(),
        eventNode({ kind: 'original' })
      )
    ).document.clone();

    current = expectOk(
      processor.processDocument(
        current.clone(),
        eventNode({ kind: 'original' })
      )
    ).document.clone();

    current = expectOk(
      processor.processDocument(
        current.clone(),
        eventNode({ kind: 'other' })
      )
    ).document.clone();

    expect(Number(property(current, 'counter').getValue())).toBe(2);
  });

  it('deliversChannelizedEventToHandlersAndCheckpoint', () => {
    const processor = buildProcessor(
      blue,
      new NormalizingTestEventChannelProcessor(),
      new SetPropertyOnEventContractProcessor()
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

    let current = initialize(processor, yaml);
    const firstEvent = eventNode({ eventId: 'evt-1', kind: 'original' });
    current = expectOk(
      processor.processDocument(current.clone(), firstEvent)
    ).document.clone();

    const originalKind = firstEvent.getProperties()?.kind?.getValue();
    expect(originalKind).toBe('original');

    const flagNode = property(current, 'flag');
    expect(Number(flagNode.getValue())).toBe(7);

    const checkpoint = property(property(current, 'contracts'), 'checkpoint');
    const lastEvents = property(checkpoint, 'lastEvents');
    const storedEvent = propertyOptional(lastEvents, 'testChannel');
    expect(storedEvent).toBeDefined();
    expect(
      storedEvent?.getProperties()?.kind?.getValue()
    ).toBe(NormalizingTestEventChannelProcessor.NORMALIZED_KIND);
  });
});
