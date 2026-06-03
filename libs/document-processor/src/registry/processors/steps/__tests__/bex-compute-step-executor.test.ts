import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { BlueNode } from '@blue-labs/language';

import { ProcessorFatalError } from '../../../../engine/processor-fatal-error.js';
import { conversationBlueIds } from '../../../../repository/semantic-repository.js';
import { createBlue } from '../../../../test-support/blue.js';
import {
  createArgs,
  createRealContext,
} from '../../../../test-support/workflow.js';
import { property } from '../../../../__tests__/test-utils.js';
import { DEFAULT_STEP_EXECUTORS } from '../../workflow/step-runner.js';
import { BexFieldEvaluator } from '../bex-field-evaluator.js';
import { BexComputeStepExecutor } from '../bex-compute-step-executor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type BexTestValue =
  | null
  | string
  | number
  | boolean
  | BexTestValue[]
  | { readonly [key: string]: BexTestValue };

function bexNode(value: BexTestValue): BlueNode {
  if (Array.isArray(value)) {
    return new BlueNode().setItems(value.map((item) => bexNode(item)));
  }
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return new BlueNode().setValue(value);
  }
  return new BlueNode().setProperties(
    Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, bexNode(item)]),
    ),
  );
}

function createComputeStep(specification: {
  readonly [key: string]: BexTestValue;
}): BlueNode {
  return bexNode(specification).setType(
    new BlueNode().setReferenceBlueId(
      conversationBlueIds['Conversation/Compute'],
    ),
  );
}

