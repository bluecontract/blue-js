import { describe, expect, it } from 'vitest';
import {
  ComputeWorkflowTestSupport,
  json,
  onlyEvent,
} from './compute-workflow-test-support.js';
import type { DocumentProcessingResult } from '../../../types/document-processing-result.js';

type EventJson = {
  readonly kind?: string;
  readonly approved?: boolean | string;
  readonly reason?: string;
  readonly patchPath?: string;
  readonly patchValue?: string;
  readonly request?: string;
  readonly status?: string | number;
  readonly channel?: string;
};

function fatalReason(result: DocumentProcessingResult): string {
  return String(result.document.get('/contracts/terminated/reason') ?? '');
}

describe('Compute workflow execution', () => {
  it('emits an inline Compute event without mutating the document', async () => {
    const support = new ComputeWorkflowTestSupport();
    const document = await support.initializedOperationWorkflow(`    steps:
      - name: Build
        type: Conversation/Compute
        do:
          - $appendEvent:
              type: Conversation/Event
              kind: Compute Event
`);

    const result = await support.processRun(document);
    const event = json<EventJson>(support.blue, onlyEvent(result));

    expect(result.document.get('/status')).toBe('idle');
    expect(event.kind).toBe('Compute Event');
  });

  it('makes inline Compute results readable by later Compute steps', async () => {
    const support = new ComputeWorkflowTestSupport();
    const document = await support.initializedOperationWorkflow(`    steps:
      - name: Build
        type: Conversation/Compute
        do:
          - $return:
              approved: true
              reason: ok
      - name: ReadPrior
        type: Conversation/Compute
        do:
          - $appendEvent:
              type: Conversation/Event
              kind: Prior Result
              approved:
                $steps: Build.approved
              reason:
                $steps: Build.reason
`);

    const result = await support.processRun(document);
    const event = json<EventJson>(support.blue, onlyEvent(result));

    expect(event).toMatchObject({
      kind: 'Prior Result',
      approved: true,
      reason: 'ok',
    });
  });

  it('suppresses computed events while still exporting step results', async () => {
    const support = new ComputeWorkflowTestSupport();
    const noEmission = await support.initializedOperationWorkflow(`    steps:
      - name: Build
        type: Conversation/Compute
        emitEvents: false
        do:
          - $appendEvent:
              type: Conversation/Event
              kind: Should Not Emit
`);
    const exported = await support.initializedOperationWorkflow(`    steps:
      - name: Build
        type: Conversation/Compute
        emitEvents: false
        do:
          - $appendEvent:
              type: Conversation/Event
              kind: Should Not Emit
          - $return:
              approved: true
      - name: Read
        type: Conversation/Compute
        do:
          - $appendEvent:
              type: Conversation/Event
              kind: Exported Result
              approved:
                $steps: Build.approved
`);

    expect((await support.processRun(noEmission)).triggeredEvents).toHaveLength(
      0,
    );
    const result = await support.processRun(exported);
    const event = json<EventJson>(support.blue, onlyEvent(result));
    expect(event).toMatchObject({ kind: 'Exported Result', approved: true });
  });

  it('honors returnResult false without suppressing emitted events', async () => {
    const support = new ComputeWorkflowTestSupport();
    const noResult = await support.initializedOperationWorkflow(`    steps:
      - name: Build
        type: Conversation/Compute
        returnResult: false
        do:
          - $return:
              approved: true
      - name: ReadPrior
        type: Conversation/Compute
        do:
          - $appendEvent:
              type: Conversation/Event
              kind: Missing Prior
              approved:
                $coalesce:
                  - $steps: Build.approved
                  - missing
`);
    const eventStillEmits =
      await support.initializedOperationWorkflow(`    steps:
      - name: Build
        type: Conversation/Compute
        returnResult: false
        do:
          - $appendEvent:
              type: Conversation/Event
              kind: Event Still Emits
          - $return:
              approved: true
`);

    const missing = json<EventJson>(
      support.blue,
      onlyEvent(await support.processRun(noResult)),
    );
    const emitted = json<EventJson>(
      support.blue,
      onlyEvent(await support.processRun(eventStillEmits)),
    );

    expect(missing.approved).toBe('missing');
    expect(emitted.kind).toBe('Event Still Emits');
  });

  it('exports unnamed Compute steps under their step index key', async () => {
    const support = new ComputeWorkflowTestSupport();
    const document = await support.initializedOperationWorkflow(`    steps:
      - type: Conversation/Compute
        do:
          - $return:
              payload: abc
      - name: Read
        type: Conversation/Compute
        do:
          - $appendEvent:
              type: Conversation/Event
              kind:
                $steps: Step1.payload
`);

    const event = json<EventJson>(
      support.blue,
      onlyEvent(await support.processRun(document)),
    );

    expect(event.kind).toBe('abc');
  });

  it('applies Compute changesets while keeping them as step data', async () => {
    const support = new ComputeWorkflowTestSupport();
    const document = await support.initializedOperationWorkflow(`    steps:
      - name: BuildPatch
        type: Conversation/Compute
        do:
          - $appendChange:
              op: replace
              path: /status
              val: active
      - name: VerifyPatchData
        type: Conversation/Compute
        do:
          - $appendEvent:
              type: Conversation/Event
              kind: Patch Data
              patchPath:
                $steps:
                  step: BuildPatch
                  path: /changeset/0/path
              patchValue:
                $steps:
                  step: BuildPatch
                  path: /changeset/0/val
`);

    const result = await support.processRun(document);
    const event = json<EventJson>(support.blue, onlyEvent(result));

    expect(result.document.get('/status')).toBe('active');
    expect(event).toMatchObject({
      kind: 'Patch Data',
      patchPath: '/status',
      patchValue: 'active',
    });
  });

  it('supports expression-only Compute results and all runtime inputs', async () => {
    const support = new ComputeWorkflowTestSupport();
    const inputs = await support.initializedOperationWorkflow(
      `    steps:
      - name: Build
        type: Conversation/Compute
        do:
          - $appendEvent:
              type: Conversation/Event
              kind: Inputs
              request:
                $event: /message/request/text
              status:
                $document: /status
              channel:
                $currentContract: /channel
`,
      {
        requestTypeYaml: `type: Dictionary
entries:
  text:
    type: Text`,
      },
    );

    const inputEvent = json<EventJson>(
      support.blue,
      onlyEvent(await support.processRun(inputs, { text: 'hello' })),
    );

    expect(inputEvent).toMatchObject({
      request: 'hello',
      status: 'idle',
      channel: 'ownerChannel',
    });
  });

  it('preserves authored workflow channels in currentContract bindings', async () => {
    const support = new ComputeWorkflowTestSupport();
    const initialized = await support.initialize(
      support.yaml(`name: Compute Authored Channel Test
status: idle
contracts:
  manualChannel:
    type: Conversation/Timeline Channel
    timelineId: owner
  run:
    type: Conversation/Operation
    channel: manualChannel
    request:
      type: Text
  runImpl:
    type: Conversation/Sequential Workflow Operation
    operation: run
    channel: manualChannel
    steps:
      - name: Build
        type: Conversation/Compute
        do:
          - $appendEvent:
              type: Conversation/Event
              kind: Authored Channel
              channel:
                $currentContract: /channel
`),
    );

    const event = json<EventJson>(
      support.blue,
      onlyEvent(await support.processRun(initialized.document)),
    );

    expect(event.channel).toBe('manualChannel');
  });

  it('executes sibling, pointer, and inline Compute Definitions', async () => {
    const support = new ComputeWorkflowTestSupport();
    const sibling = (
      await support.initialize(
        support.yaml(
          support.operationWorkflowDocumentWithContracts(
            `  computeLogic:
    type: Conversation/Compute Definition
    constants:
      kind: From Definition
    functions:
      build:
        do:
          - $appendEvent:
              type: Conversation/Event
              kind:
                $const: kind`,
            `    steps:
      - name: Build
        type: Conversation/Compute
        definition: computeLogic
        entry: build`,
          ),
        ),
      )
    ).document;
    const pointer = (
      await support.initialize(
        support.yaml(
          support.operationWorkflowDocumentWithContracts(
            `  computeLogic:
    type: Conversation/Compute Definition
    functions:
      build:
        do:
          - $appendEvent:
              type: Conversation/Event
              kind: Absolute Definition`,
            `    steps:
      - name: Build
        type: Conversation/Compute
        definition: /contracts/computeLogic
        entry: build`,
          ),
        ),
      )
    ).document;
    const inline = await support.initializedOperationWorkflow(`    steps:
      - name: Build
        type: Conversation/Compute
        definition:
          constants:
            kind: Inline Definition
          functions:
            build:
              do:
                - $appendEvent:
                    type: Conversation/Event
                    kind:
                      $const: kind
        entry: build
`);

    expect(
      json<EventJson>(
        support.blue,
        onlyEvent(await support.processRun(sibling)),
      ).kind,
    ).toBe('From Definition');
    expect(
      json<EventJson>(
        support.blue,
        onlyEvent(await support.processRun(pointer)),
      ).kind,
    ).toBe('Absolute Definition');
    expect(
      json<EventJson>(support.blue, onlyEvent(await support.processRun(inline)))
        .kind,
    ).toBe('Inline Definition');
  });

  it('does not execute Compute Definition markers by themselves', async () => {
    const support = new ComputeWorkflowTestSupport();
    const initialized = await support.initialize(
      support.yaml(
        support.operationWorkflowDocumentWithContracts(
          `  computeLogic:
    type: Conversation/Compute Definition
    functions:
      build:
        do:
          - $appendEvent:
              type: Conversation/Event
              kind: Should Not Happen`,
          `    steps: []`,
        ),
      ),
    );

    expect(
      (await support.processRun(initialized.document)).triggeredEvents,
    ).toHaveLength(0);
  });

  it('fails closed for missing definitions and missing entries', async () => {
    const support = new ComputeWorkflowTestSupport();
    const missingDefinition =
      await support.initializedOperationWorkflow(`    steps:
      - name: Build
        type: Conversation/Compute
        definition: missingCompute
        entry: build
`);
    const missingEntry = (
      await support.initialize(
        support.yaml(
          support.operationWorkflowDocumentWithContracts(
            `  computeLogic:
    type: Conversation/Compute Definition
    functions:
      build:
        expr: ok`,
            `    steps:
      - name: Build
        type: Conversation/Compute
        definition: computeLogic
        entry: missing`,
          ),
        ),
      )
    ).document;

    await expect(
      fatalReason(await support.processRun(missingDefinition)),
    ).toMatch(/definition "missingCompute" was not found/);
    await expect(fatalReason(await support.processRun(missingEntry))).toMatch(
      /Unknown entry function/,
    );
  });

  it('allows step constants, escaped definition keys, and local functions', async () => {
    const support = new ComputeWorkflowTestSupport();
    const overridden = (
      await support.initialize(
        support.yaml(
          support.operationWorkflowDocumentWithContracts(
            `  computeLogic:
    type: Conversation/Compute Definition
    constants:
      kind: From Definition
    functions:
      build:
        do:
          - $appendEvent:
              type: Conversation/Event
              kind:
                $const: kind`,
            `    steps:
      - name: Build
        type: Conversation/Compute
        definition: computeLogic
        entry: build
        constants:
          kind: From Step`,
          ),
        ),
      )
    ).document;
    const escaped = (
      await support.initialize(
        support.yaml(
          support.operationWorkflowDocumentWithContracts(
            `  "compute/logic~v1":
    type: Conversation/Compute Definition
    functions:
      build:
        do:
          - $appendEvent:
              type: Conversation/Event
              kind: Escaped Definition`,
            `    steps:
      - name: Build
        type: Conversation/Compute
        definition: compute/logic~v1
        entry: build`,
          ),
        ),
      )
    ).document;
    const local = await support.initializedOperationWorkflow(`    steps:
      - name: Build
        type: Conversation/Compute
        entry: build
        functions:
          build:
            do:
              - $appendEvent:
                  type: Conversation/Event
                  kind: Local Function
`);

    expect(
      json<EventJson>(
        support.blue,
        onlyEvent(await support.processRun(overridden)),
      ).kind,
    ).toBe('From Step');
    expect((await support.processRun(escaped)).triggeredEvents).toHaveLength(1);
    expect(
      json<EventJson>(support.blue, onlyEvent(await support.processRun(local)))
        .kind,
    ).toBe('Local Function');
  });

  it('fails closed on gas exhaustion', async () => {
    const support = new ComputeWorkflowTestSupport();
    const document = await support.initializedOperationWorkflow(`    steps:
      - name: Build
        type: Conversation/Compute
        gasLimit: 1
        do:
          - $return:
              ok: true
`);

    expect(fatalReason(await support.processRun(document))).toMatch(/gas/i);
  });

  it('emits explicit result events and accumulator events', async () => {
    const support = new ComputeWorkflowTestSupport();
    const document = await support.initializedOperationWorkflow(`    steps:
      - name: Explicit
        type: Conversation/Compute
        do:
          - $return:
              events:
                - type: Conversation/Event
                  kind: Explicit Events
              changeset: []
      - name: Accumulator
        type: Conversation/Compute
        do:
          - $appendEvent:
              type: Conversation/Event
              kind: Accumulator Event
          - $return:
              approved: true
`);

    const result = await support.processRun(document);
    const events = result.triggeredEvents.map((event) =>
      json<EventJson>(support.blue, event),
    );

    expect(events.map((event) => event.kind)).toEqual([
      'Explicit Events',
      'Accumulator Event',
    ]);
  });

  it('fails closed for invalid Compute event results', async () => {
    const support = new ComputeWorkflowTestSupport();
    const invalidEvents = await support.initializedOperationWorkflow(`    steps:
      - name: Build
        type: Conversation/Compute
        do:
          - $return:
              events: not-a-list
`);
    const scalarEvent = await support.initializedOperationWorkflow(`    steps:
      - name: Build
        type: Conversation/Compute
        do:
          - $return:
              events:
                - hello
`);
    const nullEvent = await support.initializedOperationWorkflow(`    steps:
      - name: Build
        type: Conversation/Compute
        do:
          - $return:
              events:
                - null
`);

    expect(fatalReason(await support.processRun(invalidEvents))).toMatch(
      /events must be a list/,
    );
    expect(fatalReason(await support.processRun(scalarEvent))).toMatch(
      /object entries/,
    );
    expect(fatalReason(await support.processRun(nullEvent))).toMatch(
      /undefined\/null|object entries/,
    );
  });

  it('keeps JavaScript Code, Update Document, and Trigger Event compatibility', async () => {
    const support = new ComputeWorkflowTestSupport();
    const document = await support.initializedOperationWorkflow(`    steps:
      - name: ComputeValue
        type: Conversation/JavaScript Code
        code: "return { value: 41 };"
      - name: Apply
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /status
            val: "\${steps.ComputeValue.value + 1}"
      - name: Trigger
        type: Conversation/Trigger Event
        event:
          type: Conversation/Event
          kind: Existing Trigger
          status: "\${document('/status')}"
`);

    const result = await support.processRun(document);
    const event = json<EventJson>(support.blue, onlyEvent(result));

    expect(Number(result.document.get('/status'))).toBe(42);
    expect(event).toMatchObject({ kind: 'Existing Trigger', status: 42 });
  });

  it('maps BEX execution errors to processor fatal errors', async () => {
    const support = new ComputeWorkflowTestSupport();
    const document = await support.initializedOperationWorkflow(`    steps:
      - name: Build
        type: Conversation/Compute
        expr:
          $unknown: true
`);

    expect(fatalReason(await support.processRun(document))).toMatch(
      /Unknown BEX operator/,
    );
  });
});
