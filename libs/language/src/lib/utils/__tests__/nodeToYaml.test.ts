import { describe, expect, it } from 'vitest';
import { BlueNode, BigIntegerNumber } from '../../model';
import { NodeToYaml } from '../NodeToYaml';

describe('nodeToYaml', () => {
  it('preserves property insertion order from NodeToMapListOrValue', () => {
    const nodeA = new BlueNode()
      .setDescription('desc')
      .setName('Example')
      .setType(new BlueNode().setValue('Text'))
      .addProperty('zeta', new BlueNode().setValue('Z'))
      .addProperty('alpha', new BlueNode().setValue('A'))
      .addProperty(
        'list',
        new BlueNode().setItems([
          new BlueNode()
            .addProperty('flag', new BlueNode().setValue(true))
            .addProperty('count', new BlueNode().setValue(3)),
          new BlueNode().setValue('item2'),
        ]),
      )
      .addProperty(
        'nested',
        new BlueNode()
          .addProperty('beta', new BlueNode().setValue('B'))
          .addProperty('aardvark', new BlueNode().setValue('Aard')),
      )
      .addProperty('numberProp', new BlueNode().setValue(12.5));

    const nodeB = new BlueNode()
      .setDescription('desc')
      .setName('Example')
      .setType(new BlueNode().setValue('Text'))
      .addProperty('alpha', new BlueNode().setValue('A'))
      .addProperty(
        'list',
        new BlueNode().setItems([
          new BlueNode().setValue('item2'),
          new BlueNode()
            .addProperty('count', new BlueNode().setValue(3))
            .addProperty('flag', new BlueNode().setValue(true)),
        ]),
      )
      .addProperty('zeta', new BlueNode().setValue('Z'))
      .addProperty(
        'nested',
        new BlueNode()
          .addProperty('aardvark', new BlueNode().setValue('Aard'))
          .addProperty('beta', new BlueNode().setValue('B')),
      )
      .addProperty('numberProp', new BlueNode().setValue(12.5));

    expect(NodeToYaml.get(nodeA)).toMatchInlineSnapshot(`
      "name: Example
      description: desc
      type:
        type:
          blueId: DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K
        value: Text
      zeta:
        type:
          blueId: DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K
        value: Z
      alpha:
        type:
          blueId: DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K
        value: A
      list:
        items:
          - flag:
              type:
                blueId: 4EzhSubEimSQD3zrYHRtobfPPWntUuhEz8YcdxHsi12u
              value: true
            count:
              type:
                blueId: 5WNMiV9Knz63B4dVY5JtMyh3FB4FSGqv7ceScvuapdE1
              value: 3
          - type:
              blueId: DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K
            value: item2
      nested:
        beta:
          type:
            blueId: DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K
          value: B
        aardvark:
          type:
            blueId: DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K
          value: Aard
      numberProp:
        type:
          blueId: 7pwXmXYCJtWnd348c2JQGBkm9C4renmZRwxbfaypsx5y
        value: 12.5
      "
    `);

    expect(NodeToYaml.get(nodeB)).toMatchInlineSnapshot(`
      "name: Example
      description: desc
      type:
        type:
          blueId: DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K
        value: Text
      alpha:
        type:
          blueId: DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K
        value: A
      list:
        items:
          - type:
              blueId: DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K
            value: item2
          - count:
              type:
                blueId: 5WNMiV9Knz63B4dVY5JtMyh3FB4FSGqv7ceScvuapdE1
              value: 3
            flag:
              type:
                blueId: 4EzhSubEimSQD3zrYHRtobfPPWntUuhEz8YcdxHsi12u
              value: true
      zeta:
        type:
          blueId: DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K
        value: Z
      nested:
        aardvark:
          type:
            blueId: DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K
          value: Aard
        beta:
          type:
            blueId: DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K
          value: B
      numberProp:
        type:
          blueId: 7pwXmXYCJtWnd348c2JQGBkm9C4renmZRwxbfaypsx5y
        value: 12.5
      "
    `);
  });

  it('handles big numbers using yamlBlue semantics', () => {
    const node = new BlueNode().addProperty(
      'bigInt',
      new BlueNode().setValue(
        new BigIntegerNumber('1234567890123456789012345678901234567890'),
      ),
    );

    const yaml = NodeToYaml.get(node);

    expect(yaml).toContain(
      'blueId: 5WNMiV9Knz63B4dVY5JtMyh3FB4FSGqv7ceScvuapdE1',
    );
    expect(yaml).toContain("value: '1234567890123456789012345678901234567890'");
  });

  it('respects strategy when delegating through nodeToJson', () => {
    const node = new BlueNode().setValue('abc');

    expect(NodeToYaml.get(node, { strategy: 'simple' })).toBe('abc\n');
    expect(NodeToYaml.get(node, { strategy: 'official' }))
      .toMatchInlineSnapshot(`
      "type:
        blueId: DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K
      value: abc
      "
    `);
  });
});
