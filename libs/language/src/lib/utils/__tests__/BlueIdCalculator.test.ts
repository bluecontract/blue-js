import { BlueNode } from '../../model/Node';
import { NodeDeserializer } from '../../model/NodeDeserializer';
import { JsonBlueValue } from '../../../schema';
import { Blue } from '../../Blue';
import { BlueIds } from '../BlueIds';
import { BlueIdCalculator } from '../BlueIdCalculator';
import { yamlBlueParse } from '../../../utils/yamlBlue';
import {
  INTEGER_TYPE_BLUE_ID,
  DOUBLE_TYPE_BLUE_ID,
  TEXT_TYPE_BLUE_ID,
} from '../Properties';
import { isBigNumber } from '../../../utils/typeGuards';
import { Base58Sha256Provider } from '../Base58Sha256Provider';
import { NodeToBlueIdInput } from '../NodeToBlueIdInput';

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
    const sortedKeys = Object.keys(obj).sort();
    const stringifiedObject = sortedKeys
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

    applySync: (obj: unknown) => {
      const stringified = stringify(obj);
      return `hash(${stringified})`;
    },
  };
};

const fakeBlueIdCalculator = new BlueIdCalculator(
  fakeHashValueProvider() as Base58Sha256Provider,
);

const nodeFromYaml = (yaml: string): BlueNode =>
  NodeDeserializer.deserialize(yamlBlueParse(yaml) as JsonBlueValue);

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

    expect(result1).toContain('abc={blueId=hash');
    expect(result1).toContain(`type={blueId=${INTEGER_TYPE_BLUE_ID}}`);
    expect(result1).toContain(`type={blueId=${TEXT_TYPE_BLUE_ID}}`);
  });

  it('testList', async () => {
    const list1 = `abc:
      - 1
      - 2
      - 3`;
    const map1 = yamlBlueParse(list1) as JsonBlueValue;
    const result1 = await fakeBlueIdCalculator.calculate(map1);

    const list2 = `abc:
      items:
        - 1
        - 2
        - 3`;
    const map2 = yamlBlueParse(list2) as JsonBlueValue;
    const result2 = await fakeBlueIdCalculator.calculate(map2);

    const emptyListId = 'hash({$list=empty})';
    const typedFirst = `hash({type={blueId=${INTEGER_TYPE_BLUE_ID}}, value=1})`;
    const typedSecond = `hash({type={blueId=${INTEGER_TYPE_BLUE_ID}}, value=2})`;
    const typedThird = `hash({type={blueId=${INTEGER_TYPE_BLUE_ID}}, value=3})`;
    const firstFoldId = `hash({$listCons={elem={blueId=${typedFirst}}, prev={blueId=${emptyListId}}}})`;
    const secondFoldId = `hash({$listCons={elem={blueId=${typedSecond}}, prev={blueId=${firstFoldId}}}})`;
    const thirdFoldId = `hash({$listCons={elem={blueId=${typedThird}}, prev={blueId=${secondFoldId}}}})`;

    const expectedResult = `hash({abc={blueId=${thirdFoldId}}})`;
    expect(result1).toEqual(expectedResult);
    expect(result2).toEqual(expectedResult);
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

    expect(result1).not.toEqual(result2);
  });

  it('canonicalizes schema enum order and duplicates in direct BlueId input', () => {
    const first = nodeFromYaml(`
schema:
  enum:
    - B
    - A
    - B
value: A
`);
    const second = nodeFromYaml(`
schema:
  enum:
    - A
    - B
value: A
`);

    expect(BlueIdCalculator.calculateBlueIdSync(first)).toBe(
      BlueIdCalculator.calculateBlueIdSync(second),
    );
  });

  it('orders schema enum identity by canonical UTF-8 bytes', () => {
    const input = NodeToBlueIdInput.get(
      nodeFromYaml(`
schema:
  enum:
    - CRU-LONG
    - CRU
value: CRU
`),
    ) as {
      schema: { enum: Array<{ value: string }> };
    };

    expect(input.schema.enum.map((value) => value.value)).toEqual([
      'CRU',
      'CRU-LONG',
    ]);
  });

  it('keeps resolved schema enum output duplicate-free and deterministic', () => {
    const resolved = new Blue().resolve(
      nodeFromYaml(`
type:
  schema:
    enum:
      - B
      - A
      - B
schema:
  enum:
    - B
    - A
    - A
`),
    );

    const resolvedEnumValues = (node: BlueNode | undefined): unknown[] =>
      node
        ?.getSchema()
        ?.getEnum()
        ?.map((enumNode) => enumNode.getValue()) ?? [];

    expect(resolvedEnumValues(resolved)).toEqual(['A', 'B']);
    expect(resolvedEnumValues(resolved.getType())).toEqual(['A', 'B']);
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
      yamlBlueParse(yaml) as JsonBlueValue,
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
      yamlBlueParse(yaml) as JsonBlueValue,
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
      yamlBlueParse(yaml) as JsonBlueValue,
    );
    const blueId = await BlueIdCalculator.calculateBlueId(node);

    const json = `{"num":{"type":{"blueId":"${DOUBLE_TYPE_BLUE_ID}"},"value":36.55}}`;
    const node2 = NodeDeserializer.deserialize(JSON.parse(json));
    const blueId2 = await BlueIdCalculator.calculateBlueId(node2);

    expect(blueId2).toEqual(blueId);
  });

  it('testBigIntegerV1', async () => {
    const yaml = `num: 36928735469874359687345908673940586739458679548679034857690345876905238476903485769`;
    expect(() =>
      NodeDeserializer.deserialize(yamlBlueParse(yaml) as JsonBlueValue),
    ).toThrow(
      /Unquoted integers outside \[-9007199254740991, 9007199254740991\]/,
    );
  });

  it('testBigIntegerV2', async () => {
    const yaml = `num:
  value: '36928735469874359687345908673940586739458679548679034857690345876905238476903485769'
  type:
    blueId: ${INTEGER_TYPE_BLUE_ID}`;
    const node = NodeDeserializer.deserialize(
      yamlBlueParse(yaml) as JsonBlueValue,
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
      yamlBlueParse(yaml) as JsonBlueValue,
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
      yamlBlueParse(yaml) as JsonBlueValue,
    );
    const blueId = await BlueIdCalculator.calculateBlueId(node);

    const json = `{"num":{"type":{"blueId":"${DOUBLE_TYPE_BLUE_ID}"},"value":"3.692873546987436e+82"}}`;
    const node2 = NodeDeserializer.deserialize(JSON.parse(json));
    const blueId2 = await BlueIdCalculator.calculateBlueId(node2);

    expect(blueId2).toEqual(blueId);
  });

  it('testMultilineText1', async () => {
    const yaml = `text: |
  abc
  def`;

    const node = NodeDeserializer.deserialize(
      yamlBlueParse(yaml) as JsonBlueValue,
    );
    const blueId = await BlueIdCalculator.calculateBlueId(node);

    const json = `{"text":{"type":{"blueId":"${TEXT_TYPE_BLUE_ID}"},"value":"abc\\ndef\\n"}}`;
    const node2 = NodeDeserializer.deserialize(JSON.parse(json));
    const blueId2 = await BlueIdCalculator.calculateBlueId(node2);

    expect(blueId2).toEqual(blueId);
  });

  it('testMultilineText2', async () => {
    const yaml = `text: >
  abc
  def`;
    const node = NodeDeserializer.deserialize(
      yamlBlueParse(yaml) as JsonBlueValue,
    );
    const blueId = await BlueIdCalculator.calculateBlueId(node);

    const json = `{"text":{"type":{"blueId":"${TEXT_TYPE_BLUE_ID}"},"value":"abc def\\n"}}`;
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
      yamlBlueParse(yaml1) as JsonBlueValue,
    );
    const node2 = NodeDeserializer.deserialize(
      yamlBlueParse(yaml2) as JsonBlueValue,
    );
    const node3 = NodeDeserializer.deserialize(
      yamlBlueParse(yaml3) as JsonBlueValue,
    );
    const node4 = NodeDeserializer.deserialize(
      yamlBlueParse(yaml4) as JsonBlueValue,
    );
    const node5 = NodeDeserializer.deserialize(
      yamlBlueParse(yaml5) as JsonBlueValue,
    );

    const result1 = await BlueIdCalculator.calculateBlueId(node1);
    const result2 = await BlueIdCalculator.calculateBlueId(node2);
    const result3 = await BlueIdCalculator.calculateBlueId(node3);
    const result4 = await BlueIdCalculator.calculateBlueId(node4);
    const result5 = await BlueIdCalculator.calculateBlueId(node5);

    expect(result2).toEqual(result1);
    expect(result3).toEqual(result1);
    expect(result4).not.toEqual(result1);
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

      expect(() => fakeBlueIdCalculator.calculate(object)).toThrow(
        /Unquoted integers outside \[-9007199254740991, 9007199254740991\]/,
      );
      expect(() => NodeDeserializer.deserialize(object)).toThrow(
        /Unquoted integers outside \[-9007199254740991, 9007199254740991\]/,
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
      `"8WLzq2m3BQJqVPNo2DDcDwEdtGHYE5PNcRfZCXYQafCT"`,
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
      `"2pUwPxKZo2KBUk7bkaSHZ4CNhnGdju5SQYm1EX7E3wPU"`,
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
      `"3q2srrPpjGiGppMDSV82VKkSMy4hvt496xGLapyqiCkX"`,
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
      `"ePm7bwW67fHyfkNppLf7YJNobsrSowNTMAPY6cDTgwZ"`,
    );
  });

  it('should calculate a blue id for a scalar string node', async () => {
    const json = { value: '74f516a81a920fc5b465f2c6fd31ff41' };

    const node = NodeDeserializer.deserialize(json);
    const blueId = await BlueIdCalculator.calculateBlueId(node);

    expect(blueId).toMatchInlineSnapshot(
      `"GEm5V5n7m4cod7CwpdgQF11ZrJWqsHwQW9WTVCyVENe4"`,
    );
    expect(BlueIds.isPotentialBlueId(blueId)).toBe(true);
  });

  /**
   * @vitest-environment jsdom
   */

  it('rejects mixed blueId payloads in more complex json', () => {
    const json =
      '{"name":"New Products c1fxfa","products":{"items":[{"blueId":"9mGcQeKTSDTrAdD9bJ1kDSxhRbPqKLudvX937Fvxm1Qs"},["Sub Product 1","Sub Product 2"]]},"property_1":{"name":"Products 5ktky8","products":{"items":[{"blueId":"AEW8Ze5C5KZwaVX17a5ZR2fAuCrTe6uwdKMDvk7hXpQ1"},{"blueId":"BnhdJXp2FdXeksB1gUqvrMDtLm88ZjtXKPvNL4Spvptd"}]},"property_1_1":{"name":"New Products by5ed","products":{"items":[{"blueId":"9mGcQeKTSDTrAdD9bJ1kDSxhRbPqKLudvX937Fvxm1Qs"},["Sub Product 1","Sub Product 2"]]},"property_1_1_1":{"blueId":"FZPSkgZWYy8x3ZEUeHJqF8BQ1epjRQeQDG89SnJhssf1"},"property_1_1_2":{"blueId":"FdaqU1kLfmJUpQoij9cmQJ8zTvxVbuB7uVJMwznvXdKC"},"property_1_1_3":{"blueId":"DapL23Dsy8XAbzThQD44RrpQT4ADEooMbu21sPXcAweo"}},"property_1_2":{"name":"Products ofzo8k","products":{"items":[{"blueId":"AEW8Ze5C5KZwaVX17a5ZR2fAuCrTe6uwdKMDvk7hXpQ1"},{"blueId":"BnhdJXp2FdXeksB1gUqvrMDtLm88ZjtXKPvNL4Spvptd"}]},"property_1_2_1":{"blueId":"A5u5qmMjxVHdH7PyTPxoose7PwWRCZTwVXvEFBnrLFro"},"property_1_2_2":{"blueId":"HgzxNcR2D7ujv8rrT7yxQ6tbaighDAnezomL9vNQgd8P"},"property_1_2_3":{"blueId":"3kyKhhXy2jpvQb59gFAFmSMBzAzbho3HomizWUNSY7by"}},"property_1_3":{"name":"Name wuwdq","createdAt":{"blueId":"GDjcyo4wGFv6HL4Tx6tRMqDk7N2gt8KUvFh2RTz57mWD","value":"2024-05-15T09:11:13.136Z"},"createdBy":{"blueId":"5BphmBv2gKGyU2VrEmajDaSWP3KcWdCZBzhrP5fUjfH6","value":"User 839"},"property_1_3_1":{"blueId":"J9t7hQqbVCoQsnACG9K44idXURutzkqLKpaAxXVZpB82"},"property_1_3_2":{"blueId":"DckK5rS4L15eaHFfgKWe2xatieo3RkVS4PBCDmTVp6GT"},"property_1_3_3":{"blueId":"E6RpVNecRSxL9veDZrzrbt9uj68BWWMhoGKbz87xhJ42"}}},"property_2":{"name":"Name rwjit8","description":"Description v1upvgi","property_2_1":{"name":"Name zm7kcj","description":"Description f7wmyo","property_2_1_1":{"blueId":"D4TkogpTBpbCrJstjBM7cNkWSgMZQuw4utHahP1DMiFe"},"property_2_1_2":{"blueId":"5otp8bVB7WsmqZUYtW2vycsi6DiD7M7w6oKTfnsG6eP1"},"property_2_1_3":{"blueId":"Gz8yFmjphw7SfBpt7gaBCbTmdBGvTkRfpCWbTNSdghHC"}},"property_2_2":{"blueId":"12nR2SBWR9QT4bt97N9w1emGdHfo97ySGvYysZXA5CEH"}},"property_3":{"blueId":"97i78hcHUnEiWvx1ESHiFShPBbmtXZDrL1dp5ZRrjptr"},"property_4":{"blueId":"DdvTnSUx3QPaA7QbKaNmxFUL2VjriQgR3LwbKDMFJm5F"},"property_5":{"blueId":"HM5xSf98Hq37GYe1zu5Mgy4u3tMWYsZ7EcyyenKDCRWL"}}';

    expect(() => NodeDeserializer.deserialize(JSON.parse(json))).toThrow(
      /blueId nodes must be reference-only/,
    );
  });

  /**
   * @vitest-environment jsdom
   */

  it('rejects mixed blueId payloads in more complex json on browser', () => {
    const json =
      '{"name":"New Products c1fxfa","products":{"items":[{"blueId":"9mGcQeKTSDTrAdD9bJ1kDSxhRbPqKLudvX937Fvxm1Qs"},["Sub Product 1","Sub Product 2"]]},"property_1":{"name":"Products 5ktky8","products":{"items":[{"blueId":"AEW8Ze5C5KZwaVX17a5ZR2fAuCrTe6uwdKMDvk7hXpQ1"},{"blueId":"BnhdJXp2FdXeksB1gUqvrMDtLm88ZjtXKPvNL4Spvptd"}]},"property_1_1":{"name":"New Products by5ed","products":{"items":[{"blueId":"9mGcQeKTSDTrAdD9bJ1kDSxhRbPqKLudvX937Fvxm1Qs"},["Sub Product 1","Sub Product 2"]]},"property_1_1_1":{"blueId":"FZPSkgZWYy8x3ZEUeHJqF8BQ1epjRQeQDG89SnJhssf1"},"property_1_1_2":{"blueId":"FdaqU1kLfmJUpQoij9cmQJ8zTvxVbuB7uVJMwznvXdKC"},"property_1_1_3":{"blueId":"DapL23Dsy8XAbzThQD44RrpQT4ADEooMbu21sPXcAweo"}},"property_1_2":{"name":"Products ofzo8k","products":{"items":[{"blueId":"AEW8Ze5C5KZwaVX17a5ZR2fAuCrTe6uwdKMDvk7hXpQ1"},{"blueId":"BnhdJXp2FdXeksB1gUqvrMDtLm88ZjtXKPvNL4Spvptd"}]},"property_1_2_1":{"blueId":"A5u5qmMjxVHdH7PyTPxoose7PwWRCZTwVXvEFBnrLFro"},"property_1_2_2":{"blueId":"HgzxNcR2D7ujv8rrT7yxQ6tbaighDAnezomL9vNQgd8P"},"property_1_2_3":{"blueId":"3kyKhhXy2jpvQb59gFAFmSMBzAzbho3HomizWUNSY7by"}},"property_1_3":{"name":"Name wuwdq","createdAt":{"blueId":"GDjcyo4wGFv6HL4Tx6tRMqDk7N2gt8KUvFh2RTz57mWD","value":"2024-05-15T09:11:13.136Z"},"createdBy":{"blueId":"5BphmBv2gKGyU2VrEmajDaSWP3KcWdCZBzhrP5fUjfH6","value":"User 839"},"property_1_3_1":{"blueId":"J9t7hQqbVCoQsnACG9K44idXURutzkqLKpaAxXVZpB82"},"property_1_3_2":{"blueId":"DckK5rS4L15eaHFfgKWe2xatieo3RkVS4PBCDmTVp6GT"},"property_1_3_3":{"blueId":"E6RpVNecRSxL9veDZrzrbt9uj68BWWMhoGKbz87xhJ42"}}},"property_2":{"name":"Name rwjit8","description":"Description v1upvgi","property_2_1":{"name":"Name zm7kcj","description":"Description f7wmyo","property_2_1_1":{"blueId":"D4TkogpTBpbCrJstjBM7cNkWSgMZQuw4utHahP1DMiFe"},"property_2_1_2":{"blueId":"5otp8bVB7WsmqZUYtW2vycsi6DiD7M7w6oKTfnsG6eP1"},"property_2_1_3":{"blueId":"Gz8yFmjphw7SfBpt7gaBCbTmdBGvTkRfpCWbTNSdghHC"}},"property_2_2":{"blueId":"12nR2SBWR9QT4bt97N9w1emGdHfo97ySGvYysZXA5CEH"}},"property_3":{"blueId":"97i78hcHUnEiWvx1ESHiFShPBbmtXZDrL1dp5ZRrjptr"},"property_4":{"blueId":"DdvTnSUx3QPaA7QbKaNmxFUL2VjriQgR3LwbKDMFJm5F"},"property_5":{"blueId":"HM5xSf98Hq37GYe1zu5Mgy4u3tMWYsZ7EcyyenKDCRWL"}}';

    expect(() => NodeDeserializer.deserialize(JSON.parse(json))).toThrow(
      /blueId nodes must be reference-only/,
    );
  });
});
