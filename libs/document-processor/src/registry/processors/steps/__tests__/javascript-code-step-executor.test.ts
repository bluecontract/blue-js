import { describe, expect, it, vi } from 'vitest';
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

  it('returns blueId when document() path ends with /blueId', async () => {
    const blue = createBlue();
    const stepNode = createStepNode(
      blue,
      `
        const canonical = document.canonical('/propA/blueId');
        return {
          blueId: document('/propA/blueId'),
          canonical,
          canonicalValue: canonical
        };
      `,
    );
    const eventNode = blue.jsonValueToNode({});
    const { context, execution } = createRealContext(blue, eventNode);
    const propNode = new BlueNode().setName('PropA');
    const propABlueId = blue.calculateBlueIdSync(propNode);
    execution.runtime().directWrite('/propA', propNode);

    const args = createArgs({ context, stepNode, eventNode });

    const result = (await executor.execute(args)) as Record<string, unknown>;
    expect(result.blueId).toBe(propABlueId);
    expect(result.canonicalValue).toBe(propABlueId);
    expect(result.canonical).toBe(propABlueId);
  });

  it('supports special document() segments like name/description/type/value', async () => {
    const blue = createBlue();
    const stepNode = createStepNode(
      blue,
      `
        return {
          name: document('/prop/name'),
          description: document('/prop/description'),
          typeName: document('/prop/type/name'),
          value: document('/prop/value'),
          blueId: document('/prop/blueId'),
          canonical: {
            name: document.canonical('/prop/name'),
            description: document.canonical('/prop/description'),
            typeName: document.canonical('/prop/type/name'),
            value: document.canonical('/prop/value'),
            blueId: document.canonical('/prop/blueId')
          }
        };
      `,
    );
    const eventNode = blue.jsonValueToNode({});
    const { context, execution } = createRealContext(blue, eventNode);
    const propNode = new BlueNode()
      .setName('Prop A')
      .setDescription('Desc')
      .setType(new BlueNode().setName('TypeX'))
      .setValue(7);
    execution.runtime().directWrite('/prop', propNode);
    const expectedBlueId = blue.calculateBlueIdSync(propNode);

    const args = createArgs({ context, stepNode, eventNode });

    const result = (await executor.execute(args)) as Record<string, unknown>;
    expect(result).toMatchObject({
      name: 'Prop A',
      description: 'Desc',
      typeName: 'TypeX',
      value: 7,
      blueId: expectedBlueId,
      canonical: {
        name: 'Prop A',
        description: 'Desc',
        typeName: 'TypeX',
        value: 7,
        blueId: expectedBlueId,
      },
    });
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

  it('charges wasm gas usage into the gas meter', async () => {
    const blue = createBlue();
    const code = `
return 1;
    `;
    const stepNode = createStepNode(blue, code);
    const eventNode = blue.jsonValueToNode({});
    const { context } = createRealContext(blue, eventNode);
    const args = createArgs({ context, stepNode, eventNode });

    const spy = vi.spyOn(context.gasMeter(), 'chargeWasmGas');

    await executor.execute(args);

    expect(spy).toHaveBeenCalled();
    const [firstCharge] = spy.mock.calls[0] ?? [];
    expect(
      typeof firstCharge === 'bigint' ? firstCharge > 0n : firstCharge > 0,
    ).toBe(true);
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
