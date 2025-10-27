import { describe, it, expect } from 'vitest';
import { BlueNode } from '@blue-labs/language';

import {
  RemovePropertyContractProcessor,
  SetPropertyContractProcessor,
} from './processors/index.js';
import {
  buildProcessor,
  expectOk,
  property,
  propertyOptional,
  stringProperty,
} from './test-utils.js';
import { blueIds, createBlue } from '../test-support/blue.js';

const blue = createBlue();

describe('DocumentProcessorInitializationTest', () => {
  it('initializesDocumentAndExecutesHandlersInOrder', () => {
    const processor = buildProcessor(blue, new SetPropertyContractProcessor());
    const yaml = `name: Sample Doc
contracts:
  lifecycleChannel:
    type: Lifecycle Event Channel
  setX:
    channel: lifecycleChannel
    type:
      blueId: SetProperty
    event:
      type: Document Processing Initiated
    propertyKey: /x
    propertyValue: 5
  setXLater:
    order: 1
    channel: lifecycleChannel
    type:
      blueId: SetProperty
    event:
      type: Document Processing Initiated
    propertyKey: /x
    propertyValue: 10
`;

    const original = blue.yamlToNode(yaml);
    const expectedDocumentId = blue.calculateBlueIdSync(original.clone());

    const initResult = expectOk(processor.initializeDocument(original.clone()));
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
    expect(initializedMarker.getType()?.getBlueId()).toBe(
      blueIds['Processing Initialized Marker']
    );
    expect(stringProperty(initializedMarker, 'documentId')).toBe(
      expectedDocumentId
    );

    const checkpoint = propertyOptional(contracts, 'checkpoint');
    expect(checkpoint).toBeUndefined();

    expect(() => processor.initializeDocument(initialized.clone())).toThrow(
      /Document already initialized/
    );

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
    type: Lifecycle Event Channel
  setRoot:
    channel: lifecycleChannel
    type:
      blueId: SetProperty
    event:
      type: Document Processing Initiated
    propertyKey: /x
    propertyValue: 3
  setNested:
    order: 1
    channel: lifecycleChannel
    type:
      blueId: SetProperty
    path: /nested/branch/
    event:
      type: Document Processing Initiated
    propertyKey: x
    propertyValue: 7
  setExplicit:
    order: 2
    channel: lifecycleChannel
    type:
      blueId: SetProperty
    path: a/x
    event:
      type: Document Processing Initiated
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
    type: Lifecycle Event Channel
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

    expect(
      result.capabilityFailure,
      'Initialization should fail with must-understand'
    ).toBe(true);
    expect(result.totalGas).toBe(0);
    expect(result.triggeredEvents.length).toBe(0);
    expect(JSON.stringify(blue.nodeToJson(result.document))).toBe(originalJson);
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
    expect(() => processor.isInitialized(document)).toThrow(
      /Initialization Marker/
    );
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
    type: Lifecycle Event Channel
  removeX:
    channel: lifecycleChannel
    type:
      blueId: RemoveProperty
    event:
      type: Document Processing Initiated
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
    type: Channel Event Checkpoint
`;

    const document = blue.yamlToNode(yaml);
    expect(() => processor.initializeDocument(document)).toThrow();
  });

  it('initializationFailsWhenCheckpointHasWrongType', () => {
    const processor = buildProcessor(blue);
    const yaml = `name: Wrong Checkpoint Doc
contracts:
  checkpoint:
    type: Processing Terminated Marker
`;

    expect(() => processor.initializeDocument(blue.yamlToNode(yaml))).toThrow(
      /Channel Event Checkpoint/
    );
  });

  it('initializationFailsWhenMultipleCheckpointsPresent', () => {
    const processor = buildProcessor(blue);
    const yaml = `name: Duplicate Checkpoint Doc
contracts:
  checkpoint:
    type: Channel Event Checkpoint
  extraCheckpoint:
    type: Channel Event Checkpoint
`;

    expect(() => processor.initializeDocument(blue.yamlToNode(yaml))).toThrow(
      /Channel Event Checkpoint/
    );
  });

  it('lifecycleEventsDoNotDriveTriggeredHandlers', () => {
    const processor = buildProcessor(blue, new SetPropertyContractProcessor());
    const yaml = `name: Lifecycle Trigger Isolation
contracts:
  lifecycleChannel:
    type: Lifecycle Event Channel
  triggeredChannel:
    type: Triggered Event Channel
  handleLifecycle:
    channel: lifecycleChannel
    type:
      blueId: SetProperty
    event:
      type: Document Processing Initiated
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
    type: Process Embedded
    paths:
      - /child
  childBridge:
    type: Embedded Node Channel
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
