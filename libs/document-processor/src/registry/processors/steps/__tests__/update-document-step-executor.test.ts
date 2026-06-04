import { describe, expect, it } from 'vitest';

import { createBlue } from '../../../../test-support/blue.js';
import {
  createArgs,
  createRealContext,
} from '../../../../test-support/workflow.js';
import { UpdateDocumentStepExecutor } from '../update-document-step-executor.js';
import { ProcessorFatalError } from '../../../../engine/processor-fatal-error.js';

describe('UpdateDocumentStepExecutor', () => {
  const executor = new UpdateDocumentStepExecutor();

  it('applies replace operation with static value', async () => {
    const blue = createBlue();
    const stepNode = blue.yamlToNode(`type: Conversation/Update Document
changeset:
  - op: REPLACE
    path: /amount
    val: 8
`);
    const eventNode = blue.jsonValueToNode({});
    const setup = createRealContext(blue, eventNode);
    setup.execution.runtime().directWrite('/amount', blue.jsonValueToNode(4));
    const args = createArgs({ context: setup.context, stepNode, eventNode });

    await executor.execute(args);

    const result = setup.context.blue.nodeToJson(
      setup.execution.runtime().document(),
      'simple',
    ) as { amount?: number };
    expect(result.amount).toBe(8);
  });

  it('adds a new value with ADD operation', async () => {
    const blue = createBlue();
    const stepNode = blue.yamlToNode(`type: Conversation/Update Document
changeset:
  - op: ADD
    path: /items/-
    val: new
`);
    const eventNode = blue.jsonValueToNode({});
    const setup = createRealContext(blue, eventNode);
    setup.execution
      .runtime()
      .directWrite('/items', blue.jsonValueToNode(['first']));
    const args = createArgs({ context: setup.context, stepNode, eventNode });

    await executor.execute(args);

    const result = setup.context.blue.nodeToJson(
      setup.execution.runtime().document(),
      'simple',
    ) as { items?: unknown[] };
    expect(result.items).toEqual(['first', 'new']);
  });

  it('removes a value with REMOVE operation', async () => {
    const blue = createBlue();
    const stepNode = blue.yamlToNode(`type: Conversation/Update Document
changeset:
  - op: REMOVE
    path: /flag
`);
    const eventNode = blue.jsonValueToNode({});
    const setup = createRealContext(blue, eventNode);
    setup.execution.runtime().directWrite('/flag', blue.jsonValueToNode(true));
    const args = createArgs({ context: setup.context, stepNode, eventNode });

    await executor.execute(args);

    const result = setup.context.blue.nodeToJson(
      setup.execution.runtime().document(),
      'simple',
    ) as { flag?: unknown };
    expect(result.flag).toBeUndefined();
  });

  it('evaluates BEX path expressions', async () => {
    const blue = createBlue();
    const stepNode = blue.yamlToNode(`type: Conversation/Update Document
changeset:
    - op: REPLACE
      path:
        $event: /payload/target
      val: updated
`);
    const eventNode = blue.jsonValueToNode({
      payload: { target: '/status' },
    });
    const setup = createRealContext(blue, eventNode);
    setup.execution
      .runtime()
      .directWrite('/status', blue.jsonValueToNode('initial'));
    const args = createArgs({ context: setup.context, stepNode, eventNode });

    await executor.execute(args);

    const result = setup.context.blue.nodeToJson(
      setup.execution.runtime().document(),
      'simple',
    ) as { status?: string };
    expect(result.status).toBe('updated');
  });

  it('supports BEX path composition', async () => {
    const blue = createBlue();
    const stepNode = blue.yamlToNode(`type: Conversation/Update Document
changeset:
    - op: REPLACE
      path:
        $concat:
          - /items/
          - $event: /payload/index
      val: selected
`);
    const eventNode = blue.jsonValueToNode({ payload: { index: 1 } });
    const setup = createRealContext(blue, eventNode);
    setup.execution
      .runtime()
      .directWrite('/items', blue.jsonValueToNode(['first', 'second']));
    const args = createArgs({ context: setup.context, stepNode, eventNode });

    await executor.execute(args);

    const result = setup.context.blue.nodeToJson(
      setup.execution.runtime().document(),
      'simple',
    ) as { items?: unknown[] };
    expect(result.items).toEqual(['first', 'selected']);
  });

  it('evaluates BEX value expressions', async () => {
    const blue = createBlue();
    const stepNode = blue.yamlToNode(`type: Conversation/Update Document
changeset:
    - op: REPLACE
      path: /total
      val:
        $multiply:
          - $event: /payload/amount
          - 2
`);
    const eventNode = blue.jsonValueToNode({ payload: { amount: 9 } });
    const setup = createRealContext(blue, eventNode);
    setup.execution.runtime().directWrite('/total', blue.jsonValueToNode(0));
    const args = createArgs({ context: setup.context, stepNode, eventNode });

    await executor.execute(args);

    const result = setup.context.blue.nodeToJson(
      setup.execution.runtime().document(),
      'simple',
    ) as { total?: number };
    expect(result.total).toBe(18);
  });

  it('resolves BEX text composition in value', async () => {
    const blue = createBlue();
    const stepNode = blue.yamlToNode(`type: Conversation/Update Document
changeset:
    - op: REPLACE
      path: /message
      val:
        $concat:
          - "Hello "
          - $event: /payload/name
`);
    const eventNode = blue.jsonValueToNode({ payload: { name: 'Taylor' } });
    const setup = createRealContext(blue, eventNode);
    setup.execution.runtime().directWrite('/message', blue.jsonValueToNode(''));
    const args = createArgs({ context: setup.context, stepNode, eventNode });

    await executor.execute(args);

    const result = setup.context.blue.nodeToJson(
      setup.execution.runtime().document(),
      'simple',
    ) as { message?: string };
    expect(result.message).toBe('Hello Taylor');
  });

  it('evaluates BEX values inside changesets', async () => {
    const blue = createBlue();
    const stepNode = blue.yamlToNode(`type: Conversation/Update Document
changeset:
    - op: REPLACE
      path: /flag
      val:
        $event: /payload/flag
`);
    const eventNode = blue.jsonValueToNode({ payload: { flag: 'yep' } });
    const setup = createRealContext(blue, eventNode);
    setup.execution
      .runtime()
      .directWrite('/flag', blue.jsonValueToNode('nope'));
    const args = createArgs({ context: setup.context, stepNode, eventNode });

    await executor.execute(args);

    const result = setup.context.blue.nodeToJson(
      setup.execution.runtime().document(),
      'simple',
    ) as { flag?: string };
    expect(result.flag).toBe('yep');
  });

  it('exposes previous step results to BEX', async () => {
    const blue = createBlue();
    const stepNode = blue.yamlToNode(`type: Conversation/Update Document
changeset:
    - op: REPLACE
      path: /outcome
      val:
        $add:
          - $steps: Compute.value
          - 5
`);
    const eventNode = blue.jsonValueToNode({});
    const setup = createRealContext(blue, eventNode);
    setup.execution.runtime().directWrite('/outcome', blue.jsonValueToNode(0));
    const args = createArgs({
      context: setup.context,
      stepNode,
      eventNode,
      stepResults: { Compute: { value: 7 } },
    });

    await executor.execute(args);

    const result = setup.context.blue.nodeToJson(
      setup.execution.runtime().document(),
      'simple',
    ) as { outcome?: number };
    expect(result.outcome).toBe(12);
  });

  it('allows reading document state from BEX', async () => {
    const blue = createBlue();
    const stepNode = blue.yamlToNode(`type: Conversation/Update Document
changeset:
    - op: REPLACE
      path: /next
      val:
        $add:
          - $document: /current
          - $event: /payload/delta
`);
    const eventNode = blue.jsonValueToNode({ payload: { delta: 3 } });
    const setup = createRealContext(blue, eventNode);
    setup.execution.runtime().directWrite('/current', blue.jsonValueToNode(7));
    setup.execution.runtime().directWrite('/next', blue.jsonValueToNode(0));
    const args = createArgs({ context: setup.context, stepNode, eventNode });

    await executor.execute(args);

    const result = setup.context.blue.nodeToJson(
      setup.execution.runtime().document(),
      'simple',
    ) as { next?: number };
    expect(result.next).toBe(10);
  });

  it('throws a fatal error when the step schema is invalid', async () => {
    const blue = createBlue();
    const stepNode = blue.yamlToNode(`type: Conversation/Compute
expr: 1
`);
    const eventNode = blue.jsonValueToNode({});
    const setup = createRealContext(blue, eventNode);
    const args = createArgs({ context: setup.context, stepNode, eventNode });

    await expect(executor.execute(args)).rejects.toThrow(ProcessorFatalError);
  });

  it('throws fatal errors for invalid evaluated paths', async () => {
    const blue = createBlue();
    const stepNode = blue.yamlToNode(`type: Conversation/Update Document
changeset:
    - op: REPLACE
      path:
        $binding: doesNotExist/value
      val: hi
`);
    const eventNode = blue.jsonValueToNode({});
    const setup = createRealContext(blue, eventNode);
    const args = createArgs({ context: setup.context, stepNode, eventNode });

    await expect(executor.execute(args)).rejects.toThrow(ProcessorFatalError);
  });

  it('throws fatal error for unsupported operations', async () => {
    const blue = createBlue();
    const stepNode = blue.yamlToNode(`type: Conversation/Update Document
changeset:
  - op: UPSERT
    path: /value
    val: nope
`);
    const eventNode = blue.jsonValueToNode({});
    const setup = createRealContext(blue, eventNode);
    const args = createArgs({ context: setup.context, stepNode, eventNode });

    await expect(executor.execute(args)).rejects.toThrow(ProcessorFatalError);
  });
});
