import { Blue } from '@blue-labs/language';
import { describe, expect, it } from 'vitest';

import { DocumentProcessor } from '../document-processor.js';
import {
  SetPropertyContractProcessor,
  TestEventChannelProcessor,
} from '../../__tests__/processors/index.js';
import { default as Big } from 'big.js';

const blue = new Blue();

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
    type:
      blueId: LifecycleChannel
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
  it('initializes documents and returns processing result', () => {
    const processor = createDocumentProcessor();
    const original = blue.yamlToNode(documentWithLifecycleAndEventHandlers());

    const init = processor.initializeDocument(original);
    expect(init.ok).toBe(true);
    if (!init.ok) {
      return;
    }

    const initialized = init.value.document;
    expect(processor.isInitialized(initialized)).toBe(true);
    const properties = initialized.getProperties();
    expect(properties?.initialized?.getValue()).toEqual(new Big(1));
    expect(init.value.triggeredEvents).toHaveLength(1);
    const lifecycleEvent = init.value.triggeredEvents[0];
    expect(lifecycleEvent.getProperties()?.type?.getValue()).toBe(
      'Document Processing Initiated'
    );
  });

  it('processes external events and updates document state', () => {
    const processor = createDocumentProcessor();
    const original = blue.yamlToNode(documentWithLifecycleAndEventHandlers());

    const init = processor.initializeDocument(original);
    expect(init.ok).toBe(true);
    if (!init.ok) {
      return;
    }

    const initialized = init.value.document;
    const eventNode = blue.jsonValueToNode({
      type: { blueId: 'TestEvent' },
    });

    const processed = processor.processDocument(initialized, eventNode);
    expect(processed.ok).toBe(true);
    if (!processed.ok) {
      return;
    }

    const processedDoc = processed.value.document;
    const props = processedDoc.getProperties();
    expect(props?.processed?.getValue()).toEqual(new Big(5));
    expect(processed.value.triggeredEvents).toHaveLength(0);
  });

  it('returns typed errors for invalid lifecycle usage', () => {
    const processor = createDocumentProcessor();
    const original = blue.yamlToNode(documentWithLifecycleAndEventHandlers());

    const firstInit = processor.initializeDocument(original);
    expect(firstInit.ok).toBe(true);
    if (!firstInit.ok) {
      return;
    }

    const secondInit = processor.initializeDocument(firstInit.value.document);
    expect(secondInit.ok).toBe(false);
    if (secondInit.ok) {
      return;
    }
    expect(secondInit.error.kind).toBe('IllegalState');
    expect(secondInit.error.reason).toMatch(
      /Initialization Marker already present/
    );

    const uninitializedDoc = blue.yamlToNode(
      documentWithLifecycleAndEventHandlers()
    );
    const eventNode = blue.jsonValueToNode({ type: { blueId: 'TestEvent' } });
    const processed = processor.processDocument(uninitializedDoc, eventNode);
    expect(processed.ok).toBe(false);
    if (processed.ok) {
      return;
    }
    expect(processed.error.kind).toBe('IllegalState');
    expect(processed.error.reason).toMatch(/missing/i);
  });

  it('loads markers for a scope', () => {
    const processor = createDocumentProcessor();
    const original = blue.yamlToNode(documentWithLifecycleAndEventHandlers());

    const init = processor.initializeDocument(original);
    expect(init.ok).toBe(true);
    if (!init.ok) {
      return;
    }

    const markers = processor.markersFor(init.value.document, '/');
    expect(markers.ok).toBe(true);
    if (!markers.ok) {
      return;
    }
    expect(markers.value.has('initialized')).toBe(true);
  });
});
