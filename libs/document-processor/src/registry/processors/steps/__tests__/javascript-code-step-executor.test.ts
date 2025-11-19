import { describe, expect, it } from 'vitest';
import { Blue, BlueNode } from '@blue-labs/language';

import { createBlue } from '../../../../test-support/blue.js';
import {
  createArgs,
  createRealContext,
} from '../../../../test-support/workflow.js';
import { JavaScriptCodeStepExecutor } from '../javascript-code-step-executor.js';
import { CodeBlockEvaluationError } from '../../../../util/expression/exceptions.js';
import { typeBlueId } from '../../../../__tests__/test-utils.js';
import { blueIds as conversationBlueIds } from '@blue-repository/conversation';

function createStepNode(blue: Blue, code: string): BlueNode {
  const indented = code
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
  const yaml = `type: JavaScript Code\ncode: |\n${indented}\n`;
  return blue.yamlToNode(yaml);
}

describe('JavaScriptCodeStepExecutor', () => {
  const executor = new JavaScriptCodeStepExecutor();

  it('evaluates code and returns plain result', async () => {
    const blue = createBlue();
    const stepNode = createStepNode(blue, 'return { doubled: 21 * 2 };');
    const eventNode = blue.jsonValueToNode({});
    const { context } = createRealContext(blue, eventNode);
    const args = createArgs({ context, stepNode, eventNode });

    const result = await executor.execute(args);
    expect(result).toEqual({ doubled: 42 });
  });

  it('exposes the event binding', async () => {
    const blue = createBlue();
    const stepNode = createStepNode(blue, 'return event.payload.amount * 2;');
    const eventNode = blue.jsonValueToNode({
      payload: { amount: 7 },
    });
    const { context } = createRealContext(blue, eventNode);
    const args = createArgs({ context, stepNode, eventNode });

    const result = await executor.execute(args);
    expect(result).toBe(14);
  });

  it('exposes canonical event data and canon helper utilities', async () => {
    const blue = createBlue();
    const stepNode = createStepNode(
      blue,
      `
        const canonicalId = canon.at(eventCanonical, '/payload/id');
        return {
          plain: event.payload.id,
          canonicalWrapped: canonicalId,
          canonicalValue: canonicalId?.value,
          unwrapped: canon.unwrap(canonicalId)
        };
      `,
    );
    const eventNode = blue.jsonValueToNode({
      payload: { id: 'evt-123' },
    });
    const { context } = createRealContext(blue, eventNode);
    const args = createArgs({ context, stepNode, eventNode });

    const result = (await executor.execute(args)) as Record<string, unknown>;
    expect(result.plain).toBe('evt-123');
    expect(result.unwrapped).toBe(result.plain);
    expect(result.canonicalValue).toBe('evt-123');
    expect(result.canonicalWrapped).toMatchObject({ value: 'evt-123' });
  });

  it('provides access to documents via document()', async () => {
    const blue = createBlue();
    const stepNode = createStepNode(blue, 'return document("/counter") * 3;');
    const eventNode = blue.jsonValueToNode({});
    const { context, execution } = createRealContext(blue, eventNode);
    execution.runtime().directWrite('/counter', blue.jsonValueToNode(5));

    const args = createArgs({ context, stepNode, eventNode });

    const result = await executor.execute(args);
    expect(result).toBe(15);
  });

  it('exposes canonical document snapshots alongside plain values', async () => {
    const blue = createBlue();
    const stepNode = createStepNode(
      blue,
      `
        const canonical = document.canonical('/counter');
        return {
          plain: document('/counter'),
          normalized: document('counter'),
          canonicalWrapped: canonical,
          canonicalValue: canonical?.value,
          unwrapped: canon.unwrap(canonical),
          missingPlain: document('/missing'),
          missingCanonical: document.canonical('/missing')
        };
      `,
    );
    const eventNode = blue.jsonValueToNode({});
    const { context, execution } = createRealContext(blue, eventNode);
    execution.runtime().directWrite('/counter', blue.jsonValueToNode(5));

    const args = createArgs({ context, stepNode, eventNode });

    const result = (await executor.execute(args)) as Record<string, unknown>;
    expect(result.plain).toBe(5);
    expect(result.normalized).toBe(5);
    expect(result.unwrapped).toBe(result.plain);
    expect(result.canonicalValue).toBe(5);
    expect(result.canonicalWrapped).toMatchObject({ value: 5 });
    expect(result.missingPlain).toBeUndefined();
    expect(result.missingCanonical).toBeUndefined();
  });

  it('provides previous step results', async () => {
    const blue = createBlue();
    const stepNode = createStepNode(blue, 'return steps.Compute.value + 8;');
    const eventNode = blue.jsonValueToNode({});
    const { context } = createRealContext(blue, eventNode);
    const args = createArgs({
      context,
      stepNode,
      eventNode,
      stepResults: { Compute: { value: 12 } },
    });

    const result = await executor.execute(args);
    expect(result).toBe(20);
  });

  it('supports async/await expressions', async () => {
    const blue = createBlue();
    const stepNode = createStepNode(
      blue,
      'const value = await Promise.resolve(11); return value;',
    );
    const eventNode = blue.jsonValueToNode({});
    const { context } = createRealContext(blue, eventNode);
    const args = createArgs({ context, stepNode, eventNode });

    const result = await executor.execute(args);
    expect(result).toBe(11);
  });

  it('emits events included in the result payload', async () => {
    const blue = createBlue();
    const stepNode = createStepNode(
      blue,
      `return {
        status: 'done',
        events: [
          {
            type: "Chat Message",
            message: "Workflow finished"
          }
        ]
      };`,
    );
    const eventNode = blue.jsonValueToNode({});
    const { context, execution } = createRealContext(blue, eventNode);
    const args = createArgs({ context, stepNode, eventNode });

    const result = await executor.execute(args);
    expect(result).toMatchObject({ status: 'done' });

    const emitted = execution.runtime().rootEmissions();
    expect(emitted).toHaveLength(1);
    const emittedEvent = emitted[0];
    expect(typeBlueId(emittedEvent)).toBe(conversationBlueIds['Chat Message']);
    const message = emittedEvent.getProperties()?.message?.getValue();
    expect(message).toBe('Workflow finished');
  });

  it('wraps thrown errors in CodeBlockEvaluationError', async () => {
    const blue = createBlue();
    const stepNode = createStepNode(blue, 'throw new Error("boom");');
    const eventNode = blue.jsonValueToNode({});
    const { context } = createRealContext(blue, eventNode);
    const args = createArgs({ context, stepNode, eventNode });

    await expect(executor.execute(args)).rejects.toThrow(
      CodeBlockEvaluationError,
    );
  });

  it('enforces execution timeout for runaway code', async () => {
    const blue = createBlue();
    const stepNode = createStepNode(blue, 'while (true) {}');
    const eventNode = blue.jsonValueToNode({});
    const { context } = createRealContext(blue, eventNode);
    const args = createArgs({
      context,
      stepNode,
      eventNode,
    });

    await expect(executor.execute(args)).rejects.toThrow(
      CodeBlockEvaluationError,
    );
  });

  it('does not expose Date for deterministic execution', async () => {
    const blue = createBlue();
    const stepNode = createStepNode(blue, 'return typeof Date;');
    const eventNode = blue.jsonValueToNode({});
    const { context } = createRealContext(blue, eventNode);
    const args = createArgs({ context, stepNode, eventNode });

    const result = await executor.execute(args);
    expect(result).toBe('undefined');
  });

  it('does not expose Node.js process global', async () => {
    const blue = createBlue();
    const stepNode = createStepNode(blue, 'return typeof process;');
    const eventNode = blue.jsonValueToNode({});
    const { context } = createRealContext(blue, eventNode);
    const args = createArgs({ context, stepNode, eventNode });

    const result = await executor.execute(args);
    expect(result).toBe('undefined');
  });
});
