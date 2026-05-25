import { describe, expect, it } from 'vitest';

import {
  ComputeWorkflowTestSupport,
  json,
  onlyEvent,
} from './compute-workflow-test-support.js';
import type { DocumentProcessingResult } from '../../../types/document-processing-result.js';

type EventJson = {
  readonly kind?: string;
  readonly status?: string | number | boolean;
  readonly channel?: string;
};

function fatalReason(result: DocumentProcessingResult): string {
  return String(result.document.get('/contracts/terminated/reason') ?? '');
}

describe('BEX expression-enabled workflow fields', () => {
  it('applies a Compute changeset through an Update Document binding', async () => {
    const support = new ComputeWorkflowTestSupport();
    const document = await support.initializedOperationWorkflow(`    steps:
      - name: BuildPatch
        type: Conversation/Compute
        do:
          - $appendChange:
              op: replace
              path: /status
              val: active
      - name: ApplyPatch
        type: Conversation/Update Document
        changeset:
          $binding:
            name: steps
            path: /BuildPatch/changeset
`);

    const result = await support.processRun(document);

    expect(result.document.get('/status')).toBe('active');
  });

  it('evaluates nested BEX values inside literal Update Document changesets', async () => {
    const support = new ComputeWorkflowTestSupport();
    const literal = await support.initializedOperationWorkflow(
      `    steps:
      - name: ApplyPatch
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /status
            val:
              $binding:
                name: event
                path: /message/request/status
`,
      {
        requestTypeYaml: `type: Dictionary
entries:
  status:
    type: Text`,
      },
    );
    const dynamicPath = await support.initialize(
      support.yaml(
        support.operationWorkflowDocumentWithStatus(
          `records:
  a:
    status: idle`,
          `    steps:
      - name: ApplyPatch
        type: Conversation/Update Document
        changeset:
          - op: replace
            path:
              $concat:
                - /records/
                - $binding:
                    name: event
                    path: /message/request/itemId
                - /status
            val: active
`,
          {
            requestTypeYaml: `type: Dictionary
entries:
  itemId:
    type: Text`,
          },
        ),
      ),
    );

    const literalResult = await support.processRun(literal, {
      status: 'active',
    });
    const dynamicResult = await support.processRun(dynamicPath.document, {
      itemId: 'a',
    });

    expect(literalResult.document.get('/status')).toBe('active');
    expect(dynamicResult.document.get('/records/a/status')).toBe('active');
  });

  it('rejects invalid evaluated Update Document changesets', async () => {
    const support = new ComputeWorkflowTestSupport();
    const scalar = await support.initializedOperationWorkflow(`    steps:
      - name: ApplyPatch
        type: Conversation/Update Document
        changeset:
          $document: /status
`);
    const invalidOp = await support.initializedOperationWorkflow(
      `    steps:
      - name: ApplyPatch
        type: Conversation/Update Document
        changeset:
          - op: invalid
            path: /status
            val:
              $binding:
                name: event
                path: /message/request/status
`,
      {
        requestTypeYaml: `type: Dictionary
entries:
  status:
    type: Text`,
      },
    );
    const missingVal = await support.initializedOperationWorkflow(
      `    steps:
      - name: ApplyPatch
        type: Conversation/Update Document
        changeset:
          - op: replace
            path:
              $binding:
                name: event
                path: /message/request/path
`,
      {
        requestTypeYaml: `type: Dictionary
entries:
  path:
    type: Text`,
      },
    );

    expect(fatalReason(await support.processRun(scalar))).toMatch(
      /must evaluate to a list/,
    );
    expect(
      fatalReason(await support.processRun(invalidOp, { status: 'active' })),
    ).toMatch(/Unsupported Update Document operation/);
    expect(
      fatalReason(await support.processRun(missingVal, { path: '/status' })),
    ).toMatch(/missing val/);
  });

  it('handles remove operations and duplicate paths through BEX changesets', async () => {
    const support = new ComputeWorkflowTestSupport();
    const removeDocument = await support.initialize(
      support.yaml(
        support.operationWorkflowDocumentWithStatus(
          'temporary: gone',
          `    steps:
      - name: Remove
        type: Conversation/Update Document
        changeset:
          - op: remove
            path:
              $binding:
                name: event
                path: /message/request/path
`,
          {
            requestTypeYaml: `type: Dictionary
entries:
  path:
    type: Text`,
          },
        ),
      ),
    );
    const duplicateDocument = await support.initializedOperationWorkflow(
      `    steps:
      - name: ApplyPatch
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /status
            val:
              $binding:
                name: event
                path: /message/request/first
          - op: replace
            path: /status
            val:
              $binding:
                name: event
                path: /message/request/second
`,
      {
        requestTypeYaml: `type: Dictionary
entries:
  first:
    type: Text
  second:
    type: Text`,
      },
    );

    const removed = await support.processRun(removeDocument.document, {
      path: '/temporary',
    });
    const duplicate = await support.processRun(duplicateDocument, {
      first: 'first',
      second: 'second',
    });

    expect(removed.document.getProperties()).not.toHaveProperty('temporary');
    expect(duplicate.document.get('/status')).toBe('second');
  });

  it('evaluates nested Trigger Event BEX and emits prior Compute events', async () => {
    const support = new ComputeWorkflowTestSupport();
    const nested = await support.initializedOperationWorkflow(
      `    steps:
      - name: Emit
        type: Conversation/Trigger Event
        event:
          type: Conversation/Event
          kind: Status Event
          status:
            $binding:
              name: event
              path: /message/request/status
          channel:
            $binding:
              name: currentContract
              path: /channel
`,
      {
        requestTypeYaml: `type: Dictionary
entries:
  status:
    type: Text`,
      },
    );
    const fromCompute = await support.initializedOperationWorkflow(`    steps:
      - name: BuildEvent
        type: Conversation/Compute
        do:
          - $return:
              event:
                type: Conversation/Event
                kind: Built Event
                status:
                  $document: /status
      - name: EmitEvent
        type: Conversation/Trigger Event
        event:
          $binding:
            name: steps
            path: /BuildEvent/event
`);
    const routed = await support.initialize(
      support.yaml(
        support.operationWorkflowDocumentWithContracts(
          `  trig:
    type: Core/Triggered Event Channel
  observer:
    type: Conversation/Sequential Workflow
    channel: trig
    event:
      type: Conversation/Status Completed
    steps:
      - name: EmitObserved
        type: Conversation/Trigger Event
        event:
          type: Conversation/Event
          kind: Observed BEX Event`,
          `    steps:
      - name: BuildEvent
        type: Conversation/Compute
        do:
          - $return:
              event:
                type: Conversation/Status Completed
      - name: EmitEvent
        type: Conversation/Trigger Event
        event:
          $binding:
            name: steps
            path: /BuildEvent/event
`,
        ),
      ),
    );

    const nestedEvent = json<EventJson>(
      support.blue,
      onlyEvent(await support.processRun(nested, { status: 'active' })),
    );
    const computeEvent = json<EventJson>(
      support.blue,
      onlyEvent(await support.processRun(fromCompute)),
    );
    const routedEvents = (
      await support.processRun(routed.document)
    ).triggeredEvents.map((event) => json<EventJson>(support.blue, event));

    expect(nestedEvent).toMatchObject({
      kind: 'Status Event',
      status: 'active',
      channel: 'ownerChannel',
    });
    expect(computeEvent).toMatchObject({
      kind: 'Built Event',
      status: 'idle',
    });
    expect(routedEvents).toContainEqual(
      expect.objectContaining({ kind: 'Observed BEX Event' }),
    );
  });

  it('rejects invalid evaluated Trigger Event payloads', async () => {
    const support = new ComputeWorkflowTestSupport();
    const scalar = await support.initializedOperationWorkflow(`    steps:
      - name: Emit
        type: Conversation/Trigger Event
        event:
          $document: /status
`);
    const missing = await support.initializedOperationWorkflow(`    steps:
      - name: Emit
        type: Conversation/Trigger Event
        event:
          $document: /missing
`);

    expect(fatalReason(await support.processRun(scalar))).toMatch(
      /must evaluate to an object/,
    );
    expect(fatalReason(await support.processRun(missing))).toMatch(
      /must evaluate to an object|must declare event payload/,
    );
  });

  it('keeps literal and legacy expression paths working alongside BEX fields', async () => {
    const support = new ComputeWorkflowTestSupport();
    const document = await support.initializedOperationWorkflow(`    steps:
      - name: Prepare
        type: Conversation/JavaScript Code
        code: "return { value: 'legacy' };"
      - name: ApplyLiteral
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /status
            val: literal
      - name: ApplyLegacy
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /status
            val: "\${steps.Prepare.value}"
      - name: EmitLegacy
        type: Conversation/Trigger Event
        event:
          type: Conversation/Event
          kind: Existing Legacy
          status: "\${document('/status')}"
`);

    const result = await support.processRun(document);
    const event = json<EventJson>(support.blue, onlyEvent(result));

    expect(result.document.get('/status')).toBe('legacy');
    expect(event).toMatchObject({
      kind: 'Existing Legacy',
      status: 'legacy',
    });
  });

  it('runs a full Compute to Update Document to Trigger Event binding workflow', async () => {
    const support = new ComputeWorkflowTestSupport();
    const document = await support.initializedOperationWorkflow(
      `    steps:
      - name: BuildPatch
        type: Conversation/Compute
        do:
          - $appendChange:
              op: replace
              path: /status
              val:
                $binding:
                  name: event
                  path: /message/request/status
      - name: ApplyPatch
        type: Conversation/Update Document
        changeset:
          $binding:
            name: steps
            path: /BuildPatch/changeset
      - name: BuildEvent
        type: Conversation/Compute
        do:
          - $return:
              event:
                type: Conversation/Event
                kind: Status Applied
                status:
                  $document: /status
      - name: EmitEvent
        type: Conversation/Trigger Event
        event:
          $binding:
            name: steps
            path: /BuildEvent/event
`,
      {
        requestTypeYaml: `type: Dictionary
entries:
  status:
    type: Text`,
      },
    );

    const result = await support.processRun(document, { status: 'active' });
    const event = json<EventJson>(support.blue, onlyEvent(result));

    expect(result.document.get('/status')).toBe('active');
    expect(event).toMatchObject({
      kind: 'Status Applied',
      status: 'active',
    });
  });
});
