import { BlueNode } from '../../model/Node';
import { NodeDeserializer } from '../../model/NodeDeserializer';
import { JsonBlueValue } from '../../../types';
import { BlueId } from '../BlueId';
import { BlueIdCalculator } from '../BlueIdCalculator';
import { yamlBlueParse } from '../../../utils/yamlBlue';

const fakeHashValueProvider = () => {
  return {
    apply: async (obj: unknown) => {
      if (
        typeof obj === 'number' ||
        typeof obj === 'string' ||
        typeof obj === 'boolean'
      ) {
        return `hash(${obj})`;
      }

      if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
        const stringifiedObject = Object.keys(obj)
          .map((key) => {
            return `${key}=${(obj as Record<string, string | number>)[key]}`;
          })
          .join(', ');
        return `hash({${stringifiedObject}})`;
      }

      if (Array.isArray(obj)) {
        return `hash([${obj.join(', ')}])`;
      }
      return `hash(${JSON.stringify(obj)})`;
    },
  };
};

const fakeBlueIdCalculator = new BlueIdCalculator(fakeHashValueProvider());

describe('BlueIdCalculator', () => {
  it('should calculate a blue id for object', async () => {
    const yaml1 =
      'abc:\n' +
      '  def:\n' +
      '    value: 1\n' +
      '  ghi:\n' +
      '    jkl:\n' +
      '      value: 2\n' +
      '    mno:\n' +
      '      value: x\n' +
      'pqr:\n' +
      '  value: 1';

    const map1 = yamlBlueParse(yaml1) as JsonBlueValue;
    const result1 = await fakeBlueIdCalculator.calculate(map1);

    const yaml2 =
      'abc:\n' +
      '  def:\n' +
      '    value: 1\n' +
      '  ghi:\n' +
      '    blueId: hash({jkl=hash({value=2}), mno=hash({value=x})})\n' +
      'pqr:\n' +
      '  value: 1';

    const map2 = yamlBlueParse(yaml2) as JsonBlueValue;
    const result2 = await fakeBlueIdCalculator.calculate(map2);

    const yaml3 =
      'abc:\n' +
      '  blueId: hash({def=hash({value=1}), ghi=hash({jkl=hash({value=2}), mno=hash({value=x})})})\n' +
      'pqr:\n' +
      '  value: 1';

    const map3 = yamlBlueParse(yaml3) as JsonBlueValue;
    const result3 = await fakeBlueIdCalculator.calculate(map3);

    const yaml4 =
      'blueId: hash({abc=hash({def=hash({value=1}), ghi=hash({jkl=hash({value=2}), mno=hash({value=x})})}), pqr=hash({value=1})})';

    const map4 = yamlBlueParse(yaml4) as JsonBlueValue;
    const result4 = await fakeBlueIdCalculator.calculate(map4);

    const expectedResult =
      'hash({abc=hash({def=hash({value=1}), ghi=hash({jkl=hash({value=2}), mno=hash({value=x})})}), pqr=hash({value=1})})';

    expect(result1).toEqual(expectedResult);
    expect(result2).toEqual(expectedResult);
    expect(result3).toEqual(expectedResult);
    expect(result4).toEqual(expectedResult);
  });

  it('should calculate a blue id for lists', async () => {
    const list1 = `abc:
      - 1
      - 2
      - 3`;
    const map1 = yamlBlueParse(list1) as JsonBlueValue;
    const result1 = await fakeBlueIdCalculator.calculate(map1);

    const list2 = `abc:
      - blueId: hash([hash(1), hash(2)])
      - 3`;
    const map2 = yamlBlueParse(list2) as JsonBlueValue;
    const result2 = await fakeBlueIdCalculator.calculate(map2);

    const list3 = `abc:
      - blueId: hash([hash([hash(1), hash(2)]), hash(3)])`;
    const map3 = yamlBlueParse(list3) as JsonBlueValue;
    const result3 = await fakeBlueIdCalculator.calculate(map3);

    const expectedResult =
      'hash({abc=hash([hash([hash(1), hash(2)]), hash(3)])})';
    expect(result1).toEqual(expectedResult);
    expect(result2).toEqual(expectedResult);
    expect(result3).toEqual(expectedResult);
  });

  it('should calculate a blue id for object with one item in list', async () => {
    const list1 = `abc:
      value: x`;
    const map1 = yamlBlueParse(list1) as JsonBlueValue;
    const result1 = await fakeBlueIdCalculator.calculate(map1);

    const list2 = `abc:
      - value: x`;
    const map2 = yamlBlueParse(list2) as JsonBlueValue;
    const result2 = await fakeBlueIdCalculator.calculate(map2);

    const expectedResult = 'hash({abc=hash({value=x})})';
    expect(result1).toEqual(expectedResult);
    expect(result2).toEqual(expectedResult);
  });
});

