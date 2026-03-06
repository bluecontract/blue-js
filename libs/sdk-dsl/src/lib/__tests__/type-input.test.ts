/**
 * Java reference:
 * - references/java-sdk/src/main/java/blue/language/sdk/DocBuilder.java
 * - references/java-sdk/src/main/java/blue/language/sdk/internal/StepsBuilder.java
 */
import { BlueNode, withTypeBlueId } from '@blue-labs/language';
import { z } from 'zod';

import { resolveTypeInput } from '../internal/type-input.js';
import { createTestBlue } from '../test-support/create-blue.js';

describe('type input resolution', () => {
  const blue = createTestBlue();

  it('resolves known string aliases to repository-backed type nodes', () => {
    const typeNode = resolveTypeInput('Integer');

    expect(typeNode.getBlueId()).toBe(
      blue.yamlToNode('type: Integer').getType()?.getBlueId(),
    );
  });

  it('preserves unknown string aliases as inline values', () => {
    const typeNode = resolveTypeInput('Custom/Unknown Type');

    expect(typeNode.getValue()).toBe('Custom/Unknown Type');
    expect(typeNode.isInlineValue()).toBe(true);
  });

  it('resolves blueId-like inputs to blueId type nodes', () => {
    const typeNode = resolveTypeInput({ blueId: 'Conversation/Event' });

    expect(typeNode.getBlueId()).toBe('Conversation/Event');
  });

  it('clones blue node type inputs', () => {
    const original = new BlueNode().setBlueId('Custom/Type');

    const typeNode = resolveTypeInput(original);

    expect(typeNode).not.toBe(original);
    expect(typeNode.getBlueId()).toBe('Custom/Type');
  });

  it('resolves zod schemas with typeBlueId annotations', () => {
    const schema = withTypeBlueId('Annotated/Type')(
      z.object({
        amount: z.number(),
      }),
    );

    const typeNode = resolveTypeInput(schema);

    expect(typeNode.getBlueId()).toBe('Annotated/Type');
  });

  it('throws for unsupported inputs', () => {
    expect(() => resolveTypeInput({ bad: true } as never)).toThrow(
      'Unsupported type input.',
    );
  });
});
