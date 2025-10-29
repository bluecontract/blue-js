import { createBlue } from '../test-support/blue.js';
import { describe, it, expect } from 'vitest';

import {
  AssertDocumentUpdateContractProcessor,
  IncrementPropertyContractProcessor,
  SetPropertyContractProcessor,
} from './processors/index.js';
import {
  buildProcessor,
  expectOk,
  property,
  propertyOptional,
} from './test-utils.js';

const blue = createBlue();

describe('DocumentUpdateChannelTest', () => {
  it('initializationTriggersDocumentUpdateHandlers', () => {
    const processor = buildProcessor(blue, new SetPropertyContractProcessor());
    const yaml = `name: Sample Doc
contracts:
  lifecycleChannel:
    type: Lifecycle Event Channel
  documentUpdateChannelX:
    type: Document Update Channel
    path: /x
  documentUpdateChannelY:
    type: Document Update Channel
    path: /y
  setX:
    channel: lifecycleChannel
    type:
      blueId: SetProperty
    event:
      type: Document Processing Initiated
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
      processor.initializeDocument(blue.yamlToNode(yaml)),
    ).document;

    expect(Number(property(processed, 'x').getValue())).toBe(1);
    expect(Number(property(processed, 'y').getValue())).toBe(1);
    expect(Number(property(processed, 'z').getValue())).toBe(1);
  });

  it('nestedUpdatesPropagateToParentWatchers', () => {
    const processor = buildProcessor(
      blue,
      new SetPropertyContractProcessor(),
      new IncrementPropertyContractProcessor(),
    );
    const yaml = `name: Nested Doc
contracts:
  lifecycleChannel:
    type: Lifecycle Event Channel
  documentUpdateA:
    type: Document Update Channel
    path: /a
  setAX:
    channel: lifecycleChannel
    type:
      blueId: SetProperty
    event:
      type: Document Processing Initiated
    propertyKey: /a/x
    propertyValue: 1
  setABX:
    channel: lifecycleChannel
    order: 1
    type:
      blueId: SetProperty
    event:
      type: Document Processing Initiated
    propertyKey: /a/b/x
    propertyValue: 1
  incrementYOnA:
    channel: documentUpdateA
    type:
      blueId: IncrementProperty
    propertyKey: /y
`;

    const processed = expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    ).document;

    const a = property(processed, 'a');
    expect(Number(property(a, 'x').getValue())).toBe(1);
    const b = property(a, 'b');
    expect(Number(property(b, 'x').getValue())).toBe(1);
    expect(Number(property(processed, 'y').getValue())).toBe(2);
  });

  it('cascadedUpdatesPropagateThroughEmbeddedScopes', () => {
    const processor = buildProcessor(blue, new SetPropertyContractProcessor());
    const yaml = `name: Cascading Doc
x:
  name: Embedded X
  y:
    name: Embedded Y
    contracts:
      life:
        type: Lifecycle Event Channel
      setInner:
        channel: life
        event:
          type: Document Processing Initiated
        type:
          blueId: SetProperty
        propertyKey: /a
        propertyValue: 1
  contracts:
    embedded:
      type: Process Embedded
      paths:
        - /y
    documentUpdateFromY:
      type: Document Update Channel
      path: /y/a
    setFromY:
      channel: documentUpdateFromY
      type:
        blueId: SetProperty
      propertyKey: /a
      propertyValue: 1
contracts:
  embedded:
    type: Process Embedded
    paths:
      - /x
  documentUpdateFromChild:
    type: Document Update Channel
    path: /x/y/a
  setFromChild:
    channel: documentUpdateFromChild
    type:
      blueId: SetProperty
    propertyKey: /a
    propertyValue: 1
`;

    const processed = expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
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
      new AssertDocumentUpdateContractProcessor(),
    );
    const yaml = `name: Update Doc
a:
  contracts:
    life:
      type: Lifecycle Event Channel
    setX:
      channel: life
      type:
        blueId: SetProperty
      event:
        type: Document Processing Initiated
      propertyKey: /x
      propertyValue: 1
    watchX:
      type: Document Update Channel
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
    type: Process Embedded
    paths:
      - /a
  watchRoot:
    type: Document Update Channel
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
      processor.initializeDocument(blue.yamlToNode(yaml)),
    ).document;
    const a = property(processed, 'a');
    expect(Number(property(a, 'x').getValue())).toBe(1);
  });

  it('document update events preserve append pointer token', () => {
    const processor = buildProcessor(
      blue,
      new SetPropertyContractProcessor(),
      new AssertDocumentUpdateContractProcessor(),
    );
    const yaml = `name: Append Doc
list: []
contracts:
  lifecycle:
    type: Lifecycle Event Channel
  watchList:
    type: Document Update Channel
    path: /list
  appendItem:
    channel: lifecycle
    type:
      blueId: SetProperty
    event:
      type: Document Processing Initiated
    path: /list
    propertyKey: "-"
    propertyValue: 5
  assertAppend:
    channel: watchList
    type:
      blueId: AssertDocumentUpdate
    expectedPath: /list/-
    expectedOp: add
    expectBeforeNull: true
    expectedAfterValue: 5
`;

    const result = expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    );
    const list = property(result.document, 'list');
    expect(list.getItems()).toHaveLength(1);
    expect(Number(list.getItems()?.[0]?.getValue())).toBe(5);
  });
});
