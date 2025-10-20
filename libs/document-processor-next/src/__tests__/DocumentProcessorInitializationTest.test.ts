import { describe, it, expect } from 'vitest';
import { Blue, BlueNode } from '@blue-labs/language';

import {
  RemovePropertyContractProcessor,
  SetPropertyContractProcessor,
} from './processors/index.js';
import {
  buildProcessor,
  expectErr,
  expectOk,
  property,
  propertyOptional,
  stringProperty,
} from './test-utils.js';

const blue = new Blue();

describe('DocumentProcessorInitializationTest', () => {
  it('initializesDocumentAndExecutesHandlersInOrder', () => {
    const processor = buildProcessor(blue, new SetPropertyContractProcessor());
    const yaml = `name: Sample Doc
contracts:
  lifecycleChannel:
    type:
      blueId: LifecycleChannel
  setX:
    channel: lifecycleChannel
    type:
      blueId: SetProperty
    event:
      type:
        blueId: DocumentProcessingInitiated
    propertyKey: /x
    propertyValue: 5
  setXLater:
    order: 1
    channel: lifecycleChannel
    type:
      blueId: SetProperty
    event:
      type:
        blueId: DocumentProcessingInitiated
    propertyKey: /x
    propertyValue: 10
`;

    const original = blue.yamlToNode(yaml);
    const expectedDocumentId = blue.calculateBlueIdSync(original.clone());

    const initResult = expectOk(
      processor.initializeDocument(original.clone())
    );
    const initialized = initResult.document.clone();

    expect(processor.isInitialized(initialized.clone())).toBe(true);

    expect(initResult.triggeredEvents.length).toBe(1);
    const lifecycleEvent = initResult.triggeredEvents[0];
    expect(stringProperty(lifecycleEvent, 'type')).toBe(
      'Document Processing Initiated'
    );
    expect(stringProperty(lifecycleEvent, 'documentId')).toBe(
      expectedDocumentId
    );

    expect(Number(property(initialized, 'x').getValue())).toBe(10);

    const contracts = property(initialized, 'contracts');
    const initializedMarker = property(contracts, 'initialized');
    expect(initializedMarker.getType()?.getBlueId()).toBe('InitializationMarker');
    expect(stringProperty(initializedMarker, 'documentId')).toBe(
      expectedDocumentId
    );

    const checkpoint = propertyOptional(contracts, 'checkpoint');
    expect(checkpoint).toBeUndefined();

    const secondInit = processor.initializeDocument(initialized.clone());
    const secondError = expectErr(secondInit);
    expect(secondError.kind).toBe('IllegalState');

    const processResult = expectOk(
      processor.processDocument(
        initialized.clone(),
        new BlueNode().setValue('external')
      )
    );
    expect(Number(property(processResult.document, 'x').getValue())).toBe(10);
    expect(processResult.triggeredEvents.length).toBe(0);

    expect(propertyOptional(original, 'x')).toBeUndefined();
  });

  it('initializationHandlesCustomPaths', () => {
    const processor = buildProcessor(blue, new SetPropertyContractProcessor());
    const yaml = `name: Custom Path Doc
contracts:
  lifecycleChannel:
    type:
      blueId: LifecycleChannel
  setRoot:
    channel: lifecycleChannel
    type:
      blueId: SetProperty
    event:
      type:
        blueId: DocumentProcessingInitiated
    propertyKey: /x
    propertyValue: 3
  setNested:
    order: 1
    channel: lifecycleChannel
    type:
      blueId: SetProperty
    path: /nested/branch/
    event:
      type:
        blueId: DocumentProcessingInitiated
    propertyKey: x
    propertyValue: 7
  setExplicit:
    order: 2
    channel: lifecycleChannel
    type:
      blueId: SetProperty
    path: a/x
    event:
      type:
        blueId: DocumentProcessingInitiated
    propertyKey: x
    propertyValue: 11
`;

    const result = expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml))
    );
    const processed = result.document;

    expect(Number(property(processed, 'x').getValue())).toBe(3);
    const nested = property(property(processed, 'nested'), 'branch');
    expect(Number(property(nested, 'x').getValue())).toBe(7);

    const aNode = property(processed, 'a');
    const firstX = property(aNode, 'x');
    const explicit = property(firstX, 'x');
    expect(Number(explicit.getValue())).toBe(11);
  });

  it('capabilityFailureWhenContractProcessorMissing', () => {
    const processor = buildProcessor(blue);
    const yaml = `name: Sample Doc
contracts:
  lifecycleChannel:
    type:
      blueId: LifecycleChannel
  setX:
    channel: lifecycleChannel
    type:
      blueId: SetProperty
    propertyKey: /x
    propertyValue: 5
`;

    const document = blue.yamlToNode(yaml);
    const originalJson = JSON.stringify(blue.nodeToJson(document.clone()));
    const result = processor.initializeDocument(document);
    const error = expectErr(result);
    expect(error.kind).toBe('CapabilityFailure');
    expect(error.reason?.toLowerCase()).toContain('unsupported');
    expect(JSON.stringify(blue.nodeToJson(document.clone()))).toBe(originalJson);
  });

  it('processDocumentFailsWhenInitializationMarkerIncompatible', () => {
    const processor = buildProcessor(blue);
    const yaml = `name: Bad Doc
contracts:
  initialized:
    type:
      blueId: NotInitializationMarker
`;

    const document = blue.yamlToNode(yaml);
    expect(() =>
      processor.processDocument(document, new BlueNode().setValue('event'))
    ).toThrow(/Initialization Marker/);
  });

  it('initializeDocumentFailsWhenInitializationKeyOccupiedIncorrectly', () => {
    const processor = buildProcessor(blue);
    const yaml = `name: Bad Init Doc
contracts:
  initialized:
    type:
      blueId: SomethingElse
`;

    const document = blue.yamlToNode(yaml);
    expect(() => processor.initializeDocument(document)).toThrow(
      /Initialization Marker/
    );
  });

  it('isInitializedThrowsWhenReservedKeyIsMisused', () => {
    const processor = buildProcessor(blue);
    const yaml = `name: Bad Check Doc
contracts:
  initialized:
    type:
      blueId: WrongMarker
`;

    const document = blue.yamlToNode(yaml);
    expect(() => processor.isInitialized(document)).toThrow(/Initialization Marker/);
  });

  it('removePatchDeletesPropertyDuringInitialization', () => {
    const processor = buildProcessor(
      blue,
      new RemovePropertyContractProcessor()
    );
    const yaml = `name: Remove Doc
x:
  type:
    blueId: Text
contracts:
  lifecycleChannel:
    type:
      blueId: LifecycleChannel
  removeX:
    channel: lifecycleChannel
    type:
      blueId: RemoveProperty
    event:
      type:
        blueId: DocumentProcessingInitiated
    propertyKey: /x
`;

    const original = blue.yamlToNode(yaml);
    expect(property(original, 'x')).toBeInstanceOf(BlueNode);

    const result = expectOk(processor.initializeDocument(original.clone()));
    const processed = result.document;
    expect(propertyOptional(processed, 'x')).toBeUndefined();

    const hasLifecycle = result.triggeredEvents.some(
      (eventNode: BlueNode) =>
        stringProperty(eventNode, 'type') === 'Document Processing Initiated'
    );
    expect(hasLifecycle).toBe(true);

    expect(property(original, 'x')).toBeInstanceOf(BlueNode);
  });

  it('checkpointBeforeInitializationCausesFatal', () => {
    const processor = buildProcessor(blue);
    const yaml = `name: Invalid Doc
contracts:
  checkpoint:
    type:
      blueId: ChannelEventCheckpoint
`;

    const document = blue.yamlToNode(yaml);
    const error = expectErr(processor.initializeDocument(document));
    expect(error.kind).toBe('RuntimeFatal');
  });

  it('initializationFailsWhenCheckpointHasWrongType', () => {
    const processor = buildProcessor(blue);
    const yaml = `name: Wrong Checkpoint Doc
contracts:
  checkpoint:
    type:
      blueId: ProcessingFailureMarker
`;

    const error = expectErr(processor.initializeDocument(blue.yamlToNode(yaml)));
    expect(error.reason).toContain('Channel Event Checkpoint');
  });

  it('initializationFailsWhenMultipleCheckpointsPresent', () => {
    const processor = buildProcessor(blue);
    const yaml = `name: Duplicate Checkpoint Doc
contracts:
  checkpoint:
    type:
      blueId: ChannelEventCheckpoint
  extraCheckpoint:
    type:
      blueId: ChannelEventCheckpoint
`;

    const error = expectErr(processor.initializeDocument(blue.yamlToNode(yaml)));
    expect(error.reason).toContain('Channel Event Checkpoint');
  });

  it('lifecycleEventsDoNotDriveTriggeredHandlers', () => {
    const processor = buildProcessor(blue, new SetPropertyContractProcessor());
    const yaml = `name: Lifecycle Trigger Isolation
contracts:
  lifecycleChannel:
    type:
      blueId: LifecycleChannel
  triggeredChannel:
    type:
      blueId: TriggeredEventChannel
  handleLifecycle:
    channel: lifecycleChannel
    type:
      blueId: SetProperty
    event:
      type:
        blueId: DocumentProcessingInitiated
    propertyKey: /lifecycle
    propertyValue: 1
  triggeredHandler:
    channel: triggeredChannel
    type:
      blueId: SetProperty
    propertyKey: /triggered
    propertyValue: 1
`;

    const initialized = expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml))
    ).document;

    expect(propertyOptional(initialized, 'lifecycle')).toBeDefined();
    expect(propertyOptional(initialized, 'triggered')).toBeUndefined();
  });

  it('childLifecycleIsBridgedToParent', () => {
    const processor = buildProcessor(blue, new SetPropertyContractProcessor());
    const yaml = `name: Embedded Lifecycle
child:
  name: Inner
  contracts: {}
contracts:
  embedded:
    type:
      blueId: ProcessEmbedded
    paths:
      - /child
  childBridge:
    type:
      blueId: EmbeddedNodeChannel
    childPath: /child
  captureChildLifecycle:
    channel: childBridge
    type:
      blueId: SetProperty
    propertyKey: /childLifecycle
    propertyValue: 1
`;

    const initialized = expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml))
    ).document;

    const childLifecycle = propertyOptional(initialized, 'childLifecycle');
    expect(childLifecycle).toBeDefined();
    expect(Number(childLifecycle?.getValue())).toBe(1);
  });
});
