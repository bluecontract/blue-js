import { describe, expect, it } from 'vitest';

import { createBlue } from '../../../test-support/blue.js';
import {
  buildProcessor,
  expectOk,
  numericValue,
  property,
  stringProperty,
} from '../../test-utils.js';

const blue = createBlue();

describe('Document Update Channel — Deep embedded propagation', () => {
  it('routes document update events through sequential workflows in nested scopes', async () => {
    const processor = buildProcessor(blue);
    const yaml = `name: Deep Embedded Doc
observed: 0
lastPath: none
lastOp: none
branch:
  observed: 0
  lastPath: none
  lastOp: none
  sub:
    observed: 0
    lastPath: none
    lastOp: none
    leaf:
      observed: 0
      lastPath: none
      lastOp: none
      contracts:
        life:
          type: Core/Lifecycle Event Channel
        initializeLeaf:
          type: Conversation/Sequential Workflow
          channel: life
          event:
            type: Core/Document Processing Initiated
          steps:
            - name: SeedLeaf
              type: Conversation/Update Document
              changeset:
                - op: REPLACE
                  path: /value
                  val: 1
        leafUpdates:
          type: Core/Document Update Channel
          path: /value
        leafWatcher:
          type: Conversation/Sequential Workflow
          channel: leafUpdates
          steps:
            - name: IncrementLeaf
              type: Conversation/Update Document
              changeset:
                - op: REPLACE
                  path: /observed
                  val: "\${(document('observed') ?? 0) + 1}"
            - name: RecordLeafPath
              type: Conversation/Update Document
              changeset:
                - op: REPLACE
                  path: /lastPath
                  val: "\${event.path}"
            - name: RecordLeafOp
              type: Conversation/Update Document
              changeset:
                - op: REPLACE
                  path: /lastOp
                  val: "\${event.op}"
    contracts:
      embedded:
        type: Core/Process Embedded
        paths:
          - /leaf
      subLeafUpdates:
        type: Core/Document Update Channel
        path: /leaf/value
      subWatcher:
        type: Conversation/Sequential Workflow
        channel: subLeafUpdates
        steps:
          - name: IncrementSub
            type: Conversation/Update Document
            changeset:
              - op: REPLACE
                path: /observed
                val: "\${(document('observed') ?? 0) + 1}"
          - name: RecordSubPath
            type: Conversation/Update Document
            changeset:
              - op: REPLACE
                path: /lastPath
                val: "\${event.path}"
          - name: RecordSubOp
            type: Conversation/Update Document
            changeset:
              - op: REPLACE
                path: /lastOp
                val: "\${event.op}"
  contracts:
    embedded:
      type: Core/Process Embedded
      paths:
        - /sub
    branchLeafUpdates:
      type: Core/Document Update Channel
      path: /sub/leaf/value
    branchWatcher:
      type: Conversation/Sequential Workflow
      channel: branchLeafUpdates
      steps:
        - name: IncrementBranch
          type: Conversation/Update Document
          changeset:
            - op: REPLACE
              path: /observed
              val: "\${(document('observed') ?? 0) + 1}"
        - name: RecordBranchPath
          type: Conversation/Update Document
          changeset:
            - op: REPLACE
              path: /lastPath
              val: "\${event.path}"
        - name: RecordBranchOp
          type: Conversation/Update Document
          changeset:
            - op: REPLACE
              path: /lastOp
              val: "\${event.op}"
contracts:
  embedded:
    type: Core/Process Embedded
    paths:
      - /branch
  rootLeafUpdates:
    type: Core/Document Update Channel
    path: /branch/sub/leaf/value
  rootWatcher:
    type: Conversation/Sequential Workflow
    channel: rootLeafUpdates
    steps:
      - name: IncrementRoot
        type: Conversation/Update Document
        changeset:
          - op: REPLACE
            path: /observed
            val: "\${(document('observed') ?? 0) + 1}"
      - name: RecordRootPath
        type: Conversation/Update Document
        changeset:
          - op: REPLACE
            path: /lastPath
            val: "\${event.path}"
      - name: RecordRootOp
        type: Conversation/Update Document
        changeset:
          - op: REPLACE
            path: /lastOp
            val: "\${event.op}"
`;

    const initResult = await expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    );

    expect(initResult.triggeredEvents).toHaveLength(1);
    const initEvent = initResult.triggeredEvents[0]!;
    expect(stringProperty(initEvent, 'type')).toBe(
      'Document Processing Initiated',
    );
    expect(stringProperty(initEvent, 'documentId')).not.toBeNull();

    const document = initResult.document;
    expect(numericValue(property(document, 'observed'))).toBe(1);
    expect(stringProperty(document, 'lastPath')).toBe('/branch/sub/leaf/value');
    expect(stringProperty(document, 'lastOp')).toBe('replace');

    const branch = property(document, 'branch');
    expect(numericValue(property(branch, 'observed'))).toBe(1);
    expect(stringProperty(branch, 'lastPath')).toBe('/sub/leaf/value');
    expect(stringProperty(branch, 'lastOp')).toBe('replace');

    const sub = property(branch, 'sub');
    expect(numericValue(property(sub, 'observed'))).toBe(1);
    expect(stringProperty(sub, 'lastPath')).toBe('/leaf/value');
    expect(stringProperty(sub, 'lastOp')).toBe('replace');

    const leaf = property(sub, 'leaf');
    expect(numericValue(property(leaf, 'observed'))).toBe(1);
    expect(numericValue(property(leaf, 'value'))).toBe(1);
    expect(stringProperty(leaf, 'lastPath')).toBe('/value');
    expect(stringProperty(leaf, 'lastOp')).toBe('replace');
  });
});
