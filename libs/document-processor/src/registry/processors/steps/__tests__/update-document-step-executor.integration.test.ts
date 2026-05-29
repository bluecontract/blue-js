import { describe, expect, it } from 'vitest';

import { createBlue } from '../../../../test-support/blue.js';
import { buildProcessor, expectOk } from '../../../../__tests__/test-utils.js';

const blue = createBlue();

describe('UpdateDocumentStepExecutor (integration)', () => {
  it('applies document mutations during initialization workflows', async () => {
    const processor = buildProcessor(blue);
    const yaml = `name: Update Document Workflow
contracts:
  life:
    type: Lifecycle Event Channel
  handler:
    type: Conversation/Sequential Workflow
    channel: life
    event:
      type: Document Processing Initiated
    steps:
      - name: SeedStatus
        type: Conversation/Update Document
        changeset:
          - op: ADD
            path: /status
            val: created
`;

    const doc = blue.yamlToNode(yaml);
    const result = await expectOk(processor.initializeDocument(doc));

    const snapshot = blue.nodeToJson(result.document, 'simple') as {
      status?: string;
    };
    expect(snapshot.status).toBe('created');
  });

  it('uses previous step results and document() bindings', async () => {
    const processor = buildProcessor(blue);
    const yaml = `name: Update Counter Workflow
counter: 5
contracts:
  life:
    type: Lifecycle Event Channel
  handler:
    type: Conversation/Sequential Workflow
    channel: life
    event:
      type: Document Processing Initiated
    steps:
      - name: Compute
        type: Conversation/Compute
        expr:
          increment: 4
      - name: Apply
        type: Conversation/Update Document
        changeset:
          - op: REPLACE
            path: /counter
            val:
              $add:
                - $document: /counter
                - $steps: Compute.increment
`;

    const doc = blue.yamlToNode(yaml);
    const result = await expectOk(processor.initializeDocument(doc));

    const snapshot = blue.nodeToJson(result.document, 'simple') as {
      counter?: number;
    };
    expect(snapshot.counter).toBe(9);
  });

  it('supports changesets that produce multiple patches', async () => {
    const processor = buildProcessor(blue);
    const yaml = `name: Update History Workflow
history: []
contracts:
  life:
    type: Lifecycle Event Channel
  handler:
    type: Conversation/Sequential Workflow
    channel: life
    event:
      type: Document Processing Initiated
    steps:
      - name: Apply
        type: Conversation/Update Document
        changeset:
          - op: REPLACE
            path: /status
            val: ready
          - op: ADD
            path: /history/-
            val: booted
`;

    const doc = blue.yamlToNode(yaml);
    const result = await expectOk(processor.initializeDocument(doc));

    const snapshot = blue.nodeToJson(result.document, 'simple') as {
      status?: string;
      history?: unknown[];
    };
    expect(snapshot.status).toBe('ready');
    expect(snapshot.history).toEqual(['booted']);
  });

  it('applies changesets returned from a Compute step result', async () => {
    const processor = buildProcessor(blue);
    const yaml = `name: Test Changeset Step Output
contracts:
  lifecycle:
    type: Lifecycle Event Channel
  handler:
    type: Conversation/Sequential Workflow
    channel: lifecycle
    event:
      type: Document Processing Initiated
    steps:
      - name: Prepare
        type: Conversation/Compute
        do:
          - $appendChange:
              op: add
              path: /test
              val: test
          - $appendChange:
              op: add
              path: /test2
              val: test2
      - name: Apply
        type: Conversation/Update Document
        changeset:
          $steps: Prepare.changeset
`;

    const doc = blue.yamlToNode(yaml);
    const resolvedDoc = blue.resolve(doc);
    const result = await expectOk(processor.initializeDocument(resolvedDoc));

    const snapshot = blue.nodeToJson(result.document, 'simple') as {
      test?: string;
      test2?: string;
    };

    expect(snapshot.test).toBe('test');
    expect(snapshot.test2).toBe('test2');
  });
});
