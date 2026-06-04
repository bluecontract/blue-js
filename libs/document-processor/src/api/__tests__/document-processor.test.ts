import { createBlue } from '../../test-support/blue.js';
import { describe, expect, it } from 'vitest';

import { conversationBlueIds } from '../../repository/semantic-repository.js';
import { DocumentProcessor } from '../document-processor.js';
import type { DocumentProcessingRuntime } from '../../runtime/document-processing-runtime.js';
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

  it('does not reuse processing runtime state across processDocument invocations', async () => {
    const runtimes: DocumentProcessingRuntime[] = [];
    const processor = new DocumentProcessor({
      blue,
      runtimeHooks: {
        planPatch(_scopePath, runtime) {
          runtimes.push(runtime);
          return { generatedPatches: [] };
        },
      },
    });
    const documentYaml = `name: Runtime Isolation Doc
status: initial
contracts:
  investorChannel:
    type: MyOS/MyOS Timeline Channel
    timelineId: investor-timeline
  setStatus:
    type: Coordination/Operation
    channel: investorChannel
  setStatusImpl:
    type: Coordination/Sequential Workflow Operation
    operation: setStatus
    steps:
      - name: SetStatus
        type: Coordination/Compute
        do:
          - $appendChange:
              op: replace
              path: /status
              val:
                $event: /message/request/status
          - $return:
              changeset:
                $changeset: true
              events:
                $events: true
`;
    const initializedA = (
      await processor.initializeDocument(
        blue.resolve(blue.yamlToNode(documentYaml)),
      )
    ).document;
    const initializedB = (
      await processor.initializeDocument(
        blue.resolve(blue.yamlToNode(documentYaml)),
      )
    ).document;

    const processedA = await processor.processDocument(
      initializedA,
      operationRequestEvent('one'),
    );
    const processedB = await processor.processDocument(
      initializedB,
      operationRequestEvent('two'),
    );

    expect(processedA.capabilityFailure).toBe(false);
    expect(processedB.capabilityFailure).toBe(false);
    expect(processedA.document.get('/status')).toBe('one');
    expect(processedB.document.get('/status')).toBe('two');
    expect(runtimes).toHaveLength(2);
    expect(runtimes[0]).not.toBe(runtimes[1]);
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

  it('initializes when processing uninitialized document', async () => {
    const processor = createDocumentProcessor();
    const uninitializedDoc = blue.yamlToNode(
      documentWithLifecycleAndEventHandlers(),
    );
    const eventNode = blue.jsonValueToNode({ type: { blueId: 'TestEvent' } });

    const result = await processor.processDocument(uninitializedDoc, eventNode);
    expect(result.capabilityFailure).toBe(false);
    expect(processor.isInitialized(result.document)).toBe(true);
    expect(result.document.getProperties()?.initialized?.getValue()).toEqual(
      new Big(1),
    );
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

  it('loads inherited marker subtypes with default registry', () => {
    const processor = new DocumentProcessor({ blue });
    const original = blue.jsonValueToNode({
      name: 'Marker Inheritance Example',
      contracts: {
        section: {
          type: {
            blueId: conversationBlueIds['Conversation/Document Section'],
          },
        },
        policy: {
          type: {
            blueId: conversationBlueIds['Conversation/Contracts Change Policy'],
          },
        },
        actorPolicy: {
          type: {
            blueId: conversationBlueIds['Conversation/Actor Policy'],
          },
          operations: {
            authorizeFunds: {
              requiresActor: 'principal',
              requiresSource: 'browserSession',
            },
          },
        },
      },
    });

    const markers = processor.markersFor(original, '/');
    expect(markers.has('section')).toBe(true);
    expect(markers.has('policy')).toBe(true);
    expect(markers.get('actorPolicy')).toMatchObject({
      operations: {
        authorizeFunds: {
          requiresActor: 'principal',
          requiresSource: 'browserSession',
        },
      },
    });
  });
});

function operationRequestEvent(status: string): BlueNode {
  return blue.resolve(
    blue.jsonValueToNode({
      type: 'MyOS/MyOS Timeline Entry',
      timeline: { timelineId: 'investor-timeline' },
      timestamp: Date.now(),
      message: {
        type: 'Coordination/Operation Request',
        operation: 'setStatus',
        request: { status },
      },
    }),
  );
}
