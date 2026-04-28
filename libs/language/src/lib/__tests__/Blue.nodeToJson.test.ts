import { describe, expect, it } from 'vitest';
import { Blue } from '../Blue';
import { BlueNode } from '../model';

describe('Blue.nodeToJson', () => {
  it('does not emit mixed blueId plus payload by default', () => {
    const blue = new Blue();
    const node = new BlueNode()
      .setBlueId('MaterializedId')
      .setName('Materialized')
      .setValue('payload');

    expect(blue.nodeToJson(node)).toEqual({
      name: 'Materialized',
      type: { blueId: 'DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K' },
      value: 'payload',
    });
  });

  it('emits blueId for exact references in reference-only mode', () => {
    const blue = new Blue();

    expect(blue.nodeToJson(new BlueNode().setBlueId('ExactReference'))).toEqual(
      {
        blueId: 'ExactReference',
      },
    );
  });

  it('can emit runtime materialized blueId metadata in debug mode', () => {
    const blue = new Blue();
    const node = new BlueNode()
      .setBlueId('MaterializedId')
      .setName('Materialized')
      .setValue('payload');

    expect(blue.nodeToJson(node, { blueIdMode: 'runtimeDebug' })).toEqual({
      name: 'Materialized',
      type: { blueId: 'DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K' },
      value: 'payload',
      blueId: 'MaterializedId',
    });
  });
});
