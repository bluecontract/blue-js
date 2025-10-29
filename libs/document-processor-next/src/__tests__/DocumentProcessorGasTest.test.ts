import { createBlue } from '../test-support/blue.js';
import { beforeEach, describe, it, expect } from 'vitest';
import { BlueNode, JsonCanonicalizer } from '@blue-labs/language';

import {
  EmitEventsContractProcessor,
  SetPropertyContractProcessor,
  TestEventChannelProcessor,
} from './processors/index.js';
import { buildProcessor, expectOk, property } from './test-utils.js';

const blue = createBlue();

function scopeDepth(scopePath: string): number {
  if (!scopePath || scopePath === '/') {
    return 0;
  }
  const trimmed = scopePath.replace(/^\//, '').replace(/\/$/, '');
  if (trimmed.length === 0) {
    return 0;
  }
  return trimmed.split('/').length;
}

function scopeEntryCharge(scopePath: string): number {
  const depth = scopeDepth(scopePath);
  return 50 + 10 * depth;
}

function canonicalSize(node: BlueNode): number {
  const json = blue.nodeToJson(node);
  const canonical = JsonCanonicalizer.canonicalize(json);
  return Buffer.byteLength(canonical ?? '', 'utf8');
}

function sizeCharge(node: BlueNode): number {
  const bytes = canonicalSize(node);
  return Math.floor((bytes + 99) / 100);
}

describe('DocumentProcessorGasTest', () => {
  let processor = buildProcessor(blue);

  beforeEach(() => {
    processor = buildProcessor(
      blue,
      new TestEventChannelProcessor(),
      new SetPropertyContractProcessor(),
      new EmitEventsContractProcessor(),
    );
  });

  it('initializationGasMatchesExpectedCharges', () => {
    const document = blue.yamlToNode('name: Doc\n');
    const result = expectOk(processor.initializeDocument(document.clone()));
    const initializedMarker = property(
      property(result.document, 'contracts'),
      'initialized',
    );
    const markerCharge = sizeCharge(initializedMarker);

    const expected =
      scopeEntryCharge('/') +
      1_000 + // initialization
      30 + // lifecycle delivery
      2 + // boundary check
      (20 + markerCharge) + // patch add
      10; // cascade routing

    expect(result.totalGas).toBe(expected);
  });

  it('processDocumentPatchGasMatchesExpectedCharges', () => {
    const yaml = `name: Base
contracts:
  testChannel:
    type:
      blueId: TestEventChannel
  setter:
    channel: testChannel
    type:
      blueId: SetProperty
    propertyKey: /x
    propertyValue: 1
`;

    const initialized = expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    ).document.clone();
    const event = blue.jsonValueToNode({
      type: { blueId: 'TestEvent' },
      eventId: 'evt-1',
    });

    const result = expectOk(processor.processDocument(initialized, event));
    const valueNode = property(result.document, 'x');
    const valueCharge = sizeCharge(valueNode);

    const expected =
      scopeEntryCharge('/') +
      5 + // channel match attempt
      50 + // handler overhead
      2 + // boundary check
      (20 + valueCharge) + // patch add/replace
      10 + // cascade routing
      20; // checkpoint update

    expect(result.totalGas).toBe(expected);
  });

  it('processDocumentEmitsTriggeredEventChargesEmitAndDrain', () => {
    const yaml = `name: Emit
contracts:
  testChannel:
    type:
      blueId: TestEventChannel
  emitter:
    channel: testChannel
    type:
      blueId: EmitEvents
    events:
      - type:
          blueId: TestEvent
        kind: emitted
  triggered:
    type: Triggered Event Channel
`;

    const initialized = expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    ).document.clone();
    const event = blue.jsonValueToNode({
      type: { blueId: 'TestEvent' },
      eventId: 'evt-emit',
    });

    const result = expectOk(processor.processDocument(initialized, event));
    const emitter = property(property(result.document, 'contracts'), 'emitter');
    const template = property(emitter, 'events').getItems()?.[0];
    if (!template) {
      throw new Error('missing emitted event template');
    }
    const emitCharge = sizeCharge(template);

    const expected =
      scopeEntryCharge('/') +
      5 + // channel match
      50 + // handler overhead
      (20 + emitCharge) + // emit event cost
      10 + // drain triggered
      20; // checkpoint update

    expect(result.totalGas).toBe(expected);
  });
});
