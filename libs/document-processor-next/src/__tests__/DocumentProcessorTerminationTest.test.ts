import { blueIds, createBlue } from '../test-support/blue.js';
import { beforeEach, describe, it, expect } from 'vitest';

import {
  SetPropertyContractProcessor,
  TerminateScopeContractProcessor,
  TestEventChannelProcessor,
} from './processors/index.js';
import {
  buildProcessor,
  expectOk,
  property,
  propertyOptional,
  stringProperty,
  typeBlueId,
} from './test-utils.js';

const blue = createBlue();

function testEvent(eventId: string) {
  return blue.jsonValueToNode({
    type: { blueId: 'TestEvent' },
    eventId,
    x: 1,
  });
}

describe('DocumentProcessorTerminationTest', () => {
  let processor = buildProcessor(blue);

  beforeEach(() => {
    processor = buildProcessor(
      blue,
      new TestEventChannelProcessor(),
      new TerminateScopeContractProcessor(),
      new SetPropertyContractProcessor()
    );
  });

  it('rootGracefulTerminationStopsFurtherWork', () => {
    const yaml = `name: Root Doc
contracts:
  testChannel:
    type:
      blueId: TestEventChannel
  terminate:
    channel: testChannel
    type:
      blueId: TerminateScope
    mode: graceful
    emitAfter: true
    patchAfter: true
`;

    const initialized = expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml))
    ).document.clone();

    const result = expectOk(
      processor.processDocument(initialized, testEvent('evt-1'))
    );
    const processed = result.document;
    const contracts = property(processed, 'contracts');
    const terminated = property(contracts, 'terminated');
    expect(stringProperty(terminated, 'cause')).toBe('graceful');
    expect(propertyOptional(processed, 'afterTermination')).toBeUndefined();

    expect(result.triggeredEvents.length).toBe(1);
    const terminationEvent = result.triggeredEvents[0];
    expect(typeBlueId(terminationEvent)).toBe(
      blueIds['Document Processing Terminated']
    );
    expect(stringProperty(terminationEvent, 'cause')).toBe('graceful');
  });

  it('rootFatalTerminationEmitsTerminationEvent', () => {
    const yaml = `name: Root Fatal
contracts:
  testChannel:
    type:
      blueId: TestEventChannel
  terminate:
    channel: testChannel
    type:
      blueId: TerminateScope
    mode: fatal
    reason: panic
`;

    const initialized = expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml))
    ).document.clone();

    const result = expectOk(
      processor.processDocument(initialized, testEvent('evt-2'))
    );
    expect(result.triggeredEvents.length).toBe(1);
    const terminatedEvent = result.triggeredEvents[0];
    expect(typeBlueId(terminatedEvent)).toBe(
      blueIds['Document Processing Terminated']
    );
    expect(stringProperty(terminatedEvent, 'cause')).toBe('fatal');
    expect(stringProperty(terminatedEvent, 'reason')).toBe('panic');
  });

  it('childTerminationBridgesToParent', () => {
    const yaml = `name: Parent
child:
  name: Child
  contracts:
    testChannel:
      type:
        blueId: TestEventChannel
    terminate:
      channel: testChannel
      type:
        blueId: TerminateScope
      mode: graceful
contracts:
  embedded:
    type: Process Embedded
    paths:
      - /child
  childBridge:
    type: Embedded Node Channel
    childPath: /child
  captureChild:
    channel: childBridge
    type:
      blueId: SetProperty
    propertyKey: /fromChild
    propertyValue: 7
`;

    const initialized = expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml))
    ).document.clone();

    const result = expectOk(
      processor.processDocument(initialized, testEvent('evt-3'))
    );
    const processed = result.document;
    expect(Number(property(processed, 'fromChild').getValue())).toBe(7);

    const childContracts = property(property(processed, 'child'), 'contracts');
    const childTerminated = property(childContracts, 'terminated');
    expect(stringProperty(childTerminated, 'cause')).toBe('graceful');
  });
});
