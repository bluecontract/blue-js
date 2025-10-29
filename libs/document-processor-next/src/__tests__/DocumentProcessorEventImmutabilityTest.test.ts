import { createBlue } from '../test-support/blue.js';
import { describe, beforeEach, it, expect } from 'vitest';

import {
  MutateEventContractProcessor,
  SetPropertyOnEventContractProcessor,
  TestEventChannelProcessor,
} from './processors/index.js';
import { buildProcessor, expectOk, property } from './test-utils.js';

const blue = createBlue();

describe('DocumentProcessorEventImmutabilityTest', () => {
  let processor = buildProcessor(blue);

  beforeEach(() => {
    processor = buildProcessor(
      blue,
      new TestEventChannelProcessor(),
      new MutateEventContractProcessor(),
      new SetPropertyOnEventContractProcessor(),
    );
  });

  it('handlersSeeImmutableEventSnapshots', () => {
    const documentYaml = `name: Immutable
contracts:
  testChannel:
    type:
      blueId: TestEventChannel
  mutator:
    channel: testChannel
    type:
      blueId: MutateEvent
  recorder:
    channel: testChannel
    order: 1
    type:
      blueId: SetPropertyOnEvent
    expectedKind: original
    propertyKey: /result
    propertyValue: 42
`;

    const initialized = expectOk(
      processor.initializeDocument(blue.yamlToNode(documentYaml)),
    ).document.clone();

    const eventYaml = `type:
  blueId: TestEvent
eventId: evt-immutable
kind: original
`;
    const event = blue.yamlToNode(eventYaml);
    const processed = expectOk(
      processor.processDocument(initialized, event),
    ).document;

    const resultNode = property(processed, 'result');
    expect(Number(resultNode.getValue())).toBe(42);
  });
});
