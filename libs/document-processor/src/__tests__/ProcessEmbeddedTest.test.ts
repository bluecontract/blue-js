import { createBlue } from '../test-support/blue.js';
import { describe, expect, it } from 'vitest';
import type { Blue } from '@blue-labs/language';
import { BlueNode } from '@blue-labs/language';

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
  it('initializesEmbeddedChildDocument', async () => {
    const blue = createBlue();
    const processor = buildProcessor(blue, new SetPropertyContractProcessor());

    const yaml = `name: Sample Doc
x:
  name: Sample Sub Doc
  contracts:
    life:
      type: Core/Lifecycle Event Channel
    setX:
      channel: life
      event:
        type: Core/Document Processing Initiated
      type:
        blueId: SetProperty
      propertyKey: /a
      propertyValue: 1
contracts:
  embedded:
    type: Core/Process Embedded
    paths:
      - /x
`;

    const original = blue.yamlToNode(yaml);
    const rootId = blue.calculateBlueIdSync(original.clone());
    const originalChild = property(original, 'x');
    const childId = blue.calculateBlueIdSync(originalChild.clone());

    const result = await expectOk(processor.initializeDocument(original));
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
      'Core/Document Processing Initiated',
    );
    expect(stringProperty(lifecycleEvent, 'documentId')).toBe(rootId);
  });

  it('rootScopeCannotModifyEmbeddedInterior', async () => {
    const blue = createBlue();
    const processor = buildProcessor(blue, new SetPropertyContractProcessor());

    const allowedYaml = `name: Sample Doc
x:
  name: Sample Sub Doc
  contracts:
    life:
      type: Core/Lifecycle Event Channel
    setX:
      channel: life
      event:
        type: Core/Document Processing Initiated
      type:
        blueId: SetProperty
      propertyKey: /a
      propertyValue: 1
contracts:
  rootLife:
    type: Core/Lifecycle Event Channel
  embedded:
    type: Core/Process Embedded
    paths:
      - /x
  setRootY:
    channel: rootLife
    event:
      type: Core/Document Processing Initiated
    type:
      blueId: SetProperty
    propertyKey: /y
    propertyValue: 1
`;

    const allowed = await expectOk(
      processor.initializeDocument(blue.yamlToNode(allowedYaml)),
    );
    expect(numericProperty(allowed.document, 'y')).toBe(1);

    const forbiddenYaml = `${allowedYaml}  setChildInterior:
    order: 1
    channel: rootLife
    event:
      type: Core/Document Processing Initiated
    type:
      blueId: SetProperty
    propertyKey: /x/b
    propertyValue: 1
`;

    const forbidden = await expectOk(
      processor.initializeDocument(blue.yamlToNode(forbiddenYaml)),
    );
    const terminated = terminatedMarker(forbidden.document, '/');
    expect(terminated).not.toBeNull();
    expect(stringProperty(terminated!, 'cause')).toBe('fatal');
  });

  it('nestedEmbeddedScopesEnforceBoundaries', async () => {
    const blue = createBlue();
    const processor = buildProcessor(blue, new SetPropertyContractProcessor());

    const nestedYaml = `name: Nested Doc
x:
  name: X Doc
  y:
    name: Y Doc
    contracts:
      life:
        type: Core/Lifecycle Event Channel
      setY:
        channel: life
        event:
          type: Core/Document Processing Initiated
        type:
          blueId: SetProperty
        propertyKey: /a
        propertyValue: 1
  contracts:
    life:
      type: Core/Lifecycle Event Channel
    embedded:
      type: Core/Process Embedded
      paths:
        - /y
contracts:
  embedded:
    type: Core/Process Embedded
    paths:
      - /x
  life:
    type: Core/Lifecycle Event Channel
`;

    const nested = await expectOk(
      processor.initializeDocument(blue.yamlToNode(nestedYaml)),
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
      type: Core/Document Processing Initiated
    type:
      blueId: SetProperty
    propertyKey: /x/y/a
    propertyValue: 2
`;

    const rootViolation = await expectOk(
      processor.initializeDocument(blue.yamlToNode(rootViolationYaml)),
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
        type: Core/Lifecycle Event Channel
      setY:
        channel: life
        event:
          type: Core/Document Processing Initiated
        type:
          blueId: SetProperty
        propertyKey: /a
        propertyValue: 1
  contracts:
    life:
      type: Core/Lifecycle Event Channel
    embedded:
      type: Core/Process Embedded
      paths:
        - /y
    setIllegalFromX:
      channel: life
      order: 1
      event:
        type: Core/Document Processing Initiated
      type:
        blueId: SetProperty
      propertyKey: /y/a
      propertyValue: 2
contracts:
  embedded:
    type: Core/Process Embedded
    paths:
      - /x
  life:
    type: Core/Lifecycle Event Channel
`;

    const parentViolation = await expectOk(
      processor.initializeDocument(blue.yamlToNode(parentScopeViolationYaml)),
    );
    const childTerminated = terminatedMarker(parentViolation.document, '/x');
    expect(childTerminated).not.toBeNull();
    expect(stringProperty(childTerminated!, 'cause')).toBe('fatal');
    expect(terminatedMarker(parentViolation.document, '/')).toBeNull();
  });

  it('embeddedListUpdatesProcessNewChildAfterCurrentScopeFinishes', async () => {
    const blue = createBlue();
    const processor = buildProcessor(
      blue,
      new SetPropertyContractProcessor(),
      new MutateEmbeddedPathsContractProcessor(),
    );

    const yaml = `name: Sample Doc
a:
  name: Doc A
  contracts:
    life:
      type: Core/Lifecycle Event Channel
    setX:
      channel: life
      event:
        type: Core/Document Processing Initiated
      type:
        blueId: SetProperty
      propertyKey: /x
      propertyValue: 1
b:
  name: Doc B
  contracts:
    life:
      type: Core/Lifecycle Event Channel
    setX:
      channel: life
      event:
        type: Core/Document Processing Initiated
      type:
        blueId: SetProperty
      propertyKey: /x
      propertyValue: 1
c:
  name: Doc C
  contracts:
    life:
      type: Core/Lifecycle Event Channel
    setX:
      channel: life
      event:
        type: Core/Document Processing Initiated
      type:
        blueId: SetProperty
      propertyKey: /x
      propertyValue: 1
contracts:
  embedded:
    type: Core/Process Embedded
    paths:
      - /a
      - /b
  updateA:
    type: Core/Document Update Channel
    path: /a/x
  handleA:
    channel: updateA
    type:
      blueId: MutateEmbeddedPaths
  updateB:
    type: Core/Document Update Channel
    path: /b/x
  flagB:
    channel: updateB
    type:
      blueId: SetProperty
    propertyKey: /mustNotHappen
    propertyValue: 1
  updateC:
    type: Core/Document Update Channel
    path: /c/x
  flagC:
    channel: updateC
    type:
      blueId: SetProperty
    propertyKey: /itShouldHappen
    propertyValue: 1
`;

    const result = await expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    );
    const terminated = terminatedMarker(result.document, '/');
    expect(terminated).not.toBeNull();
    expect(stringProperty(terminated!, 'cause')).toBe('fatal');
  });

  it('embeddedListUpdatesProcessNewChildDuringExternalEvent', async () => {
    const blue = createBlue();
    const processor = buildProcessor(
      blue,
      new SetPropertyContractProcessor(),
      new MutateEmbeddedPathsContractProcessor(),
      new TestEventChannelProcessor(),
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
    type: Core/Process Embedded
    paths:
      - /a
      - /b
  updateA:
    type: Core/Document Update Channel
    path: /a/x
  mutatePaths:
    channel: updateA
    type:
      blueId: MutateEmbeddedPaths
  updateB:
    type: Core/Document Update Channel
    path: /b/x
  flagB:
    channel: updateB
    type:
      blueId: SetProperty
    propertyKey: /mustNotHappen
    propertyValue: 1
  updateC:
    type: Core/Document Update Channel
    path: /c/x
  flagC:
    channel: updateC
    type:
      blueId: SetProperty
    propertyKey: /itShouldHappen
    propertyValue: 1
`;

    const initResult = await expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    );
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
    const processResult = await expectOk(
      processor.processDocument(initialized, event),
    );
    const processed = processResult.document;

    const terminated = terminatedMarker(processed, '/');
    expect(terminated).not.toBeNull();
    expect(stringProperty(terminated!, 'cause')).toBe('fatal');
    expect(propertyOptional(processed, 'itShouldHappen')).toBeUndefined();
    expect(propertyOptional(processed, 'mustNotHappen')).toBeUndefined();
  });

  it('removingEmbeddedChildCutsOffFurtherWorkWithinRun', async () => {
    const blue = createBlue();
    const processor = buildProcessor(
      blue,
      new TestEventChannelProcessor(),
      new CutOffProbeContractProcessor(),
      new RemoveIfPresentContractProcessor(),
      new SetPropertyOnEventContractProcessor(),
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
    type: Core/Process Embedded
    paths:
      - /child
  embeddedBridge:
    type: Core/Embedded Node Channel
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
    type: Core/Document Update Channel
    path: /child
  cutChild:
    channel: childUpdates
    type:
      blueId: RemoveIfPresent
    propertyKey: /child
`;

    const initialized = (
      await expectOk(processor.initializeDocument(blue.yamlToNode(yaml)))
    ).document;

    const event = testEventNode(blue, { eventId: 'evt-1' });
    const result = await expectOk(
      processor.processDocument(initialized, event),
    );
    const processed = result.document;

    expect(propertyOptional(processed, 'child')).toBeUndefined();
    expect(propertyOptional(processed, 'postSeen')).toBeUndefined();
    const postEmission = result.triggeredEvents.some(
      (eventNode: BlueNode) => stringProperty(eventNode, 'kind') === 'post',
    );
    expect(postEmission).toBe(false);
  });

  it('rejectsMultipleProcessEmbeddedMarkersWithinScope', async () => {
    const blue = createBlue();
    const processor = buildProcessor(blue);

    const yaml = `name: Multi Embedded Doc
x:
  name: X Doc
y:
  name: Y Doc
contracts:
  embeddedPrimary:
    type: Core/Process Embedded
    paths:
      - /x
  embeddedSecondary:
    type: Core/Process Embedded
    paths:
      - /y
`;

    await expect(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    ).rejects.toThrow(/Process Embedded/);
  });
});
