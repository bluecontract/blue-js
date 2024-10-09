import { BlueNode } from '../../model/Node';
import { NodeDeserializer } from '../../model/NodeDeserializer';
import { JsonBlueValue } from '../../../schema';
import { BlueIds } from '../BlueIds';
import { BlueIdCalculator } from '../BlueIdCalculator';
import { yamlBlueParse } from '../../../utils/yamlBlue';
import {
  INTEGER_TYPE_BLUE_ID,
  DOUBLE_TYPE_BLUE_ID,
  TEXT_TYPE_BLUE_ID,
} from '../Properties';
import { isBigNumber } from '../../../utils/typeGuards';

const stringify = (obj: unknown): string => {
  if (
    typeof obj === 'number' ||
    typeof obj === 'string' ||
    typeof obj === 'boolean' ||
    typeof obj === 'bigint' ||
    isBigNumber(obj)
  ) {
    return obj.toString();
  }

  if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
    const stringifiedObject = Object.keys(obj)
      .map((key) => {
        const value = stringify((obj as Record<string, string | number>)[key]);
        return `${key}=${value}`;
      })
      .join(', ');

    return `{${stringifiedObject}}`;
  }

  if (Array.isArray(obj)) {
    return `[${obj.map(stringify).join(', ')}]`;
  }

  return JSON.stringify(obj);
};

const fakeHashValueProvider = () => {
  return {
    apply: async (obj: unknown) => {
      const stringified = stringify(obj);
      return `hash(${stringified})`;
    },
  };
};

const fakeBlueIdCalculator = new BlueIdCalculator(fakeHashValueProvider());