describe('BlueIdCalculator - additional tests', () => {
  describe('Big Numbers', () => {
    it('should calculate a blue id for big numbers', async () => {
      const value = `
      abc:
        def:
          value: 132452345234524739582739458723948572934875
        ghi:
          jkl:
            value: 132452345234524739582739458723948572934875.132452345234524739582739458723948572934875`;

      const object = yamlBlueParse(value) as JsonBlueValue;

      const result1 = await fakeBlueIdCalculator.calculate(object);
      expect(result1).toBe(
        'hash({abc=hash({def=hash({value=132452345234524739582739458723948572934875}), ghi=hash({jkl=hash({value=132452345234524739582739458723948572934875.132452345234524739582739458723948572934875})})})})'
      );

      const result2 = await BlueIdCalculator.INSTANCE.calculate(object);
      expect(result2).toBe('8ENv4g2qEvPcqC3AGnB7RGskx4TgixPYP1qfAXpaguf9');
    });

    it('should throw error when we are not able to map BlueNode to object during blue id calculation', async () => {
      const value = `
      abc:
        def:
          value: 132452345234524739582739458723948572934875
        ghi:
          jkl:
            value: 132452345234524739582739458723948572934875.132452345234524739582739458723948572934875`;

      const object = yamlBlueParse(value) as JsonBlueValue;
      const node = NodeDeserializer.deserialize(object);
      expect(() =>
        BlueIdCalculator.calculateBlueId(node)
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Error: [big.js] Imprecise conversion]`
      );
    });
  });

  it('should calculate a blue id for object', async () => {
    const value = `
    abc:
      def:
        value: 1
      ghi:
        jkl:
          value: 2
        mno:
          value: x
    pqr:
      value: 1`;

    const object = yamlBlueParse(value) as JsonBlueValue;

    const result1 = await BlueIdCalculator.INSTANCE.calculate(object);

    expect(result1).toBe('5auaiwpHo9jroxnbzeqfPsumTtcWcxbttpqKuMT5oRig');
  });

  const child1Node = new BlueNode('child1');
  child1Node.setValue('child1Value');

  const child2Node = new BlueNode('child2');
  child2Node.setValue('child2Value');

  const child3Node = new BlueNode('child3');
  child3Node.setValue('child3Value');

  it('should calculate a blue id for a node with items', async () => {
    const node = new BlueNode('test');
    node.setItems([child1Node, child2Node, child3Node]);

    const blueId = await BlueIdCalculator.calculateBlueId(node);
    expect(blueId).toBe('Hgs3ynEk81ymjehsozXqDaTYt1s7NzF9HNrN3upiNTY7');

    const blueId2 = await BlueIdCalculator.calculateBlueId(
      node,
      'domainMapping'
    );
    expect(blueId2).toBe('EsuXA8sD4ZmfCs1phE8GqXwWCWK85zYTKdNJ5inZSBkA');
  });

  it('should calculate a blue id for a node with items which one is a sub item of another item', async () => {
    const subNode = new BlueNode();
    subNode.setItems([child1Node, child2Node]);
    const subNodeBlueId = await BlueIdCalculator.calculateBlueId(
      subNode,
      'domainMapping'
    );

    const calculatedSubNode = new BlueNode().setBlueId(subNodeBlueId);

    const node = new BlueNode();
    node.setItems([calculatedSubNode, child3Node]);

    const blueId = await BlueIdCalculator.calculateBlueId(
      node,
      'domainMapping'
    );
    expect(blueId).toBe('EsuXA8sD4ZmfCs1phE8GqXwWCWK85zYTKdNJ5inZSBkA');
  });

  it('should calculate a blue id for a node with items which one is a sublist', async () => {
    const subListNode = new BlueNode().setItems([
      new BlueNode('subChild1').setValue('subChild1Value'),
      new BlueNode('subChild2').setValue('subChild2Value'),
    ]);

    const node = new BlueNode('test').setItems([
      child1Node,
      subListNode,
      child3Node,
    ]);

    const blueId = await BlueIdCalculator.calculateBlueId(
      node,
      'domainMapping'
    );
    expect(blueId).toBe('AoSXTXT3hGr6YtuDmaaS8dwByAKjB4rZqGHqGzxKLuxP');
  });

  it('should calculate a blue id with less characters than 44', async () => {
    const json = { value: '0b9c10ae2e3fef1f5913ce42c8164a99' };

    const node = NodeDeserializer.deserialize(json);
    const blueId = await BlueIdCalculator.calculateBlueId(node);
    expect('1x9rGRkh16kTqf4jYUtqQgPV5UJTWFedqHTvvtFTuE').toBe(blueId);
    expect(blueId).toHaveLength(42);
    expect(BlueId.isPotentialBlueId(blueId)).toBe(true);
  });

  it('should calculate a blue id from more complex json', async () => {
    const json = {
      name: 'New Products c1fxfa',
      products: {
        items: [
          {
            blueId: '9mGcQeKTSDTrAdD9bJ1kDSxhRbPqKLudvX937Fvxm1Qs',
          },
          ['Sub Product 1', 'Sub Product 2'],
        ],
      },
      property_1: {
        name: 'Products 5ktky8',
        products: {
          items: [
            {
              blueId: 'AEW8Ze5C5KZwaVX17a5ZR2fAuCrTe6uwdKMDvk7hXpQ1',
            },
            {
              blueId: 'BnhdJXp2FdXeksB1gUqvrMDtLm88ZjtXKPvNL4Spvptd',
            },
          ],
        },
        property_1_1: {
          name: 'New Products by5ed',
          products: {
            items: [
              {
                blueId: '9mGcQeKTSDTrAdD9bJ1kDSxhRbPqKLudvX937Fvxm1Qs',
              },
              ['Sub Product 1', 'Sub Product 2'],
            ],
          },
          property_1_1_1: {
            blueId: 'FZPSkgZWYy8x3ZEUeHJqF8BQ1epjRQeQDG89SnJhssf1',
          },
          property_1_1_2: {
            blueId: 'FdaqU1kLfmJUpQoij9cmQJ8zTvxVbuB7uVJMwznvXdKC',
          },
          property_1_1_3: {
            blueId: 'DapL23Dsy8XAbzThQD44RrpQT4ADEooMbu21sPXcAweo',
          },
        },
        property_1_2: {
          name: 'Products ofzo8k',
          products: {
            items: [
              {
                blueId: 'AEW8Ze5C5KZwaVX17a5ZR2fAuCrTe6uwdKMDvk7hXpQ1',
              },
              {
                blueId: 'BnhdJXp2FdXeksB1gUqvrMDtLm88ZjtXKPvNL4Spvptd',
              },
            ],
          },
          property_1_2_1: {
            blueId: 'A5u5qmMjxVHdH7PyTPxoose7PwWRCZTwVXvEFBnrLFro',
          },
          property_1_2_2: {
            blueId: 'HgzxNcR2D7ujv8rrT7yxQ6tbaighDAnezomL9vNQgd8P',
          },
          property_1_2_3: {
            blueId: '3kyKhhXy2jpvQb59gFAFmSMBzAzbho3HomizWUNSY7by',
          },
        },
        property_1_3: {
          name: 'Name wuwdq',
          createdAt: {
            blueId: 'GDjcyo4wGFv6HL4Tx6tRMqDk7N2gt8KUvFh2RTz57mWD',
            value: '2024-05-15T09:11:13.136Z',
          },
          createdBy: {
            blueId: '5BphmBv2gKGyU2VrEmajDaSWP3KcWdCZBzhrP5fUjfH6',
            value: 'User 839',
          },
          property_1_3_1: {
            blueId: 'J9t7hQqbVCoQsnACG9K44idXURutzkqLKpaAxXVZpB82',
          },
          property_1_3_2: {
            blueId: 'DckK5rS4L15eaHFfgKWe2xatieo3RkVS4PBCDmTVp6GT',
          },
          property_1_3_3: {
            blueId: 'E6RpVNecRSxL9veDZrzrbt9uj68BWWMhoGKbz87xhJ42',
          },
        },
      },
      property_2: {
        name: 'Name rwjit8',
        description: 'Description v1upvgi',
        property_2_1: {
          name: 'Name zm7kcj',
          description: 'Description f7wmyo',
          property_2_1_1: {
            blueId: 'D4TkogpTBpbCrJstjBM7cNkWSgMZQuw4utHahP1DMiFe',
          },
          property_2_1_2: {
            blueId: '5otp8bVB7WsmqZUYtW2vycsi6DiD7M7w6oKTfnsG6eP1',
          },
          property_2_1_3: {
            blueId: 'Gz8yFmjphw7SfBpt7gaBCbTmdBGvTkRfpCWbTNSdghHC',
          },
        },
        property_2_2: {
          blueId: '12nR2SBWR9QT4bt97N9w1emGdHfo97ySGvYysZXA5CEH',
        },
      },
      property_3: {
        blueId: '97i78hcHUnEiWvx1ESHiFShPBbmtXZDrL1dp5ZRrjptr',
      },
      property_4: {
        blueId: 'DdvTnSUx3QPaA7QbKaNmxFUL2VjriQgR3LwbKDMFJm5F',
      },
      property_5: {
        blueId: 'HM5xSf98Hq37GYe1zu5Mgy4u3tMWYsZ7EcyyenKDCRWL',
      },
    };

    const node = NodeDeserializer.deserialize(json);
    const blueId = await BlueIdCalculator.calculateBlueId(node);
    expect('7fC4apc7F5LxPzUiRqKySrFbTuWP6twtmjeZbHk3puP3').toBe(blueId);
  });
});
