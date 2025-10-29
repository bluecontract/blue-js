import { createBlue } from '../../test-support/blue.js';
import { describe, expect, it } from 'vitest';

import { DocumentProcessor } from '../document-processor.js';
import {
  SetPropertyContractProcessor,
  TestEventChannelProcessor,
} from '../../__tests__/processors/index.js';
import { default as Big } from 'big.js';

const blue = createBlue();

function createDocumentProcessor(): DocumentProcessor {
  const processor = new DocumentProcessor({ blue });
  processor.registerContractProcessor(new SetPropertyContractProcessor());
  processor.registerContractProcessor(new TestEventChannelProcessor());
  return processor;
}

function documentWithLifecycleAndEventHandlers(): string {
  return `name: Example
contracts:
  lifecycleChannel:
    type: Lifecycle Event Channel
  onLifecycle:
    channel: lifecycleChannel
    type:
      blueId: SetProperty
    propertyKey: /initialized
    propertyValue: 1
  testChannel:
    type:
      blueId: TestEventChannel
  onTestEvent:
    channel: testChannel
    type:
      blueId: SetProperty
    propertyKey: /processed
    propertyValue: 5
`;
}

describe('DocumentProcessor', () => {
  it('initializes documents and returns processing result', async () => {
    const processor = createDocumentProcessor();
    const original = blue.yamlToNode(documentWithLifecycleAndEventHandlers());

    const init = await processor.initializeDocument(original);
    expect(init.capabilityFailure).toBe(false);

    const initialized = init.document;
    expect(processor.isInitialized(initialized)).toBe(true);
    const properties = initialized.getProperties();
    expect(properties?.initialized?.getValue()).toEqual(new Big(1));
    expect(init.triggeredEvents).toHaveLength(1);
    const lifecycleEvent = init.triggeredEvents[0];
    expect(lifecycleEvent.getProperties()?.type?.getValue()).toBe(
      'Document Processing Initiated',
    );
  });

  it('processes external events and updates document state', async () => {
    const processor = createDocumentProcessor();
    const original = blue.yamlToNode(documentWithLifecycleAndEventHandlers());

    const init = await processor.initializeDocument(original);
    const initialized = init.document;

    const eventNode = blue.jsonValueToNode({
      type: { blueId: 'TestEvent' },
    });

    const processed = await processor.processDocument(initialized, eventNode);
    expect(processed.capabilityFailure).toBe(false);

    const processedDoc = processed.document;
    const props = processedDoc.getProperties();
    expect(props?.processed?.getValue()).toEqual(new Big(5));
    expect(processed.triggeredEvents).toHaveLength(0);
  });

  it('throws when document already initialized', async () => {
    const processor = createDocumentProcessor();
    const original = blue.yamlToNode(documentWithLifecycleAndEventHandlers());

    const firstInit = await processor.initializeDocument(original);
    expect(firstInit.capabilityFailure).toBe(false);

    await expect(
      processor.initializeDocument(firstInit.document),
    ).rejects.toThrowError(/Document already initialized/);
  });

  it('throws when processing uninitialized document', async () => {
    const processor = createDocumentProcessor();
    const uninitializedDoc = blue.yamlToNode(
      documentWithLifecycleAndEventHandlers(),
    );
    const eventNode = blue.jsonValueToNode({ type: { blueId: 'TestEvent' } });

    await expect(
      processor.processDocument(uninitializedDoc, eventNode),
    ).rejects.toThrowError(/Document not initialized/);
  });

  it('returns capability failure when contracts are not understood', async () => {
    const processor = createDocumentProcessor();
    const original = blue.yamlToNode(
      `name: Example
contracts:
  mysteryChannel:
    type:
      blueId: UnknownChannelType
`,
    );

    const result = await processor.initializeDocument(original);
    expect(result.capabilityFailure).toBe(true);
    expect(result.failureReason).toMatch(/Unsupported contract type/);
    expect(result.totalGas).toBe(0);
    expect(result.triggeredEvents).toHaveLength(0);
    expect(blue.nodeToJson(result.document)).toEqual(
      blue.nodeToJson(original.clone()),
    );
  });

  it('loads markers for a scope', async () => {
    const processor = createDocumentProcessor();
    const original = blue.yamlToNode(documentWithLifecycleAndEventHandlers());

    const init = await processor.initializeDocument(original);

    const markers = processor.markersFor(init.document, '/');
    expect(markers.has('initialized')).toBe(true);
  });
});
