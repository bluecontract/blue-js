import { describe, expect, it } from 'vitest';

import { createBlue } from '../../../test-support/blue.js';
import {
  buildProcessor,
  expectOk,
  numericValue,
  property,
  stringProperty,
  terminatedMarker,
  makeTimelineEntry,
} from '../../test-utils.js';

const blue = createBlue();

describe('Embedded — Cross-triggering via document update channels', () => {
  it('propagates nested updates through document update channels without breaching embedded boundaries', async () => {
    const processor = buildProcessor(blue);
    const yaml = `name: Cross Trigger Doc
rootCounter: 0
rootLastPath: "none"
groupA:
  counter: 0
  lastTriggered: "none"
  subA:
    score: 2
    lastEvent: "none"
    contracts:
      subTimeline:
        type: Conversation/Timeline Channel
        timelineId: sub-a
      subWorkflow:
        type: Conversation/Sequential Workflow
        channel: subTimeline
        steps:
          - name: IncrementScore
            type: Conversation/Update Document
            changeset:
              - op: REPLACE
                path: /score
                val: "\${document('score') + 2}"
          - name: RecordHandled
            type: Conversation/Update Document
            changeset:
              - op: REPLACE
                path: /lastEvent
                val: handled
  contracts:
    embeddedSubA:
      type: Core/Process Embedded
      paths:
        - /subA
    subAScoreUpdates:
      type: Core/Document Update Channel
      path: /subA/score
    onSubAScoreUpdate:
      type: Conversation/Sequential Workflow
      channel: subAScoreUpdates
      steps:
        - name: IncrementGroupCounter
          type: Conversation/Update Document
          changeset:
            - op: REPLACE
              path: /counter
              val: "\${(document('counter') ?? 0) + 1}"
        - name: RecordGroupPath
          type: Conversation/Update Document
          changeset:
            - op: REPLACE
              path: /lastTriggered
              val: "\${event.path}"
groupB:
  totalUpdates: 0
  lastFromNested: "none"
  nestedB:
    x: 1
    y: 0
    yChanges: 0
    contracts:
      nestedTimeline:
        type: Conversation/Timeline Channel
        timelineId: nested-b
      nestedWorkflow:
        type: Conversation/Sequential Workflow
        channel: nestedTimeline
        steps:
          - name: IncrementX
            type: Conversation/Update Document
            changeset:
              - op: REPLACE
                path: /x
                val: "\${document('x') + 1}"
          - name: AdjustY
            type: Conversation/Update Document
            changeset:
              - op: REPLACE
                path: /y
                val: "\${document('y') + document('x')}"
      nestedYUpdates:
        type: Core/Document Update Channel
        path: /y
      onNestedYUpdate:
        type: Conversation/Sequential Workflow
        channel: nestedYUpdates
        steps:
          - name: CountYChanges
            type: Conversation/Update Document
            changeset:
              - op: REPLACE
                path: /yChanges
                val: "\${(document('yChanges') ?? 0) + 1}"
  contracts:
    embeddedNestedB:
      type: Core/Process Embedded
      paths:
        - /nestedB
    nestedBXUpdates:
      type: Core/Document Update Channel
      path: /nestedB/x
    onNestedBXUpdate:
      type: Conversation/Sequential Workflow
      channel: nestedBXUpdates
      steps:
        - name: IncrementTotalUpdates
          type: Conversation/Update Document
          changeset:
            - op: REPLACE
              path: /totalUpdates
              val: "\${(document('totalUpdates') ?? 0) + 1}"
        - name: RecordNestedPath
          type: Conversation/Update Document
          changeset:
            - op: REPLACE
              path: /lastFromNested
              val: "\${event.path}"
contracts:
  embedded:
    type: Core/Process Embedded
    paths:
      - /groupA
      - /groupB
  rootNestedBXUpdates:
    type: Core/Document Update Channel
    path: /groupB/nestedB/x
  onRootNestedBXUpdate:
    type: Conversation/Sequential Workflow
    channel: rootNestedBXUpdates
    steps:
      - name: IncrementRootCounter
        type: Conversation/Update Document
        changeset:
          - op: REPLACE
            path: /rootCounter
            val: "\${(document('rootCounter') ?? 0) + 1}"
      - name: RecordRootPath
        type: Conversation/Update Document
        changeset:
          - op: REPLACE
            path: /rootLastPath
            val: "\${event.path}"
`;

    const initResult = await expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    );
    const initialized = initResult.document;

    expect(numericValue(property(initialized, 'rootCounter'))).toBe(0);
    expect(stringProperty(initialized, 'rootLastPath')).toBe('none');

    const initialGroupA = property(initialized, 'groupA');
    expect(numericValue(property(initialGroupA, 'counter'))).toBe(0);
    expect(stringProperty(initialGroupA, 'lastTriggered')).toBe('none');

    const initialGroupB = property(initialized, 'groupB');
    expect(numericValue(property(initialGroupB, 'totalUpdates'))).toBe(0);
    expect(stringProperty(initialGroupB, 'lastFromNested')).toBe('none');
    const initialNestedB = property(initialGroupB, 'nestedB');
    expect(numericValue(property(initialNestedB, 'x'))).toBe(1);
    expect(numericValue(property(initialNestedB, 'y'))).toBe(0);
    expect(numericValue(property(initialNestedB, 'yChanges'))).toBe(0);

    const subAEvent = makeTimelineEntry(blue, 'sub-a', 'update group A');
    const afterGroupA = await expectOk(
      processor.processDocument(initialized, subAEvent),
    );

    const groupAAfter = property(afterGroupA.document, 'groupA');
    expect(numericValue(property(groupAAfter, 'counter'))).toBe(1);
    expect(stringProperty(groupAAfter, 'lastTriggered')).toBe('/subA/score');
    const subAAfter = property(groupAAfter, 'subA');
    expect(numericValue(property(subAAfter, 'score'))).toBe(4);
    expect(stringProperty(subAAfter, 'lastEvent')).toBe('handled');

    expect(numericValue(property(afterGroupA.document, 'rootCounter'))).toBe(0);
    expect(stringProperty(afterGroupA.document, 'rootLastPath')).toBe('none');

    const nestedBEvent = makeTimelineEntry(blue, 'nested-b', 'update group B');
    const afterNestedB = await expectOk(
      processor.processDocument(afterGroupA.document, nestedBEvent),
    );
    const finalDocument = afterNestedB.document;

    expect(numericValue(property(finalDocument, 'rootCounter'))).toBe(1);
    expect(stringProperty(finalDocument, 'rootLastPath')).toBe(
      '/groupB/nestedB/x',
    );

    const groupAUnchanged = property(finalDocument, 'groupA');
    expect(numericValue(property(groupAUnchanged, 'counter'))).toBe(1);
    expect(stringProperty(groupAUnchanged, 'lastTriggered')).toBe(
      '/subA/score',
    );

    const groupBFinal = property(finalDocument, 'groupB');
    expect(numericValue(property(groupBFinal, 'totalUpdates'))).toBe(1);
    expect(stringProperty(groupBFinal, 'lastFromNested')).toBe('/nestedB/x');

    const nestedBFinal = property(groupBFinal, 'nestedB');
    expect(numericValue(property(nestedBFinal, 'x'))).toBe(2);
    expect(numericValue(property(nestedBFinal, 'y'))).toBe(2);
    expect(numericValue(property(nestedBFinal, 'yChanges'))).toBe(1);

    expect(terminatedMarker(finalDocument, '/')).toBeNull();
    expect(terminatedMarker(finalDocument, '/groupA')).toBeNull();
    expect(terminatedMarker(finalDocument, '/groupB')).toBeNull();
  });
});
