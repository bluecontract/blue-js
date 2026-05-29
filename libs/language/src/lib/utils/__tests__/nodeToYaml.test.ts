import { describe, expect, it } from 'vitest';
import { BlueNode, BigIntegerNumber } from '../../model';
import { NodeToYaml } from '../NodeToYaml';
import { INTEGER_TYPE_BLUE_ID } from '../Properties';

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
          blueId: GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC
        value: Text
      zeta:
        type:
          blueId: GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC
        value: Z
      alpha:
        type:
          blueId: GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC
        value: A
      list:
        items:
          - flag:
              type:
                blueId: AwvXD961fmnmqcSQhjMA7r15HpVh39cefb6ZTyUz2Fm2
              value: true
            count:
              type:
                blueId: E2LM6qgzWG9ttagq2xTmiZkgYEAgkYedFCmU9v7NnVEq
              value: 3
          - type:
              blueId: GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC
            value: item2
      nested:
        beta:
          type:
            blueId: GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC
          value: B
        aardvark:
          type:
            blueId: GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC
          value: Aard
      numberProp:
        type:
          blueId: 9eWaHYz2vKrFofdHTHAizNNu8xP6QE3WQ5y7DGrGZvyJ
        value: 12.5
      "
    `);

    expect(NodeToYaml.get(nodeB)).toMatchInlineSnapshot(`
      "name: Example
      description: desc
      type:
        type:
          blueId: GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC
        value: Text
      alpha:
        type:
          blueId: GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC
        value: A
      list:
        items:
          - type:
              blueId: GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC
            value: item2
          - count:
              type:
                blueId: E2LM6qgzWG9ttagq2xTmiZkgYEAgkYedFCmU9v7NnVEq
              value: 3
            flag:
              type:
                blueId: AwvXD961fmnmqcSQhjMA7r15HpVh39cefb6ZTyUz2Fm2
              value: true
      zeta:
        type:
          blueId: GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC
        value: Z
      nested:
        aardvark:
          type:
            blueId: GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC
          value: Aard
        beta:
          type:
            blueId: GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC
          value: B
      numberProp:
        type:
          blueId: 9eWaHYz2vKrFofdHTHAizNNu8xP6QE3WQ5y7DGrGZvyJ
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

    expect(yaml).toContain(`blueId: ${INTEGER_TYPE_BLUE_ID}`);
    expect(yaml).toContain("value: '1234567890123456789012345678901234567890'");
  });

  it('preserves materialized blueId output by default', () => {
    const node = new BlueNode()
      .setBlueId('RuntimeId')
      .setName('Materialized')
      .setValue('payload');

    expect(NodeToYaml.get(node)).toContain('blueId: RuntimeId');
  });

  it('respects strategy when delegating through nodeToJson', () => {
    const node = new BlueNode().setValue('abc');

    expect(NodeToYaml.get(node, { strategy: 'simple' })).toBe('abc\n');
    expect(NodeToYaml.get(node, { strategy: 'official' }))
      .toMatchInlineSnapshot(`
        "type:
          blueId: GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC
        value: abc
        "
      `);
  });
});
