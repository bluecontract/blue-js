import { createBlue } from '../test-support/blue.js';
import { describe, it, expect } from 'vitest';

import {
  EmitEventsContractProcessor,
  IncrementPropertyContractProcessor,
  SetPropertyContractProcessor,
  SetPropertyOnEventContractProcessor,
  TestEventChannelProcessor,
} from './processors/index.js';
import {
  buildProcessor,
  expectOk,
  property,
  propertyOptional,
} from './test-utils.js';

const blue = createBlue();

function checkpointValue(document: ReturnType<typeof blue.yamlToNode>): string | null {
  const contracts = property(document, 'contracts');
  const checkpoint = propertyOptional(contracts, 'checkpoint');
  if (!checkpoint) return null;
  const signatures = checkpoint.getProperties()?.lastSignatures;
  if (signatures) {
    const entry = signatures.getProperties()?.testEventsChannel;
    const value = entry?.getValue();
    return value != null ? String(value) : null;
  }
  const lastEvents = checkpoint.getProperties()?.lastEvents;
  const eventNode = lastEvents?.getProperties()?.testEventsChannel ?? null;
  const eventIdNode = eventNode?.getProperties()?.eventId ?? null;
  const value = eventIdNode?.getValue();
  return value != null ? String(value) : null;
}

function checkpointStoredEvent(document: ReturnType<typeof blue.yamlToNode>) {
  const contracts = property(document, 'contracts');
  const checkpoint = propertyOptional(contracts, 'checkpoint');
  const lastEvents = checkpoint?.getProperties()?.lastEvents;
  return lastEvents?.getProperties()?.testEventsChannel ?? null;
}

