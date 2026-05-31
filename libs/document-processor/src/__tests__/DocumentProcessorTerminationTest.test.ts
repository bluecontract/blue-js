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
  numericProperty,
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
      new SetPropertyContractProcessor(),
    );
  });

  it('rootGracefulTerminationStopsFurtherWork', async () => {
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

    const initialized = (
      await expectOk(processor.initializeDocument(blue.yamlToNode(yaml)))
    ).document.clone();

    const result = await expectOk(
      processor.processDocument(initialized, testEvent('evt-1')),
    );
    const processed = result.document;
    const contracts = property(processed, 'contracts');
    const terminated = property(contracts, 'terminated');
    expect(stringProperty(terminated, 'cause')).toBe('graceful');
    expect(propertyOptional(processed, 'afterTermination')).toBeUndefined();

    expect(result.triggeredEvents.length).toBe(1);
    const terminationEvent = result.triggeredEvents[0];
    expect(typeBlueId(terminationEvent)).toBe(
      blueIds['Document Processing Terminated'],
    );
    expect(stringProperty(terminationEvent, 'cause')).toBe('graceful');
  });

  it('rootFatalTerminationEmitsTerminationEvent', async () => {
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

    const initialized = (
      await expectOk(processor.initializeDocument(blue.yamlToNode(yaml)))
    ).document.clone();

    const result = await expectOk(
      processor.processDocument(initialized, testEvent('evt-2')),
    );
    const terminatedEvents = result.triggeredEvents.filter(
      (eventNode) =>
        typeBlueId(eventNode) === blueIds['Document Processing Terminated'],
    );
    expect(terminatedEvents).toHaveLength(1);
    const terminatedEvent = terminatedEvents[0]!;
    expect(typeBlueId(terminatedEvent)).toBe(
      blueIds['Document Processing Terminated'],
    );
    expect(stringProperty(terminatedEvent, 'cause')).toBe('fatal');
    expect(stringProperty(terminatedEvent, 'reason')).toBe('panic');
  });

  it('does not reinitialize an already initialized document after a BEX runtime failure', async () => {
    const yaml = `name: BEX Failing Process
contracts:
  life:
    type: Lifecycle Event Channel
  testChannel:
    type:
      blueId: TestEventChannel
  onInit:
    type: Conversation/Sequential Workflow
    channel: life
    event:
      type: Document Processing Initiated
    steps:
      - name: MarkInitialized
        type: Conversation/Update Document
        changeset:
          - op: ADD
            path: /initCount
            val: 1
  onTestEvent:
    type: Conversation/Sequential Workflow
    channel: testChannel
    steps:
      - name: Boom
        type: Conversation/Compute
        expr:
          $unknown: boom
`;

    const initialized = await expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    );
    expect(numericProperty(initialized.document, 'initCount')).toBe(1);

    const event = blue.jsonValueToNode({
      type: { blueId: 'TestEvent' },
      eventId: 'evt-4',
      x: 1,
    });

    const result = await expectOk(
      processor.processDocument(initialized.document.clone(), event),
    );

    expect(processor.isInitialized(result.document)).toBe(true);
    expect(numericProperty(result.document, 'initCount')).toBe(1);

    const contracts = property(result.document, 'contracts');
    const terminated = property(contracts, 'terminated');
    expect(stringProperty(terminated, 'cause')).toBe('fatal');
    expect(stringProperty(terminated, 'reason')).toMatch(/BEX Compute/i);
    expect(stringProperty(terminated, 'reason')).toMatch(
      /Unknown BEX operator/i,
    );

    const initiatedEvents = result.triggeredEvents.filter(
      (event) => typeBlueId(event) === blueIds['Document Processing Initiated'],
    );
    expect(initiatedEvents).toHaveLength(0);

    const terminatedEvents = result.triggeredEvents.filter(
      (event) =>
        typeBlueId(event) === blueIds['Document Processing Terminated'],
    );
    expect(terminatedEvents).toHaveLength(1);
  });

  it('childTerminationBridgesToParent', async () => {
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

    const initialized = (
      await expectOk(processor.initializeDocument(blue.yamlToNode(yaml)))
    ).document.clone();

    const result = await expectOk(
      processor.processDocument(initialized, testEvent('evt-3')),
    );
    const processed = result.document;
    expect(Number(property(processed, 'fromChild').getValue())).toBe(7);

    const childContracts = property(property(processed, 'child'), 'contracts');
    const childTerminated = property(childContracts, 'terminated');
    expect(stringProperty(childTerminated, 'cause')).toBe('graceful');
  });

  it('treats BEX runtime errors during initialization as fatal terminations instead of host exceptions', async () => {
    const yaml = `name: BEX Failing Init
contracts:
  life:
    type: Lifecycle Event Channel
  onInit:
    type: Conversation/Sequential Workflow
    channel: life
    event:
      type: Document Processing Initiated
    steps:
      - name: Boom
        type: Conversation/Compute
        expr:
          $unknown: boom
`;

    const document = blue.yamlToNode(yaml);

    const result = await expectOk(processor.initializeDocument(document));

    const contracts = property(result.document, 'contracts');
    const terminated = property(contracts, 'terminated');
    expect(stringProperty(terminated, 'cause')).toBe('fatal');

    const terminationEvents = result.triggeredEvents.filter(
      (e) => typeBlueId(e) === blueIds['Document Processing Terminated'],
    );
    expect(terminationEvents.length).toBe(1);
    expect(stringProperty(terminationEvents[0], 'cause')).toBe('fatal');

    expect(result.totalGas).toBeGreaterThan(0);
  });
});
