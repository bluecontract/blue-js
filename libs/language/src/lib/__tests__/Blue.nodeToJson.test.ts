import { describe, expect, it } from 'vitest';
import { Blue } from '../Blue';
import { BlueNode } from '../model';

describe('Blue.nodeToJson', () => {
  it('preserves materialized blueId plus payload by default', () => {
    const blue = new Blue();
    const node = new BlueNode()
      .setBlueId('MaterializedId')
      .setName('Materialized')
      .setValue('payload');

    expect(blue.nodeToJson(node)).toEqual({
      name: 'Materialized',
      type: { blueId: 'DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K' },
      value: 'payload',
      blueId: 'MaterializedId',
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

  it('preserves materialized blueId plus payload through options form', () => {
    const blue = new Blue();
    const node = new BlueNode()
      .setBlueId('MaterializedId')
      .setName('Materialized')
      .setValue('payload');

    expect(blue.nodeToJson(node, { format: 'official' })).toEqual({
      name: 'Materialized',
      type: { blueId: 'DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K' },
      value: 'payload',
      blueId: 'MaterializedId',
    });
  });
});
