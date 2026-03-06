/*
Java references:
- references/java-sdk/src/main/java/blue/language/sdk/DocBuilder.java
- references/java-sdk/src/main/java/blue/language/sdk/internal/StepsBuilder.java
*/

import { BlueNode, withTypeBlueId } from '@blue-labs/language';
import { z } from 'zod';
import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';

import { DocBuilder } from '../lib';
import {
  getPointerNode,
  normalizeRequiredPointer,
  removePointer,
  writePointer,
} from '../lib/internal/pointer';
import { resolveTypeInput } from '../lib/internal/type-input';

describe('DocBuilder core helpers', () => {
  it('wraps expressions without double wrapping', () => {
    expect(DocBuilder.expr('x')).toBe('${x}');
    expect(DocBuilder.expr('${x}')).toBe('${x}');
  });

  it('resolves string, blueId object, BlueNode and annotated zod schemas as type inputs', () => {
    const aliasType = resolveTypeInput('Integer');
    const customAliasType = resolveTypeInput('Custom/Type');
    const blueIdType = resolveTypeInput({
      blueId: conversationBlueIds['Conversation/Event'],
    });
    const nodeType = resolveTypeInput(new BlueNode().setBlueId('Custom/Type'));
    const schema = withTypeBlueId(conversationBlueIds['Conversation/Event'])(
      z.object({}),
    );
    const schemaType = resolveTypeInput(schema);

    expect(aliasType.getBlueId()).toBeDefined();
    expect(customAliasType.getValue()).toBe('Custom/Type');
    expect(customAliasType.isInlineValue()).toBe(true);
    expect(blueIdType.getBlueId()).toBe(
      conversationBlueIds['Conversation/Event'],
    );
    expect(nodeType.getBlueId()).toBe('Custom/Type');
    expect(schemaType.getBlueId()).toBe(
      conversationBlueIds['Conversation/Event'],
    );
  });

  it('throws for a zod schema without a typeBlueId annotation', () => {
    expect(() => resolveTypeInput(z.object({}))).toThrowError(
      /typeBlueId annotation/i,
    );
  });

  it('writes and removes pointers, including escaped segments and arrays', () => {
    const document = new BlueNode();

    writePointer(
      document,
      normalizeRequiredPointer('/items/0/name', 'pointer'),
      new BlueNode().setValue('Alice'),
    );
    writePointer(
      document,
      normalizeRequiredPointer('/a~1b/~0key', 'pointer'),
      new BlueNode().setValue(7),
    );

    expect(getPointerNode(document, '/items/0/name')?.getValue()).toBe('Alice');
    expect(String(getPointerNode(document, '/a~1b/~0key')?.getValue())).toBe(
      '7',
    );

    removePointer(document, '/items/0/name');
    expect(getPointerNode(document, '/items/0/name')).toBeNull();
  });

  it('rejects root writes and removes', () => {
    const document = new BlueNode();

    expect(() => writePointer(document, '/', new BlueNode())).toThrowError(
      /cannot target root/i,
    );
    expect(() => removePointer(document, '/')).toThrowError(
      /cannot target root/i,
    );
  });

  it('replaces and removes document fields through the public builder', () => {
    const document = DocBuilder.doc()
      .field('/counter', 1)
      .replace('/counter', 2)
      .remove('/counter')
      .buildDocument();

    expect(getPointerNode(document, '/counter')).toBeNull();
  });
});
