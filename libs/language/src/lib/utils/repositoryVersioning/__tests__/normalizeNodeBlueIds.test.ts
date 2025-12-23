import { describe, expect, it } from 'vitest';
import { BlueNode } from '../../../model';
import { normalizeNodeBlueIds } from '../normalizeNodeBlueIds';
import type { BlueIdMapper } from '../../../types/BlueIdMapper';
import { TEXT_TYPE_BLUE_ID } from '../../../utils/Properties';

describe('normalizeNodeBlueIds', () => {
  it('returns the same node when no mapper is provided', () => {
    const node = new BlueNode().setType(new BlueNode().setBlueId('old-id'));

    const normalized = normalizeNodeBlueIds(node);

    expect(normalized).toBe(node);
  });

  it('maps type references recursively', () => {
    const mapping: Record<string, string> = {
      'old-root': 'new-root',
      'old-item': 'new-item',
      'old-key': 'new-key',
      'old-value': 'new-value',
      'old-child': 'new-child',
    };
    const mapper: BlueIdMapper = {
      toCurrentBlueId: (blueId) => mapping[blueId] ?? blueId,
    };

    const node = new BlueNode().setType(new BlueNode().setBlueId('old-root'));
    node.setItemType(new BlueNode().setBlueId('old-item'));
    node.setKeyType(new BlueNode().setBlueId('old-key'));
    node.setValueType(new BlueNode().setBlueId('old-value'));
    node.setProperties({
      child: new BlueNode().setType(new BlueNode().setBlueId('old-child')),
    });

    const normalized = normalizeNodeBlueIds(node, mapper);

    expect(normalized).not.toBe(node);
    expect(normalized.getType()?.getBlueId()).toEqual('new-root');
    expect(normalized.getItemType()?.getBlueId()).toEqual('new-item');
    expect(normalized.getKeyType()?.getBlueId()).toEqual('new-key');
    expect(normalized.getValueType()?.getBlueId()).toEqual('new-value');
    expect(normalized.getProperties()?.child?.getType()?.getBlueId()).toEqual(
      'new-child',
    );

    expect(node.getType()?.getBlueId()).toEqual('old-root');
    expect(node.getItemType()?.getBlueId()).toEqual('old-item');
    expect(node.getKeyType()?.getBlueId()).toEqual('old-key');
    expect(node.getValueType()?.getBlueId()).toEqual('old-value');
    expect(node.getProperties()?.child?.getType()?.getBlueId()).toEqual(
      'old-child',
    );
  });

  it('skips inline type nodes', () => {
    const mapper: BlueIdMapper = {
      toCurrentBlueId: () => 'mapped',
    };

    const node = new BlueNode().setType('Text');
    const normalized = normalizeNodeBlueIds(node, mapper);

    const typeNode = normalized.getType();
    expect(typeNode?.isInlineValue()).toBe(true);
    expect(typeNode?.getValue()).toBe('Text');
  });

  it('leaves type nodes without BlueIds unchanged', () => {
    const mapper: BlueIdMapper = {
      toCurrentBlueId: () => 'mapped',
    };

    const typeNode = new BlueNode().setName('CustomType');
    const node = new BlueNode().setType(typeNode);
    const normalized = normalizeNodeBlueIds(node, mapper);

    expect(normalized.getType()?.getBlueId()).toBeUndefined();
    expect(normalized.getType()?.getName()).toEqual('CustomType');
  });

  it('keeps primitive BlueIds when mapper returns the same value', () => {
    const mapper: BlueIdMapper = {
      toCurrentBlueId: (blueId) =>
        blueId === TEXT_TYPE_BLUE_ID ? blueId : 'mapped',
    };

    const node = new BlueNode()
      .setType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID))
      .setValue('sample');
    const normalized = normalizeNodeBlueIds(node, mapper);

    expect(normalized.getType()?.getBlueId()).toEqual(TEXT_TYPE_BLUE_ID);
    expect(normalized.getValue()).toEqual('sample');
  });
});