describe('TestEventChannelTest', () => {
  it('testEventChannelMatchesOnlyTestEvents', () => {
    const processor = buildProcessor(
      blue,
      new SetPropertyContractProcessor(),
      new TestEventChannelProcessor()
    );

    const yaml = `name: Sample Doc
contracts:
  testEventsChannel:
    type:
      blueId: TestEventChannel
  setX:
    channel: testEventsChannel
    type:
      blueId: SetProperty
    propertyKey: /x
    propertyValue: 1
`;

    const initialized = expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml))
    ).document.clone();
    expect(propertyOptional(initialized, 'x')).toBeUndefined();

    const randomEvent = blue.yamlToNode(`type:
  blueId: RandomEvent
`);
    const afterRandom = expectOk(
      processor.processDocument(initialized.clone(), randomEvent)
    ).document.clone();
    expect(propertyOptional(afterRandom, 'x')).toBeUndefined();

    const testEvent = blue.jsonValueToNode({
      type: { blueId: 'TestEvent' },
      x: 5,
      y: 10,
    });
    const afterTest = expectOk(
      processor.processDocument(afterRandom.clone(), testEvent)
    ).document;
    expect(Number(property(afterTest, 'x').getValue())).toBe(1);
  });

  it('triggeredAndEmbeddedChannelsPropagateChildEvents', () => {
    const processor = buildProcessor(
      blue,
      new SetPropertyContractProcessor(),
      new EmitEventsContractProcessor(),
      new SetPropertyOnEventContractProcessor(),
      new TestEventChannelProcessor()
    );

    const yaml = `name: Cascade Doc
a:
  name: Child Doc
  contracts:
    life:
      type: Lifecycle Event Channel
    triggered:
      type: Triggered Event Channel
    emitOnInit:
      channel: life
      event:
        type: Document Processing Initiated
      type:
        blueId: EmitEvents
      events:
        - type:
            blueId: TestEvent
          kind: first
    setLocalFirst:
      channel: triggered
      type:
        blueId: SetPropertyOnEvent
      expectedKind: first
      propertyKey: /localFirst
      propertyValue: 1
    emitSecond:
      channel: triggered
      order: 1
      type:
        blueId: EmitEvents
      expectedKind: first
      events:
        - type:
            blueId: TestEvent
          kind: second
    setLocalSecond:
      channel: triggered
      order: 2
      type:
        blueId: SetPropertyOnEvent
      expectedKind: second
      propertyKey: /localSecond
      propertyValue: 1
contracts:
  embedded:
    type: Process Embedded
    paths:
      - /a
  embeddedEvents:
    type: Embedded Node Channel
    childPath: /a
  setRootFromChild:
    channel: embeddedEvents
    type:
      blueId: SetPropertyOnEvent
    expectedKind: second
    propertyKey: /fromChild
    propertyValue: 1
`;

    const processed = expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml))
    ).document;

    const child = property(processed, 'a');
    expect(Number(property(child, 'localFirst').getValue())).toBe(1);
    expect(Number(property(child, 'localSecond').getValue())).toBe(1);
    expect(Number(property(processed, 'fromChild').getValue())).toBe(1);
  });

  it('checkpointSkipsStaleEvents', () => {
    const processor = buildProcessor(
      blue,
      new SetPropertyContractProcessor(),
      new IncrementPropertyContractProcessor(),
      new TestEventChannelProcessor()
    );

    const yaml = `name: Checkpoint Doc
contracts:
  testEventsChannel:
    type:
      blueId: TestEventChannel
  incrementX:
    channel: testEventsChannel
    type:
      blueId: IncrementProperty
    propertyKey: /x
`;

    const initialized = expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml))
    ).document.clone();
    expect(checkpointValue(initialized)).toBeNull();

    const event1 = blue.jsonValueToNode({
      type: { blueId: 'TestEvent' },
      eventId: 'evt-1',
    });
    const afterFirst = expectOk(
      processor.processDocument(initialized.clone(), event1)
    ).document.clone();
    expect(Number(property(afterFirst, 'x').getValue())).toBe(1);
    expect(checkpointValue(afterFirst)).toBe('evt-1');

    const stale = blue.jsonValueToNode({
      type: { blueId: 'TestEvent' },
      eventId: 'evt-1',
    });
    const afterStale = expectOk(
      processor.processDocument(afterFirst.clone(), stale)
    ).document.clone();
    expect(Number(property(afterStale, 'x').getValue())).toBe(1);
    expect(checkpointValue(afterStale)).toBe('evt-1');

    const fresh = blue.jsonValueToNode({
      type: { blueId: 'TestEvent' },
      eventId: 'evt-2',
    });
    const afterFresh = expectOk(
      processor.processDocument(afterStale.clone(), fresh)
    ).document;
    expect(Number(property(afterFresh, 'x').getValue())).toBe(2);
    expect(checkpointValue(afterFresh)).toBe('evt-2');
  });

  it('checkpointStoresFullEventAndComparesPayload', () => {
    const processor = buildProcessor(
      blue,
      new SetPropertyContractProcessor(),
      new IncrementPropertyContractProcessor(),
      new TestEventChannelProcessor()
    );

    const yaml = `name: Payload Checkpoint Doc
contracts:
  testEventsChannel:
    type:
      blueId: TestEventChannel
  incrementX:
    channel: testEventsChannel
    type:
      blueId: IncrementProperty
    propertyKey: /x
`;

    const initialized = expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml))
    ).document.clone();

    const firstEvent = blue.yamlToNode(`type:
  blueId: TestEvent
kind: alpha
`);
    const afterFirst = expectOk(
      processor.processDocument(initialized.clone(), firstEvent)
    ).document.clone();
    expect(Number(property(afterFirst, 'x').getValue())).toBe(1);
    const storedEvent = checkpointStoredEvent(afterFirst);
    expect(storedEvent?.getProperties()?.kind?.getValue()).toBe('alpha');

    const identicalEvent = blue.yamlToNode(`type:
  blueId: TestEvent
kind: alpha
`);
    const afterSecond = expectOk(
      processor.processDocument(afterFirst.clone(), identicalEvent)
    ).document.clone();
    expect(Number(property(afterSecond, 'x').getValue())).toBe(1);

    const changedEvent = blue.yamlToNode(`type:
  blueId: TestEvent
kind: beta
`);
    const afterThird = expectOk(
      processor.processDocument(afterSecond.clone(), changedEvent)
    ).document;
    expect(Number(property(afterThird, 'x').getValue())).toBe(2);
    const updatedEvent = checkpointStoredEvent(afterThird);
    expect(updatedEvent?.getProperties()?.kind?.getValue()).toBe('beta');
  });
});
