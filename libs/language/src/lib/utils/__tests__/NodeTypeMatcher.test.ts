import { Blue } from '../../Blue';
import { BasicNodeProvider } from '../../provider/BasicNodeProvider';
import { NodeTypeMatcher } from '../NodeTypeMatcher';

describe('NodeTypeMatcher', () => {
  test('basic type/value/shape cases (no constraints)', () => {
    const nodeProvider = new BasicNodeProvider();

    const a = `name: A
value: AAA`;

    nodeProvider.addSingleDocs(a);

    const b = `name: B
x:
  type:
    blueId: ${nodeProvider.getBlueIdByName('A')}`;

    nodeProvider.addSingleDocs(b);

    const c = `name: C`;
    nodeProvider.addSingleDocs(c);

    const bId = nodeProvider.getBlueIdByName('B');
    const cId = nodeProvider.getBlueIdByName('C');

    const bInst = `name: B Instance
type:
  blueId: ${bId}
x: AAA`;
    nodeProvider.addSingleDocs(bInst);

    const typeOK1 = `x:
  type:
    blueId: ${nodeProvider.getBlueIdByName('A')}`;

    const typeOK2 = `x: AAA`;

    const typeFailWrongType = `x:
  type:
    name: C`;

    const typeFailWrongBlue = `type:
  blueId: ${cId}
x: AAA`;

    const typeFailExtraProp = `type:
  blueId: ${bId}
x: AAA
y: d`;

    const blue = new Blue({ nodeProvider });
    const matcher = new NodeTypeMatcher(blue);
    const bInstNode = nodeProvider.getNodeByName('B Instance');

    expect(matcher.matchesType(bInstNode, blue.yamlToNode(typeOK1))).toBe(true);
    expect(matcher.matchesType(bInstNode, blue.yamlToNode(typeOK2))).toBe(true);
    expect(
      matcher.matchesType(bInstNode, blue.yamlToNode(typeFailWrongType))
    ).toBe(false);
    expect(
      matcher.matchesType(bInstNode, blue.yamlToNode(typeFailWrongBlue))
    ).toBe(false);
    expect(
      matcher.matchesType(bInstNode, blue.yamlToNode(typeFailExtraProp))
    ).toBe(false);
  });

  test('nested shapes: lists and properties', () => {
    const nodeProvider = new BasicNodeProvider();

    const item = `name: Item
value: 1`;

    // Load item to get its blueId
    nodeProvider.addSingleDocs(item);
    const itemId = nodeProvider.getBlueIdByName('Item');

    // Add second item to test negative blueId case
    const item2 = `name: Item2
value: 2`;
    nodeProvider.addSingleDocs(item2);
    const item2Id = nodeProvider.getBlueIdByName('Item2');

    // Now load listOwner referencing the itemId
    const listOwnerDoc = `name: ListOwner
items:
  - blueId: ${itemId}`;
    nodeProvider.addSingleDocs(listOwnerDoc);

    const container = `name: Container
list:
  blueId: ${nodeProvider.getBlueIdByName('ListOwner')}`;
    nodeProvider.addSingleDocs(container);

    const blue = new Blue({ nodeProvider });
    const matcher = new NodeTypeMatcher(blue);

    const containerInst = nodeProvider.getNodeByName('Container');

    // Positive: reference the same item by blueId
    const okNestedShape = `list:
  items:
    - blueId: ${itemId}`;
    expect(
      matcher.matchesType(containerInst, blue.yamlToNode(okNestedShape))
    ).toBe(true);

    // Negative: wrong referenced item
    const failNestedValue = `list:
  items:
    - blueId: ${item2Id}`;
    expect(
      matcher.matchesType(containerInst, blue.yamlToNode(failNestedValue))
    ).toBe(false);

    // Negative: require extra property that does not exist
    const failExtra = `list:
  items:
    - value: 1
      extra: something`;
    expect(matcher.matchesType(containerInst, blue.yamlToNode(failExtra))).toBe(
      false
    );
  });

  test('blueId exact matches when requested', () => {
    const nodeProvider = new BasicNodeProvider();

    const alpha = `name: Alpha`;
    const beta = `name: Beta`;
    nodeProvider.addSingleDocs(alpha, beta);

    const alphaId = nodeProvider.getBlueIdByName('Alpha');
    const betaId = nodeProvider.getBlueIdByName('Beta');

    const container = `name: Holder
x:
  blueId: ${alphaId}`;
    nodeProvider.addSingleDocs(container);

    const blue = new Blue({ nodeProvider });
    const matcher = new NodeTypeMatcher(blue);
    const node = nodeProvider.getNodeByName('Holder');

    // ok: blueId matches
    const ok = `x:
  blueId: ${alphaId}`;
    expect(matcher.matchesType(node, blue.yamlToNode(ok))).toBe(true);

    // fail: blueId differs
    const fail = `x:
  blueId: ${betaId}`;
    expect(matcher.matchesType(node, blue.yamlToNode(fail))).toBe(false);
  });
});
