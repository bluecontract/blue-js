import { describe, expect, it } from 'vitest';
import { Blue, BlueNode } from '@blue-labs/language';

import {
  CutOffProbeContractProcessor,
  MutateEmbeddedPathsContractProcessor,
  RemoveIfPresentContractProcessor,
  SetPropertyContractProcessor,
  SetPropertyOnEventContractProcessor,
  TestEventChannelProcessor,
} from './processors/index.js';
import {
  buildProcessor,
  expectOk,
  numericProperty,
  property,
  propertyOptional,
  stringProperty,
  terminatedMarker,
} from './test-utils.js';

function testEventNode(blue: Blue, payload?: Record<string, unknown>) {
  return blue.jsonValueToNode({
    type: { blueId: 'TestEvent' },
    ...(payload ?? {}),
  });
}

describe('ProcessEmbeddedTest', () => {
  it('initializesEmbeddedChildDocument', () => {
    const blue = new Blue();
    const processor = buildProcessor(blue, new SetPropertyContractProcessor());

    const yaml = `name: Sample Doc
x:
  name: Sample Sub Doc
  contracts:
    life:
      type:
        blueId: LifecycleChannel
    setX:
      channel: life
      event:
        type:
          blueId: DocumentProcessingInitiated
      type:
        blueId: SetProperty
      propertyKey: /a
      propertyValue: 1
contracts:
  embedded:
    type:
      blueId: ProcessEmbedded
    paths:
      - /x
`;

    const original = blue.yamlToNode(yaml);
    const rootId = blue.calculateBlueIdSync(original.clone());
    const originalChild = property(original, 'x');
    const childId = blue.calculateBlueIdSync(originalChild.clone());

    const result = expectOk(processor.initializeDocument(original));
    const initialized = result.document;

    const child = property(initialized, 'x');
    const childContracts = property(child, 'contracts');
    const childMarker = property(childContracts, 'initialized');
    expect(childMarker.getProperties()?.documentId?.getValue()).toBe(childId);
    expect(numericProperty(child, 'a')).toBe(1);

    const rootContracts = property(initialized, 'contracts');
    const rootMarker = property(rootContracts, 'initialized');
    expect(rootMarker.getProperties()?.documentId?.getValue()).toBe(rootId);

    expect(result.triggeredEvents).toHaveLength(1);
    const lifecycleEvent = result.triggeredEvents[0]!;
    expect(stringProperty(lifecycleEvent, 'type')).toBe(
      'Document Processing Initiated'
    );
    expect(stringProperty(lifecycleEvent, 'documentId')).toBe(rootId);
  });

  it('rootScopeCannotModifyEmbeddedInterior', () => {
    const blue = new Blue();
    const processor = buildProcessor(blue, new SetPropertyContractProcessor());

    const allowedYaml = `name: Sample Doc
x:
  name: Sample Sub Doc
  contracts:
    life:
      type:
        blueId: LifecycleChannel
    setX:
      channel: life
      event:
        type:
          blueId: DocumentProcessingInitiated
      type:
        blueId: SetProperty
      propertyKey: /a
      propertyValue: 1
contracts:
  rootLife:
    type:
      blueId: LifecycleChannel
  embedded:
    type:
      blueId: ProcessEmbedded
    paths:
      - /x
  setRootY:
    channel: rootLife
    event:
      type:
        blueId: DocumentProcessingInitiated
    type:
      blueId: SetProperty
    propertyKey: /y
    propertyValue: 1
`;

    const allowed = expectOk(processor.initializeDocument(blue.yamlToNode(allowedYaml)));
    expect(numericProperty(allowed.document, 'y')).toBe(1);

    const forbiddenYaml = `${allowedYaml}  setChildInterior:
    order: 1
    channel: rootLife
    event:
      type:
        blueId: DocumentProcessingInitiated
    type:
      blueId: SetProperty
    propertyKey: /x/b
    propertyValue: 1
`;

    const forbidden = expectOk(
      processor.initializeDocument(blue.yamlToNode(forbiddenYaml))
    );
    const terminated = terminatedMarker(forbidden.document, '/');
    expect(terminated).not.toBeNull();
    expect(stringProperty(terminated!, 'cause')).toBe('fatal');
  });

  it('nestedEmbeddedScopesEnforceBoundaries', () => {
    const blue = new Blue();
    const processor = buildProcessor(blue, new SetPropertyContractProcessor());

    const nestedYaml = `name: Nested Doc
x:
  name: X Doc
  y:
    name: Y Doc
    contracts:
      life:
        type:
          blueId: LifecycleChannel
      setY:
        channel: life
        event:
          type:
            blueId: DocumentProcessingInitiated
        type:
          blueId: SetProperty
        propertyKey: /a
        propertyValue: 1
  contracts:
    life:
      type:
        blueId: LifecycleChannel
    embedded:
      type:
        blueId: ProcessEmbedded
      paths:
        - /y
contracts:
  embedded:
    type:
      blueId: ProcessEmbedded
    paths:
      - /x
  life:
    type:
      blueId: LifecycleChannel
`;

    const nested = expectOk(
      processor.initializeDocument(blue.yamlToNode(nestedYaml))
    );
    const initialized = nested.document;

    const xNode = property(initialized, 'x');
    const xContracts = property(xNode, 'contracts');
    expect(xContracts.getProperties()).toHaveProperty('initialized');

    const yNode = property(xNode, 'y');
    const yContracts = property(yNode, 'contracts');
    expect(yContracts.getProperties()).toHaveProperty('initialized');
    expect(numericProperty(yNode, 'a')).toBe(1);

    const originalY = property(property(blue.yamlToNode(nestedYaml), 'x'), 'y');
    expect(propertyOptional(originalY, 'a')).toBeUndefined();

    const rootViolationYaml = `${nestedYaml}  setDeep:
    channel: life
    event:
      type:
        blueId: DocumentProcessingInitiated
    type:
      blueId: SetProperty
    propertyKey: /x/y/a
    propertyValue: 2
`;

    const rootViolation = expectOk(
      processor.initializeDocument(blue.yamlToNode(rootViolationYaml))
    );
    const rootTerminated = terminatedMarker(rootViolation.document, '/');
    expect(rootTerminated).not.toBeNull();
    expect(stringProperty(rootTerminated!, 'cause')).toBe('fatal');

    const parentScopeViolationYaml = `name: Nested Doc
x:
  name: X Doc
  y:
    name: Y Doc
    contracts:
      life:
        type:
          blueId: LifecycleChannel
      setY:
        channel: life
        event:
          type:
            blueId: DocumentProcessingInitiated
        type:
          blueId: SetProperty
        propertyKey: /a
        propertyValue: 1
  contracts:
    life:
      type:
        blueId: LifecycleChannel
    embedded:
      type:
        blueId: ProcessEmbedded
      paths:
        - /y
    setIllegalFromX:
      channel: life
      order: 1
      event:
        type:
          blueId: DocumentProcessingInitiated
      type:
        blueId: SetProperty
      propertyKey: /y/a
      propertyValue: 2
contracts:
  embedded:
    type:
      blueId: ProcessEmbedded
    paths:
      - /x
  life:
    type:
      blueId: LifecycleChannel
`;

    const parentViolation = expectOk(
      processor.initializeDocument(blue.yamlToNode(parentScopeViolationYaml))
    );
    const childTerminated = terminatedMarker(parentViolation.document, '/x');
    expect(childTerminated).not.toBeNull();
    expect(stringProperty(childTerminated!, 'cause')).toBe('fatal');
    expect(terminatedMarker(parentViolation.document, '/')).toBeNull();
  });

  it('embeddedListUpdatesProcessNewChildAfterCurrentScopeFinishes', () => {
    const blue = new Blue();
    const processor = buildProcessor(
      blue,
      new SetPropertyContractProcessor(),
      new MutateEmbeddedPathsContractProcessor()
    );

    const yaml = `name: Sample Doc
a:
  name: Doc A
  contracts:
    life:
      type:
        blueId: LifecycleChannel
    setX:
      channel: life
      event:
        type:
          blueId: DocumentProcessingInitiated
      type:
        blueId: SetProperty
      propertyKey: /x
      propertyValue: 1
b:
  name: Doc B
  contracts:
    life:
      type:
        blueId: LifecycleChannel
    setX:
      channel: life
      event:
        type:
          blueId: DocumentProcessingInitiated
      type:
        blueId: SetProperty
      propertyKey: /x
      propertyValue: 1
c:
  name: Doc C
  contracts:
    life:
      type:
        blueId: LifecycleChannel
    setX:
      channel: life
      event:
        type:
          blueId: DocumentProcessingInitiated
      type:
        blueId: SetProperty
      propertyKey: /x
      propertyValue: 1
contracts:
  embedded:
    type:
      blueId: ProcessEmbedded
    paths:
      - /a
      - /b
  updateA:
    type:
      blueId: DocumentUpdateChannel
    path: /a/x
  handleA:
    channel: updateA
    type:
      blueId: MutateEmbeddedPaths
  updateB:
    type:
      blueId: DocumentUpdateChannel
    path: /b/x
  flagB:
    channel: updateB
    type:
      blueId: SetProperty
    propertyKey: /mustNotHappen
    propertyValue: 1
  updateC:
    type:
      blueId: DocumentUpdateChannel
    path: /c/x
  flagC:
    channel: updateC
    type:
      blueId: SetProperty
    propertyKey: /itShouldHappen
    propertyValue: 1
`;

    const result = expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml))
    );
    const terminated = terminatedMarker(result.document, '/');
    expect(terminated).not.toBeNull();
    expect(stringProperty(terminated!, 'cause')).toBe('fatal');
  });

  it('embeddedListUpdatesProcessNewChildDuringExternalEvent', () => {
    const blue = new Blue();
    const processor = buildProcessor(
      blue,
      new SetPropertyContractProcessor(),
      new MutateEmbeddedPathsContractProcessor(),
      new TestEventChannelProcessor()
    );

    const yaml = `name: Sample Doc
a:
  name: Doc A
  contracts:
    testEvents:
      type:
        blueId: TestEventChannel
    setX:
      channel: testEvents
      type:
        blueId: SetProperty
      propertyKey: /x
      propertyValue: 1
b:
  name: Doc B
  contracts:
    testEvents:
      type:
        blueId: TestEventChannel
    setX:
      channel: testEvents
      type:
        blueId: SetProperty
      propertyKey: /x
      propertyValue: 1
c:
  name: Doc C
  contracts:
    testEvents:
      type:
        blueId: TestEventChannel
    setX:
      channel: testEvents
      type:
        blueId: SetProperty
      propertyKey: /x
      propertyValue: 1
contracts:
  embedded:
    type:
      blueId: ProcessEmbedded
    paths:
      - /a
      - /b
  updateA:
    type:
      blueId: DocumentUpdateChannel
    path: /a/x
  mutatePaths:
    channel: updateA
    type:
      blueId: MutateEmbeddedPaths
  updateB:
    type:
      blueId: DocumentUpdateChannel
    path: /b/x
  flagB:
    channel: updateB
    type:
      blueId: SetProperty
    propertyKey: /mustNotHappen
    propertyValue: 1
  updateC:
    type:
      blueId: DocumentUpdateChannel
    path: /c/x
  flagC:
    channel: updateC
    type:
      blueId: SetProperty
    propertyKey: /itShouldHappen
    propertyValue: 1
`;

    const initResult = expectOk(processor.initializeDocument(blue.yamlToNode(yaml)));
    const initialized = initResult.document;
    const embedded = property(property(initialized, 'contracts'), 'embedded');
    const paths = property(embedded, 'paths');
    const items = paths.getItems() ?? [];
    expect(items).toHaveLength(2);
    expect(items[0]?.getValue()).toBe('/a');
    expect(items[1]?.getValue()).toBe('/b');
    expect(propertyOptional(initialized, 'itShouldHappen')).toBeUndefined();
    expect(propertyOptional(initialized, 'mustNotHappen')).toBeUndefined();

    const event = testEventNode(blue);
    const processResult = expectOk(processor.processDocument(initialized, event));
    const processed = processResult.document;

    const terminated = terminatedMarker(processed, '/');
    expect(terminated).not.toBeNull();
    expect(stringProperty(terminated!, 'cause')).toBe('fatal');
    expect(propertyOptional(processed, 'itShouldHappen')).toBeUndefined();
    expect(propertyOptional(processed, 'mustNotHappen')).toBeUndefined();
  });

  it('removingEmbeddedChildCutsOffFurtherWorkWithinRun', () => {
    const blue = new Blue();
    const processor = buildProcessor(
      blue,
      new TestEventChannelProcessor(),
      new CutOffProbeContractProcessor(),
      new RemoveIfPresentContractProcessor(),
      new SetPropertyOnEventContractProcessor()
    );

    const yaml = `child:
  contracts:
    childChannel:
      type:
        blueId: TestEventChannel
    probe:
      channel: childChannel
      type:
        blueId: CutOffProbe
      emitBefore: true
      preEmitKind: pre
      patchPointer: /marker
      patchValue: 1
      emitAfter: true
      postEmitKind: post
      postPatchPointer: /resurrection
      postPatchValue: 1
contracts:
  embedded:
    type:
      blueId: ProcessEmbedded
    paths:
      - /child
  embeddedBridge:
    type:
      blueId: EmbeddedNodeChannel
    childPath: /child
  bridgePre:
    channel: embeddedBridge
    type:
      blueId: SetPropertyOnEvent
    expectedKind: pre
    propertyKey: /bridged
    propertyValue: 1
  bridgePost:
    channel: embeddedBridge
    type:
      blueId: SetPropertyOnEvent
    expectedKind: post
    propertyKey: /postSeen
    propertyValue: 1
  childUpdates:
    type:
      blueId: DocumentUpdateChannel
    path: /child
  cutChild:
    channel: childUpdates
    type:
      blueId: RemoveIfPresent
    propertyKey: /child
`;

    const initialized = expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml))
    ).document;

    const event = testEventNode(blue, { eventId: 'evt-1' });
    const result = expectOk(processor.processDocument(initialized, event));
    const processed = result.document;

    expect(propertyOptional(processed, 'child')).toBeUndefined();
    expect(propertyOptional(processed, 'postSeen')).toBeUndefined();
    const postEmission = result.triggeredEvents.some(
      (eventNode: BlueNode) => stringProperty(eventNode, 'kind') === 'post'
    );
    expect(postEmission).toBe(false);
  });

  it('rejectsMultipleProcessEmbeddedMarkersWithinScope', () => {
    const blue = new Blue();
    const processor = buildProcessor(blue);

    const yaml = `name: Multi Embedded Doc
x:
  name: X Doc
y:
  name: Y Doc
contracts:
  embeddedPrimary:
    type:
      blueId: ProcessEmbedded
    paths:
      - /x
  embeddedSecondary:
    type:
      blueId: ProcessEmbedded
    paths:
      - /y
`;

    expect(() => processor.initializeDocument(blue.yamlToNode(yaml))).toThrow(
      /Process Embedded/
    );
  });
});