describe('BlueIdCalculator', () => {
  it('testObject', async () => {
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
      '    blueId: hash({jkl={blueId=hash({value=2})}, mno={blueId=hash({value=x})}})\n' +
      'pqr:\n' +
      '  value: 1';

    const map2 = yamlBlueParse(yaml2) as JsonBlueValue;
    const result2 = await fakeBlueIdCalculator.calculate(map2);

    const yaml3 =
      'abc:\n' +
      '  blueId: hash({def={blueId=hash({value=1})}, ghi={blueId=hash({jkl={blueId=hash({value=2})}, mno={blueId=hash({value=x})}})}})\n' +
      'pqr:\n' +
      '  value: 1';

    const map3 = yamlBlueParse(yaml3) as JsonBlueValue;
    const result3 = await fakeBlueIdCalculator.calculate(map3);

    const yaml4 =
      'blueId: hash({abc={blueId=hash({def={blueId=hash({value=1})}, ghi={blueId=hash({jkl={blueId=hash({value=2})}, mno={blueId=hash({value=x})}})}})}, pqr={blueId=hash({value=1})}})';

    const map4 = yamlBlueParse(yaml4) as JsonBlueValue;
    const result4 = await fakeBlueIdCalculator.calculate(map4);

    const expectedResult =
      'hash({abc={blueId=hash({def={blueId=hash({value=1})}, ghi={blueId=hash({jkl={blueId=hash({value=2})}, mno={blueId=hash({value=x})}})}})}, pqr={blueId=hash({value=1})}})';

    expect(result1).toEqual(expectedResult);
    expect(result2).toEqual(expectedResult);
    expect(result3).toEqual(expectedResult);
    expect(result4).toEqual(expectedResult);
  });

  it('testList', async () => {
    const list1 = `abc:
      - 1
      - 2
      - 3`;
    const map1 = yamlBlueParse(list1) as JsonBlueValue;
    const result1 = await fakeBlueIdCalculator.calculate(map1);

    const list2 = `abc:
      - blueId: hash([{blueId=hash(1)}, {blueId=hash(2)}])
      - 3`;
    const map2 = yamlBlueParse(list2) as JsonBlueValue;
    const result2 = await fakeBlueIdCalculator.calculate(map2);

    const list3 = `abc:
      - blueId: hash([{blueId=hash([{blueId=hash(1)}, {blueId=hash(2)}])}, {blueId=hash(3)}])`;
    const map3 = yamlBlueParse(list3) as JsonBlueValue;
    const result3 = await fakeBlueIdCalculator.calculate(map3);

    const expectedResult =
      'hash({abc={blueId=hash([{blueId=hash([{blueId=hash(1)}, {blueId=hash(2)}])}, {blueId=hash(3)}])}})';
    expect(result1).toEqual(expectedResult);
    expect(result2).toEqual(expectedResult);
    expect(result3).toEqual(expectedResult);
  });

  it('testObjectVsList', async () => {
    const list1 = `abc:
      value: x`;
    const map1 = yamlBlueParse(list1) as JsonBlueValue;
    const result1 = await fakeBlueIdCalculator.calculate(map1);

    const list2 = `abc:
      - value: x`;
    const map2 = yamlBlueParse(list2) as JsonBlueValue;
    const result2 = await fakeBlueIdCalculator.calculate(map2);

    const expectedResult = 'hash({abc={blueId=hash({value=x})}})';
    expect(result1).toEqual(expectedResult);
    expect(result2).toEqual(expectedResult);
  });

  it('testSortingOfObjectProperties', async () => {
    const yaml = `
€: Euro Sign
\\r: Carriage Return
\\n: Newline
"1": One
\uD83D\uDE02: Smiley
ö: Latin Small Letter O With Diaeresis
דּ: Hebrew Letter Dalet With Dagesh
</script>: Browser Challenge
`;
    const node = NodeDeserializer.deserialize(
      yamlBlueParse(yaml) as JsonBlueValue
    );
    const blueId = await BlueIdCalculator.calculateBlueId(node);

    const json =
      '{"1":"One","</script>":"Browser Challenge","\\\\n":"Newline","\\\\r":"Carriage Return","ö":"Latin Small Letter O With Diaeresis","דּ":"Hebrew Letter Dalet With Dagesh","€":"Euro Sign","\uD83D\uDE02":"Smiley"}';
    const node2 = NodeDeserializer.deserialize(JSON.parse(json));
    const blueId2 = await BlueIdCalculator.calculateBlueId(node2);

    expect(blueId2).toEqual(blueId);
  });

  it('testInteger', async () => {
    const yaml = `num: 36`;
    const node = NodeDeserializer.deserialize(
      yamlBlueParse(yaml) as JsonBlueValue
    );
    const blueId = await BlueIdCalculator.calculateBlueId(node);

    const json = `{"num":{"type":{"blueId":"${INTEGER_TYPE_BLUE_ID}"},"value":36}}`;
    const node2 = NodeDeserializer.deserialize(JSON.parse(json));
    const blueId2 = await BlueIdCalculator.calculateBlueId(node2);

    expect(blueId2).toEqual(blueId);
  });

  it('testDecimal', async () => {
    const yaml = `num: 36.55`;
    const node = NodeDeserializer.deserialize(
      yamlBlueParse(yaml) as JsonBlueValue
    );
    const blueId = await BlueIdCalculator.calculateBlueId(node);

    const json = `{"num":{"type":{"blueId":"${DOUBLE_TYPE_BLUE_ID}"},"value":36.55}}`;
    const node2 = NodeDeserializer.deserialize(JSON.parse(json));
    const blueId2 = await BlueIdCalculator.calculateBlueId(node2);

    expect(blueId2).toEqual(blueId);
  });

  it('testBigIntegerV1', async () => {
    const yaml = `num: 36928735469874359687345908673940586739458679548679034857690345876905238476903485769`;
    const node = NodeDeserializer.deserialize(
      yamlBlueParse(yaml) as JsonBlueValue
    );
    const blueId = await BlueIdCalculator.calculateBlueId(node);

    const json = `{"num":{"type":{"blueId":"${INTEGER_TYPE_BLUE_ID}"},"value":"9007199254740991"}}`;
    const node2 = NodeDeserializer.deserialize(JSON.parse(json));
    const blueId2 = await BlueIdCalculator.calculateBlueId(node2);

    expect(blueId2).toEqual(blueId);
  });

  it('testBigIntegerV2', async () => {
    const yaml = `num:
  value: '36928735469874359687345908673940586739458679548679034857690345876905238476903485769'
  type:
    blueId: ${INTEGER_TYPE_BLUE_ID}`;
    const node = NodeDeserializer.deserialize(
      yamlBlueParse(yaml) as JsonBlueValue
    );
    const blueId = await BlueIdCalculator.calculateBlueId(node);

    const json = `{"num":{"type":{"blueId":"${INTEGER_TYPE_BLUE_ID}"},"value":"36928735469874359687345908673940586739458679548679034857690345876905238476903485769"}}`;
    const node2 = NodeDeserializer.deserialize(JSON.parse(json));
    const blueId2 = await BlueIdCalculator.calculateBlueId(node2);

    expect(blueId2).toEqual(blueId);
  });

  it('testBigIntegerText', async () => {
    const yaml = `num:
  value: '36928735469874359687345908673940586739458679548679034857690345876905238476903485769'`;
    const node = NodeDeserializer.deserialize(
      yamlBlueParse(yaml) as JsonBlueValue
    );
    const blueId = await BlueIdCalculator.calculateBlueId(node);

    const json = `{"num":{"type":{"blueId":"${TEXT_TYPE_BLUE_ID}"},"value":"36928735469874359687345908673940586739458679548679034857690345876905238476903485769"}}`;
    const node2 = NodeDeserializer.deserialize(JSON.parse(json));
    const blueId2 = await BlueIdCalculator.calculateBlueId(node2);

    expect(blueId2).toEqual(blueId);
  });

  it('testBigDecimal', async () => {
    const yaml = `num: 36928735469874359687345908673940586739458679548679034857690345876905238476903485769.36928735469874359687345908673940586739458679548679034857690345876905238476903485769`;
    const node = NodeDeserializer.deserialize(
      yamlBlueParse(yaml) as JsonBlueValue
    );
    const blueId = await BlueIdCalculator.calculateBlueId(node);

    const json = `{"num":{"type":{"blueId":"${DOUBLE_TYPE_BLUE_ID}"},"value":3.692873546987436e+82}}`;
    const node2 = NodeDeserializer.deserialize(JSON.parse(json));
    const blueId2 = await BlueIdCalculator.calculateBlueId(node2);

    expect(blueId2).toEqual(blueId);
  });

  it('testMultilineText1', async () => {
    const yaml = `text: |
  abc
  def`;

    const node = NodeDeserializer.deserialize(
      yamlBlueParse(yaml) as JsonBlueValue
    );
    const blueId = await BlueIdCalculator.calculateBlueId(node);

    const json = `{"text":{"type":{"blueId":"F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"},"value":"abc\\ndef\\n"}}`;
    const node2 = NodeDeserializer.deserialize(JSON.parse(json));
    const blueId2 = await BlueIdCalculator.calculateBlueId(node2);

    expect(blueId2).toEqual(blueId);
  });

  it('testMultilineText2', async () => {
    const yaml = `text: >
  abc
  def`;
    const node = NodeDeserializer.deserialize(
      yamlBlueParse(yaml) as JsonBlueValue
    );
    const blueId = await BlueIdCalculator.calculateBlueId(node);

    const json = `{"text":{"type":{"blueId":"F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"},"value":"abc def\\n"}}`;
    const node2 = NodeDeserializer.deserialize(JSON.parse(json));
    const blueId2 = await BlueIdCalculator.calculateBlueId(node2);

    expect(blueId2).toEqual(blueId);
  });

  it('should remove null and empty values when calculating BlueId', async () => {
    const yaml1 = `
a: 1
b: null`;
    const yaml2 = `a: 1`;
    const yaml3 = `
a: 1
b: null
c: null`;
    const yaml4 = `
a: 1
b: null
c: []
d: null`;
    const yaml5 = `
a: 1
d: {}`;

    const node1 = NodeDeserializer.deserialize(
      yamlBlueParse(yaml1) as JsonBlueValue
    );
    const node2 = NodeDeserializer.deserialize(
      yamlBlueParse(yaml2) as JsonBlueValue
    );
    const node3 = NodeDeserializer.deserialize(
      yamlBlueParse(yaml3) as JsonBlueValue
    );
    const node4 = NodeDeserializer.deserialize(
      yamlBlueParse(yaml4) as JsonBlueValue
    );
    const node5 = NodeDeserializer.deserialize(
      yamlBlueParse(yaml5) as JsonBlueValue
    );

    const result1 = await BlueIdCalculator.calculateBlueId(node1);
    const result2 = await BlueIdCalculator.calculateBlueId(node2);
    const result3 = await BlueIdCalculator.calculateBlueId(node3);
    const result4 = await BlueIdCalculator.calculateBlueId(node4);
    const result5 = await BlueIdCalculator.calculateBlueId(node5);

    expect(result2).toEqual(result1);
    expect(result3).toEqual(result1);
    expect(result4).toEqual(result1);
    expect(result5).toEqual(result1);
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
        'hash({abc={blueId=hash({def={blueId=hash({value=132452345234524739582739458723948572934875})}, ghi={blueId=hash({jkl={blueId=hash({value=132452345234524739582739458723948572934875.132452345234524739582739458723948572934875})}})}})}})'
      );

      const node = NodeDeserializer.deserialize(object);
      const result2 = await BlueIdCalculator.calculateBlueId(node);
      expect(result2).toMatchInlineSnapshot(
        '"AfcbaDxwJwMMLD9xzjjPZuks4jvxPv2jvkjrJXh8EkiA"'
      );
    });
  });

  it('should generate identical BlueIds for equivalent nested structures with and without pre-calculated BlueIds', async () => {
    const yaml1 = `
jkl:
  value: 2
mno:
  value: x
`;

    const map1 = yamlBlueParse(yaml1) as JsonBlueValue;
    const node1 = NodeDeserializer.deserialize(map1);
    const blueId1 = await BlueIdCalculator.calculateBlueId(node1);

    const yaml2 = `
abc:
  def:
    value: 1
  ghi:
    blueId: ${blueId1}
`;

    const map2 = yamlBlueParse(yaml2) as JsonBlueValue;
    const node2 = NodeDeserializer.deserialize(map2);
    const blueId2 = await BlueIdCalculator.calculateBlueId(node2);

    const yaml3 = `
    abc:
      def:
        value: 1
      ghi:
        jkl:
          value: 2
        mno:
          value: x
    `;

    const map3 = yamlBlueParse(yaml3) as JsonBlueValue;
    const node3 = NodeDeserializer.deserialize(map3);
    const blueId3 = await BlueIdCalculator.calculateBlueId(node3);

    expect(blueId2).toEqual(blueId3);
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
    const node = NodeDeserializer.deserialize(object);

    const result1 = await BlueIdCalculator.calculateBlueId(node);

    expect(result1).toMatchInlineSnapshot(
      `"6MD6VFSkf4QqWHR3vwNhhsT9nM22NU1BBDrKitxH9fzD"`
    );
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
    expect(blueId).toMatchInlineSnapshot(
      `"AbzmfN3VhcFAmWTnvfHgLZCkqhLCEW1RbGqMVTdAE2fm"`
    );
  });

  it('should calculate a blue id for a node with items which one is a sub item of another item', async () => {
    const subNode = new BlueNode();
    subNode.setItems([child1Node, child2Node]);
    const subNodeBlueId = await BlueIdCalculator.calculateBlueId(subNode);

    const calculatedSubNode = new BlueNode().setBlueId(subNodeBlueId);

    const node = new BlueNode();
    node.setItems([calculatedSubNode, child3Node]);

    const blueId = await BlueIdCalculator.calculateBlueId(node);
    expect(blueId).toMatchInlineSnapshot(
      `"9Avar4YLc5rtenpsqQppYYQuF3bSYEkq7iAougGPd1zv"`
    );
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

    const blueId = await BlueIdCalculator.calculateBlueId(node);
    expect(blueId).toMatchInlineSnapshot(
      `"8rchyLLTuDsCgawPy7usKsgVrt7h3EaVGCFBXrahMf7D"`
    );
  });

  it('should calculate a blue id with less characters than 44', async () => {
    const json = { value: '18e1ca8a8de189d9759057ab4251fd97' };

    const node = NodeDeserializer.deserialize(json);
    const blueId = await BlueIdCalculator.calculateBlueId(node);

    expect(blueId).toMatchInlineSnapshot(
      `"1xqjcHGX3aF3um8LtfbMAZGdRT74j3k5GXT4yqSbp8"`
    );
    expect(blueId).toHaveLength(42);
    expect(BlueIds.isPotentialBlueId(blueId)).toBe(true);
  });

  it('should calculate a blue id from more complex json', async () => {
    const json =
      '{"name":"New Products c1fxfa","products":{"items":[{"blueId":"9mGcQeKTSDTrAdD9bJ1kDSxhRbPqKLudvX937Fvxm1Qs"},["Sub Product 1","Sub Product 2"]]},"property_1":{"name":"Products 5ktky8","products":{"items":[{"blueId":"AEW8Ze5C5KZwaVX17a5ZR2fAuCrTe6uwdKMDvk7hXpQ1"},{"blueId":"BnhdJXp2FdXeksB1gUqvrMDtLm88ZjtXKPvNL4Spvptd"}]},"property_1_1":{"name":"New Products by5ed","products":{"items":[{"blueId":"9mGcQeKTSDTrAdD9bJ1kDSxhRbPqKLudvX937Fvxm1Qs"},["Sub Product 1","Sub Product 2"]]},"property_1_1_1":{"blueId":"FZPSkgZWYy8x3ZEUeHJqF8BQ1epjRQeQDG89SnJhssf1"},"property_1_1_2":{"blueId":"FdaqU1kLfmJUpQoij9cmQJ8zTvxVbuB7uVJMwznvXdKC"},"property_1_1_3":{"blueId":"DapL23Dsy8XAbzThQD44RrpQT4ADEooMbu21sPXcAweo"}},"property_1_2":{"name":"Products ofzo8k","products":{"items":[{"blueId":"AEW8Ze5C5KZwaVX17a5ZR2fAuCrTe6uwdKMDvk7hXpQ1"},{"blueId":"BnhdJXp2FdXeksB1gUqvrMDtLm88ZjtXKPvNL4Spvptd"}]},"property_1_2_1":{"blueId":"A5u5qmMjxVHdH7PyTPxoose7PwWRCZTwVXvEFBnrLFro"},"property_1_2_2":{"blueId":"HgzxNcR2D7ujv8rrT7yxQ6tbaighDAnezomL9vNQgd8P"},"property_1_2_3":{"blueId":"3kyKhhXy2jpvQb59gFAFmSMBzAzbho3HomizWUNSY7by"}},"property_1_3":{"name":"Name wuwdq","createdAt":{"blueId":"GDjcyo4wGFv6HL4Tx6tRMqDk7N2gt8KUvFh2RTz57mWD","value":"2024-05-15T09:11:13.136Z"},"createdBy":{"blueId":"5BphmBv2gKGyU2VrEmajDaSWP3KcWdCZBzhrP5fUjfH6","value":"User 839"},"property_1_3_1":{"blueId":"J9t7hQqbVCoQsnACG9K44idXURutzkqLKpaAxXVZpB82"},"property_1_3_2":{"blueId":"DckK5rS4L15eaHFfgKWe2xatieo3RkVS4PBCDmTVp6GT"},"property_1_3_3":{"blueId":"E6RpVNecRSxL9veDZrzrbt9uj68BWWMhoGKbz87xhJ42"}}},"property_2":{"name":"Name rwjit8","description":"Description v1upvgi","property_2_1":{"name":"Name zm7kcj","description":"Description f7wmyo","property_2_1_1":{"blueId":"D4TkogpTBpbCrJstjBM7cNkWSgMZQuw4utHahP1DMiFe"},"property_2_1_2":{"blueId":"5otp8bVB7WsmqZUYtW2vycsi6DiD7M7w6oKTfnsG6eP1"},"property_2_1_3":{"blueId":"Gz8yFmjphw7SfBpt7gaBCbTmdBGvTkRfpCWbTNSdghHC"}},"property_2_2":{"blueId":"12nR2SBWR9QT4bt97N9w1emGdHfo97ySGvYysZXA5CEH"}},"property_3":{"blueId":"97i78hcHUnEiWvx1ESHiFShPBbmtXZDrL1dp5ZRrjptr"},"property_4":{"blueId":"DdvTnSUx3QPaA7QbKaNmxFUL2VjriQgR3LwbKDMFJm5F"},"property_5":{"blueId":"HM5xSf98Hq37GYe1zu5Mgy4u3tMWYsZ7EcyyenKDCRWL"}}';

    const node = NodeDeserializer.deserialize(JSON.parse(json));
    const blueId = await BlueIdCalculator.calculateBlueId(node);
    expect(blueId).toMatchInlineSnapshot(
      `"ToF7bZomuz2gbY3ZoARG9a2QhV2L39AtRRAaQADA1NR"`
    );
  });
});
