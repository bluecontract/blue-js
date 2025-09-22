import { expect, describe, test } from 'vitest';
import {
  CodeBlockEvaluationError,
  ExpressionEvaluationError,
} from '../utils/exceptions';
import { JsonObject } from '@blue-labs/shared-utils';
import { Blue } from '@blue-labs/language';
import { NativeBlueDocumentProcessor } from '../NativeBlueDocumentProcessor';
import {
  repository as coreRepository,
  DocumentUpdateSchema,
} from '@blue-repository/core-dev';
import { prepareToProcess } from '../testUtils';
import { createTimelineEntryEvent } from '../utils/eventFactories';

function makeWorkflowDoc(steps: JsonObject[]): JsonObject {
  return {
    contracts: {
      timeline: {
        type: 'Timeline Channel',
        timelineId: 't1',
      },
      workflow: {
        type: 'Sequential Workflow',
        channel: 'timeline',
        steps,
      },
    },
  };
}

describe('Sequential Workflow – JavaScript Code step', () => {
  const blue = new Blue({
    repositories: [coreRepository],
  });
  const documentProcessor = new NativeBlueDocumentProcessor(blue);
  const timelineEvent = (message: unknown) => {
    return createTimelineEntryEvent('t1', message, blue);
  };

  test('propagates step results into Update Document expressions', async () => {
    const steps: JsonObject[] = [
      {
        type: 'JavaScript Code',
        name: 'Calc',
        code: 'var price = event.message.amount; return { total: price * 1.23 };',
      },
      {
        type: 'Update Document',
        changeset: [
          {
            op: 'add',
            path: '/total',
            val: '${steps.Calc.total}',
          },
        ],
      },
    ];

    const doc = makeWorkflowDoc(steps);

    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    const evt = timelineEvent({ amount: 100 });

    const { state, emitted } = await documentProcessor.processEvents(
      initializedState,
      [evt]
    );

    const jsonState = blue.nodeToJson(state, 'simple') as any;

    expect(jsonState.total).toBe(123);

    const docUpdateEvt = emitted.find((e) =>
      blue.isTypeOf(e, DocumentUpdateSchema)
    );
    expect(docUpdateEvt).toBeDefined();
    const docUpdateEvtJson = blue.nodeToJson(docUpdateEvt!, 'simple') as any;
    expect(docUpdateEvtJson.val).toBe(123);
  });

  test('JS‑Code step can emit events that are routed synchronously', async () => {
    const greetingEvt = { name: 'Greeting', text: 'hi!' };

    const steps: JsonObject[] = [
      {
        type: 'JavaScript Code',
        name: 'Emitter',
        code: `return { events: [${JSON.stringify(greetingEvt)}] };`,
      },
    ];

    const doc = makeWorkflowDoc(steps);

    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    const evt = timelineEvent({ foo: 1 });
    const { emitted } = await documentProcessor.processEvents(
      initializedState,
      [evt]
    );

    const found = emitted
      .map((e) => blue.nodeToJson(e, 'simple') as any)
      .find((e) => e.name === 'Greeting');

    expect(found).toBeDefined();
    expect(found).toEqual(greetingEvt);
  });

  test('unnamed step exposes Step<N> key inside steps map', async () => {
    const steps: JsonObject[] = [
      {
        type: 'JavaScript Code',
        code: 'return { value: 7 };',
      },
      {
        type: 'Update Document',
        changeset: [{ op: 'add', path: '/v', val: '${steps.Step1.value}' }],
      },
    ];

    const doc = makeWorkflowDoc(steps);

    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    const evt = timelineEvent({});
    const { state } = await documentProcessor.processEvents(initializedState, [
      evt,
    ]);

    const jsonState = blue.nodeToJson(state, 'simple') as any;

    expect(jsonState.v).toBe(7);
  });

  test('sandbox blocks access to process global (simple evaluator)', async () => {
    const steps: JsonObject[] = [
      {
        type: 'JavaScript Code',
        code: "try { /* @ts-ignore */ return process.pid; } catch(e){ return 'blocked'; }",
        name: 'Isolate',
      },
    ];

    const doc = makeWorkflowDoc(steps);

    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    const evt = timelineEvent({});
    const { emitted } = await documentProcessor.processEvents(
      initializedState,
      [evt]
    );

    expect(emitted.length).toBe(0);
  });

  test('parallel channel events do not bleed step results across runs', async () => {
    const steps: JsonObject[] = [
      {
        type: 'JavaScript Code',
        name: 'Capture',
        code: 'return { n: event.message.n };',
      },
      {
        type: 'Update Document',
        changeset: [{ op: 'add', path: '/lastN', val: '${steps.Capture.n}' }],
      },
    ];

    const doc = makeWorkflowDoc(steps);
    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    const evt1 = timelineEvent({ n: 1 });
    const evt2 = timelineEvent({ n: 2 });

    const r1 = await documentProcessor.processEvents(initializedState, [evt1]);
    const r2 = await documentProcessor.processEvents(r1.state, [evt2]);

    const jsonState1 = blue.nodeToJson(r1.state, 'simple') as any;

    expect(jsonState1.lastN).toBe(1);

    const jsonState2 = blue.nodeToJson(r2.state, 'simple') as any;

    expect(jsonState2.lastN).toBe(2);
  });
});

describe('Sequential Workflow – Error Handling', () => {
  const blue = new Blue({
    repositories: [coreRepository],
  });
  const documentProcessor = new NativeBlueDocumentProcessor(blue);
  const timelineEvent = (message: unknown) => {
    return createTimelineEntryEvent('t1', message, blue);
  };
  test('throws ExpressionEvaluationError for invalid expressions', async () => {
    const steps: JsonObject[] = [
      {
        type: 'Update Document',
        changeset: [
          {
            op: 'add',
            path: '/value',
            val: '${invalid.expression}', // Invalid expression that will cause error
          },
        ],
      },
    ];

    const doc = makeWorkflowDoc(steps);
    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    const evt = timelineEvent({});

    await expect(
      documentProcessor.processEvents(initializedState, [evt])
    ).rejects.toThrow(ExpressionEvaluationError);
  });

  test('throws CodeBlockEvaluationError for invalid JavaScript code', async () => {
    const steps: JsonObject[] = [
      {
        type: 'JavaScript Code',
        name: 'InvalidCode',
        code: 'this is invalid javascript code;', // Invalid JS that will cause error
      },
    ];

    const doc = makeWorkflowDoc(steps);
    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    const evt = timelineEvent({});

    await expect(
      documentProcessor.processEvents(initializedState, [evt])
    ).rejects.toThrow(CodeBlockEvaluationError);
  });

  test('throws CodeBlockEvaluationError for runtime errors in JavaScript code', async () => {
    const steps: JsonObject[] = [
      {
        type: 'JavaScript Code',
        name: 'RuntimeError',
        code: 'throw new Error("Runtime error");', // Code that throws at runtime
      },
    ];

    const doc = makeWorkflowDoc(steps);
    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    const evt = timelineEvent({});

    await expect(
      documentProcessor.processEvents(initializedState, [evt])
    ).rejects.toThrow(CodeBlockEvaluationError);
  });
});
