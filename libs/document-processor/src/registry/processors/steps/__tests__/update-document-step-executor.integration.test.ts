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
    type: Sequential Workflow
    channel: life
    event:
      type: Document Processing Initiated
    steps:
      - name: SeedStatus
        type: Update Document
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
    type: Sequential Workflow
    channel: life
    event:
      type: Document Processing Initiated
    steps:
      - name: Compute
        type: JavaScript Code
        code: |
          return { increment: 4 };
      - name: Apply
        type: Update Document
        changeset:
          - op: REPLACE
            path: /counter
            val: "\${document('/counter') + steps.Compute.increment}"
`;

    const doc = blue.yamlToNode(yaml);
    const result = await expectOk(processor.initializeDocument(doc));

    const snapshot = blue.nodeToJson(result.document, 'simple') as {
      counter?: number;
    };
    expect(snapshot.counter).toBe(9);
  });

  it('supports changeset expressions that produce multiple patches', async () => {
    const processor = buildProcessor(blue);
    const yaml = `name: Update History Workflow
history: []
contracts:
  life:
    type: Lifecycle Event Channel
  handler:
    type: Sequential Workflow
    channel: life
    event:
      type: Document Processing Initiated
    steps:
      - name: Apply
        type: Update Document
        changeset: "\${[
          { op: 'REPLACE', path: '/status', val: 'ready' },
          { op: 'ADD', path: '/history/-', val: 'booted' }
        ]}"
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
});
