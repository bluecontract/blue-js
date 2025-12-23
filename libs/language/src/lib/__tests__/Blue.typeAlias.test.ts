import { describe, expect, it } from 'vitest';
import { createBlueInstance, ids } from './repositoryVersioning/fixtures';
import { BlueNode } from '../model';
import {
  BOOLEAN_TYPE_BLUE_ID,
  DICTIONARY_TYPE_BLUE_ID,
  DOUBLE_TYPE_BLUE_ID,
  INTEGER_TYPE_BLUE_ID,
  LIST_TYPE_BLUE_ID,
  TEXT_TYPE_BLUE_ID,
} from '../utils/Properties';

describe('Blue.getTypeAlias', () => {
  it('returns bare names for core primitives (by BlueId)', () => {
    const blue = createBlueInstance();

    expect(blue.getTypeAlias(TEXT_TYPE_BLUE_ID)).toEqual('Text');
    expect(blue.getTypeAlias(INTEGER_TYPE_BLUE_ID)).toEqual('Integer');
    expect(blue.getTypeAlias(DOUBLE_TYPE_BLUE_ID)).toEqual('Double');
    expect(blue.getTypeAlias(BOOLEAN_TYPE_BLUE_ID)).toEqual('Boolean');
    expect(blue.getTypeAlias(LIST_TYPE_BLUE_ID)).toEqual('List');
    expect(blue.getTypeAlias(DICTIONARY_TYPE_BLUE_ID)).toEqual('Dictionary');
  });

  it('returns canonical package-prefixed aliases for repository types (by current BlueId)', () => {
    const blue = createBlueInstance();

    expect(blue.getTypeAlias(ids.policyCurrent)).toEqual('myos/Policy');
    expect(blue.getTypeAlias(ids.ruleCurrent)).toEqual('myos/Rule');
    expect(blue.getTypeAlias(ids.externalType)).toEqual('other/ExternalType');
  });

  it('maps historical BlueIds to the current canonical alias', () => {
    const blue = createBlueInstance();

    expect(blue.getTypeAlias(ids.policyHistoric)).toEqual('myos/Policy');
    expect(blue.getTypeAlias(ids.ruleHistoric)).toEqual('myos/Rule');
  });

  it('returns undefined for unknown BlueIds', () => {
    const blue = createBlueInstance();
    expect(blue.getTypeAlias('unknown-blue-id')).toBeUndefined();
  });

  it('resolves alias for type nodes backed by BlueId', () => {
    const blue = createBlueInstance();

    expect(blue.getTypeAlias(new BlueNode().setBlueId(ids.policyCurrent))).toBe(
      'myos/Policy',
    );
    expect(
      blue.getTypeAlias(new BlueNode().setBlueId(ids.policyHistoric)),
    ).toBe('myos/Policy');
  });

  it('resolves alias for inline primitive type nodes (pre-preprocess shape)', () => {
    const blue = createBlueInstance();

    const textTypeNode = new BlueNode().setType('Text').getType()!;
    expect(textTypeNode.isInlineValue()).toBe(true);
    expect(blue.getTypeAlias(textTypeNode)).toEqual('Text');
  });

  it('resolves alias for inline package-prefixed alias type nodes (pre-preprocess shape)', () => {
    const blue = createBlueInstance();

    const policyTypeNode = new BlueNode().setType('myos/Policy').getType()!;
    expect(policyTypeNode.isInlineValue()).toBe(true);
    expect(blue.getTypeAlias(policyTypeNode)).toEqual('myos/Policy');
  });

  it('returns inline alias value even if it is not registered', () => {
    const blue = createBlueInstance();

    const unknownTypeNode = new BlueNode()
      .setType('myos/DoesNotExist')
      .getType()!;
    expect(unknownTypeNode.isInlineValue()).toBe(true);
    expect(blue.getTypeAlias(unknownTypeNode)).toEqual('myos/DoesNotExist');
  });

  it('returns undefined for empty type nodes', () => {
    const blue = createBlueInstance();
    expect(blue.getTypeAlias(new BlueNode())).toBeUndefined();
  });

  it('returns undefined for missing type reference', () => {
    const blue = createBlueInstance();
    expect(blue.getTypeAlias(undefined)).toBeUndefined();
  });
});
