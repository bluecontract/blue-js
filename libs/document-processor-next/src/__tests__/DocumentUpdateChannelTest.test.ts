import { describe, it, expect } from 'vitest';
import { Blue } from '@blue-labs/language';

import {
  AssertDocumentUpdateContractProcessor,
  IncrementPropertyContractProcessor,
  SetPropertyContractProcessor,
} from './processors/index.js';
import { buildProcessor, expectOk, property, propertyOptional } from './test-utils.js';

const blue = new Blue();

describe('DocumentUpdateChannelTest', () => {
  it('initializationTriggersDocumentUpdateHandlers', () => {
    const processor = buildProcessor(
      blue,
      new SetPropertyContractProcessor()
    );
    const yaml = `name: Sample Doc
contracts:
  lifecycleChannel:
    type:
      blueId: LifecycleChannel
  documentUpdateChannelX:
    type:
      blueId: DocumentUpdateChannel
    path: /x
  documentUpdateChannelY:
    type:
      blueId: DocumentUpdateChannel
    path: /y
  setX:
    channel: lifecycleChannel
    type:
      blueId: SetProperty
    event:
      type:
        blueId: DocumentProcessingInitiated
    propertyKey: /x
    propertyValue: 1
  setY:
    channel: documentUpdateChannelX
    type:
      blueId: SetProperty
    propertyKey: /y
    propertyValue: 1
  setZ:
    channel: documentUpdateChannelY
    type:
      blueId: SetProperty
    propertyKey: /z
    propertyValue: 1
`;

    const processed = expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml))
    ).document;

    expect(Number(property(processed, 'x').getValue())).toBe(1);
    expect(Number(property(processed, 'y').getValue())).toBe(1);
    expect(Number(property(processed, 'z').getValue())).toBe(1);
  });

  it('nestedUpdatesPropagateToParentWatchers', () => {
    const processor = buildProcessor(
      blue,
      new SetPropertyContractProcessor(),
      new IncrementPropertyContractProcessor()
    );
    const yaml = `name: Nested Doc
contracts:
  lifecycleChannel:
    type:
      blueId: LifecycleChannel
  documentUpdateA:
    type:
      blueId: DocumentUpdateChannel
    path: /a
  setAX:
    channel: lifecycleChannel
    type:
      blueId: SetProperty
    event:
      type:
        blueId: DocumentProcessingInitiated
    propertyKey: /a/x
    propertyValue: 1
  setABX:
    channel: lifecycleChannel
    order: 1
    type:
      blueId: SetProperty
    event:
      type:
        blueId: DocumentProcessingInitiated
    propertyKey: /a/b/x
    propertyValue: 1
  incrementYOnA:
    channel: documentUpdateA
    type:
      blueId: IncrementProperty
    propertyKey: /y
`;

    const processed = expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml))
    ).document;

    const a = property(processed, 'a');
    expect(Number(property(a, 'x').getValue())).toBe(1);
    const b = property(a, 'b');
    expect(Number(property(b, 'x').getValue())).toBe(1);
    expect(Number(property(processed, 'y').getValue())).toBe(2);
  });

  it('cascadedUpdatesPropagateThroughEmbeddedScopes', () => {
    const processor = buildProcessor(
      blue,
      new SetPropertyContractProcessor()
    );
    const yaml = `name: Cascading Doc
x:
  name: Embedded X
  y:
    name: Embedded Y
    contracts:
      life:
        type:
          blueId: LifecycleChannel
      setInner:
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
        - /y
    documentUpdateFromY:
      type:
        blueId: DocumentUpdateChannel
      path: /y/a
    setFromY:
      channel: documentUpdateFromY
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
  documentUpdateFromChild:
    type:
      blueId: DocumentUpdateChannel
    path: /x/y/a
  setFromChild:
    channel: documentUpdateFromChild
    type:
      blueId: SetProperty
    propertyKey: /a
    propertyValue: 1
`;

    const processed = expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml))
    ).document;

    expect(Number(property(processed, 'a').getValue())).toBe(1);
    const xNode = property(processed, 'x');
    expect(Number(property(xNode, 'a').getValue())).toBe(1);
    const yNode = property(xNode, 'y');
    expect(Number(property(yNode, 'a').getValue())).toBe(1);

    const original = blue.yamlToNode(yaml);
    expect(propertyOptional(original, 'a')).toBeUndefined();
    const originalX = property(original, 'x');
    expect(propertyOptional(originalX, 'a')).toBeUndefined();
    const originalY = property(originalX, 'y');
    expect(propertyOptional(originalY, 'a')).toBeUndefined();
  });

  it('documentUpdateEventExposesRelativePathAndSnapshots', () => {
    const processor = buildProcessor(
      blue,
      new SetPropertyContractProcessor(),
      new AssertDocumentUpdateContractProcessor()
    );
    const yaml = `name: Update Doc
a:
  contracts:
    life:
      type:
        blueId: LifecycleChannel
    setX:
      channel: life
      type:
        blueId: SetProperty
      event:
        type:
          blueId: DocumentProcessingInitiated
      propertyKey: /x
      propertyValue: 1
    watchX:
      type:
        blueId: DocumentUpdateChannel
      path: /x
    assertA:
      channel: watchX
      type:
        blueId: AssertDocumentUpdate
      expectedPath: /x
      expectedOp: add
      expectBeforeNull: true
      expectedAfterValue: 1
contracts:
  embedded:
    type:
      blueId: ProcessEmbedded
    paths:
      - /a
  watchRoot:
    type:
      blueId: DocumentUpdateChannel
    path: /a/x
  assertRoot:
    channel: watchRoot
    type:
      blueId: AssertDocumentUpdate
    expectedPath: /a/x
    expectedOp: add
    expectBeforeNull: true
    expectedAfterValue: 1
`;

    const processed = expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml))
    ).document;
    const a = property(processed, 'a');
    expect(Number(property(a, 'x').getValue())).toBe(1);
  });
});