describe('BexComputeStepExecutor', () => {
  const executor = new BexComputeStepExecutor();

  it('is registered as the workflow compute step', () => {
    const supported = new Set(
      DEFAULT_STEP_EXECUTORS.flatMap((item) => item.supportedBlueIds),
    );

    expect(supported.has(conversationBlueIds['Conversation/Compute'])).toBe(
      true,
    );
    expect(conversationBlueIds['Conversation/Compute Definition']).toMatch(
      /^[1-9A-HJ-NP-Za-km-z]+$/,
    );
  });

  it('reads the current document and returns a value', async () => {
    const blue = createBlue();
    const stepNode = createComputeStep({
      expr: { $multiply: [{ $document: '/counter' }, 3] },
    });
    const eventNode = blue.jsonValueToNode({});
    const setup = createRealContext(blue, eventNode);
    setup.execution.runtime().directWrite('/counter', blue.jsonValueToNode(5));
    const args = createArgs({ context: setup.context, stepNode, eventNode });

    const result = await executor.execute(args);

    expect(result).toBe(15);
    expect(setup.execution.runtime().gasMeter().totalGas()).toBeGreaterThan(0);
  });

  it('computeStepUsesDocumentViewWithoutMaterializingRootToNode', async () => {
    const blue = createBlue();
    const stepNode = createComputeStep({
      expr: { $document: '/counter' },
    });
    const eventNode = blue.jsonValueToNode({});
    const setup = createRealContext(blue, eventNode);
    setup.execution.runtime().directWrite('/counter', blue.jsonValueToNode(5));
    const documentAt = setup.context.documentAt.bind(setup.context);
    let rootReads = 0;
    setup.context.documentAt = (pointer: string) => {
      if (pointer === '/') {
        rootReads += 1;
      }
      return documentAt(pointer);
    };
    const args = createArgs({ context: setup.context, stepNode, eventNode });

    await expect(executor.execute(args)).resolves.toBe(5);
    expect(rootReads).toBe(0);
  });

  it('bexFieldEvaluatorUsesDocumentViewWithoutMaterializingRootToNode', () => {
    const blue = createBlue();
    const evaluator = new BexFieldEvaluator();
    const stepNode = createComputeStep({ expr: 'unused' });
    const eventNode = blue.jsonValueToNode({});
    const setup = createRealContext(blue, eventNode);
    setup.execution.runtime().directWrite('/counter', blue.jsonValueToNode(7));
    const documentAt = setup.context.documentAt.bind(setup.context);
    let rootReads = 0;
    setup.context.documentAt = (pointer: string) => {
      if (pointer === '/') {
        rootReads += 1;
      }
      return documentAt(pointer);
    };
    const args = createArgs({ context: setup.context, stepNode, eventNode });

    const result = evaluator.evaluateNode(
      args,
      bexNode({ $document: '/counter' }),
    );

    expect(result.getValue()?.toString()).toBe('7');
    expect(rootReads).toBe(0);
  });

  it('evaluates typed BEX expression list items', () => {
    const blue = createBlue();
    const evaluator = new BexFieldEvaluator();
    const stepNode = createComputeStep({ expr: 'unused' });
    const eventNode = blue.jsonValueToNode({
      message: { request: { childSessionId: 'child-session' } },
    });
    const setup = createRealContext(blue, eventNode);
    const args = createArgs({ context: setup.context, stepNode, eventNode });
    const expression = new BlueNode().setType('Text').setProperties({
      $unwrap: bexNode({ $event: '/message/request/childSessionId' }),
    });
    const payload = new BlueNode().setProperties({
      initiatorSessionIds: new BlueNode().setItems([expression]),
    });

    const result = evaluator.evaluateNode(args, payload);

    expect(
      result.getProperties()?.initiatorSessionIds.getItems()?.[0]?.getValue(),
    ).toBe('child-session');
  });

  it('does not hide ordinary sibling fields when detecting typed BEX expressions', () => {
    const blue = createBlue();
    const evaluator = new BexFieldEvaluator();
    const stepNode = createComputeStep({ expr: 'unused' });
    const eventNode = blue.jsonValueToNode({
      message: { request: { childSessionId: 'child-session' } },
    });
    const setup = createRealContext(blue, eventNode);
    const args = createArgs({ context: setup.context, stepNode, eventNode });
    const expression = new BlueNode().setType('Text').setProperties({
      $unwrap: bexNode({ $event: '/message/request/childSessionId' }),
      debug: blue.jsonValueToNode(true),
    });

    const result = evaluator.evaluateNode(args, expression);

    expect(result.getValue()).toBeUndefined();
    expect(result.getProperties()?.$unwrap.getValue()).toBe('child-session');
    expect(result.getProperties()?.debug.getValue()).toBe(true);
  });

  it('productionBexContextCreationUsesDocumentViewNotDocument', () => {
    const productionFiles = [
      '../bex-compute-step-executor.ts',
      '../bex-field-evaluator.ts',
    ];

    for (const file of productionFiles) {
      const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
      expect(source).toContain('.documentView(');
      expect(source).not.toMatch(/\.document\s*\(/);
    }
  });

  it('reads the current event', async () => {
    const blue = createBlue();
    const stepNode = createComputeStep({
      expr: { $add: [{ $event: '/payload/amount' }, 5] },
    });
    const eventNode = blue.jsonValueToNode({
      payload: { amount: 7 },
    });
    const setup = createRealContext(blue, eventNode);
    const args = createArgs({ context: setup.context, stepNode, eventNode });

    await expect(executor.execute(args)).resolves.toBe(12);
  });

  it('preserves marker-only events in the BEX event binding', async () => {
    const blue = createBlue();
    const markerTypeBlueId = 'MyOSAllParticipantsReadyBlueId';
    const stepNode = createComputeStep({
      do: [
        {
          $return: {
            events: { $event: '/message/request' },
          },
        },
      ],
    });
    const markerEvent = new BlueNode().setType(
      new BlueNode().setReferenceBlueId(markerTypeBlueId),
    );
    const eventNode = new BlueNode().setProperties({
      message: new BlueNode().setProperties({
        request: new BlueNode().setItems([markerEvent]),
      }),
    });
    const setup = createRealContext(blue, eventNode);
    const args = createArgs({ context: setup.context, stepNode, eventNode });

    await expect(executor.execute(args)).resolves.toEqual({
      changeset: [],
      events: [{ type: { blueId: markerTypeBlueId } }],
    });
  });

  it('reads previous step results', async () => {
    const blue = createBlue();
    const stepNode = createComputeStep({
      expr: { $add: [{ $steps: 'Prepare.value' }, 8] },
    });
    const eventNode = blue.jsonValueToNode({});
    const setup = createRealContext(blue, eventNode);
    const args = createArgs({
      context: setup.context,
      stepNode,
      eventNode,
      stepResults: { Prepare: { value: 12 } },
    });

    await expect(executor.execute(args)).resolves.toBe(20);
  });

  it('executes an entry function from a referenced Compute Definition contract', async () => {
    const blue = createBlue();
    const definitionNode = bexNode({
      constants: {
        multiplier: 4,
      },
      functions: {
        calculate: {
          expr: {
            $multiply: [
              { $event: '/payload/amount' },
              { $const: 'multiplier' },
            ],
          },
        },
      },
    }).setType(
      new BlueNode().setReferenceBlueId(
        conversationBlueIds['Conversation/Compute Definition'],
      ),
    );
    const stepNode = createComputeStep({
      definition: 'mathDefinition',
      entry: 'calculate',
    });
    const eventNode = blue.jsonValueToNode({
      payload: { amount: 6 },
    });
    const setup = createRealContext(blue, eventNode);
    setup.execution
      .runtime()
      .directWrite('/contracts/mathDefinition', definitionNode);
    const args = createArgs({ context: setup.context, stepNode, eventNode });

    await expect(executor.execute(args)).resolves.toBe(24);
  });

  it('emits BEX events when enabled', async () => {
    const blue = createBlue();
    const stepNode = createComputeStep({
      do: [
        {
          $appendEvent: {
            type: 'TestEvent',
            amount: { $event: '/payload/amount' },
          },
        },
        { $return: { $events: null } },
      ],
    });
    const eventNode = blue.jsonValueToNode({
      payload: { amount: 9 },
    });
    const setup = createRealContext(blue, eventNode);
    const args = createArgs({ context: setup.context, stepNode, eventNode });

    const result = await executor.execute(args);

    expect(result).toEqual([{ amount: 9, type: 'TestEvent' }]);
    const emissions = setup.execution.runtime().rootEmissions();
    expect(emissions).toHaveLength(1);
    expect(property(emissions[0], 'amount').getValue()?.toString()).toBe('9');
  });

  it('applies a returned changeset', async () => {
    const blue = createBlue();
    const stepNode = createComputeStep({
      do: [
        {
          $appendChange: {
            op: 'replace',
            path: '/status',
            val: 'complete',
          },
        },
        { $return: { $changeset: null } },
      ],
    });
    const eventNode = blue.jsonValueToNode({});
    const setup = createRealContext(blue, eventNode);
    setup.execution
      .runtime()
      .directWrite('/status', blue.jsonValueToNode('pending'));
    const args = createArgs({ context: setup.context, stepNode, eventNode });

    const result = await executor.execute(args);

    expect(result).toEqual([
      { op: 'replace', path: '/status', val: 'complete' },
    ]);
    const document = blue.nodeToJson(
      setup.execution.runtime().document(),
      'simple',
    ) as { status?: string };
    expect(document.status).toBe('complete');
  });

  it('sequentialWorkflowReadYourWritesUsesWorkingDocumentView', async () => {
    const blue = createBlue();
    const eventNode = blue.jsonValueToNode({});
    const setup = createRealContext(blue, eventNode);
    setup.execution.runtime().directWrite('/counter', blue.jsonValueToNode(1));
    const writeStep = createComputeStep({
      do: [
        {
          $appendChange: {
            op: 'replace',
            path: '/counter',
            val: 7,
          },
        },
      ],
      returnResult: false,
    });
    const readStep = createComputeStep({
      expr: { $document: '/counter' },
    });

    await executor.execute(
      createArgs({ context: setup.context, stepNode: writeStep, eventNode }),
    );

    await expect(
      executor.execute(
        createArgs({ context: setup.context, stepNode: readStep, eventNode }),
      ),
    ).resolves.toBe(7);
  });

  it('executes against the current scope document root', async () => {
    const blue = createBlue();
    const stepNode = createComputeStep({
      do: [
        {
          $if: {
            cond: { $eq: [{ $document: '/status' }, 'pending'] },
            then: [
              {
                $appendChange: {
                  op: 'replace',
                  path: '/status',
                  val: 'complete',
                },
              },
            ],
          },
        },
        { $return: { $changeset: null } },
      ],
    });
    const eventNode = blue.jsonValueToNode({});
    const document = blue.jsonValueToNode({
      status: 'root',
      embedded: {
        status: 'pending',
      },
    });
    const setup = createRealContext(blue, eventNode, document, '/embedded');
    const args = createArgs({ context: setup.context, stepNode, eventNode });

    await executor.execute(args);

    const result = blue.nodeToJson(
      setup.execution.runtime().document(),
      'simple',
    ) as { status?: string; embedded?: { status?: string } };
    expect(result.status).toBe('root');
    expect(result.embedded?.status).toBe('complete');
  });

  it('maps BEX failures to processor fatal errors', async () => {
    const blue = createBlue();
    const stepNode = createComputeStep({
      expr: { $unknown: true },
    });
    const eventNode = blue.jsonValueToNode({});
    const setup = createRealContext(blue, eventNode);
    const args = createArgs({ context: setup.context, stepNode, eventNode });

    await expect(executor.execute(args)).rejects.toThrow(ProcessorFatalError);
  });
});
