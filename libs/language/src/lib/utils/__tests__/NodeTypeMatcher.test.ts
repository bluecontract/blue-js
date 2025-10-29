import { Blue } from '../../Blue';
import { BasicNodeProvider } from '../../provider/BasicNodeProvider';
import { BlueNode } from '../../model';
import { NodeTypeMatcher } from '../NodeTypeMatcher';
import { DICTIONARY_TYPE_BLUE_ID } from '../Properties';

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
      matcher.matchesType(bInstNode, blue.yamlToNode(typeFailWrongType)),
    ).toBe(false);
    expect(
      matcher.matchesType(bInstNode, blue.yamlToNode(typeFailWrongBlue)),
    ).toBe(false);
    expect(
      matcher.matchesType(bInstNode, blue.yamlToNode(typeFailExtraProp)),
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
      matcher.matchesType(containerInst, blue.yamlToNode(okNestedShape)),
    ).toBe(true);

    // Negative: wrong referenced item
    const failNestedValue = `list:
  items:
    - blueId: ${item2Id}`;
    expect(
      matcher.matchesType(containerInst, blue.yamlToNode(failNestedValue)),
    ).toBe(false);

    // Negative: require extra property that does not exist
    const failExtra = `list:
  items:
    - value: 1
      extra: something`;
    expect(matcher.matchesType(containerInst, blue.yamlToNode(failExtra))).toBe(
      false,
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

  test('list itemType enforces item shape', () => {
    const nodeProvider = new BasicNodeProvider();

    const allowedItem = `name: Allowed Item
value: ok`;
    const forbiddenItem = `name: Forbidden Item
value: not-ok`;
    nodeProvider.addSingleDocs(allowedItem, forbiddenItem);

    const allowedItemId = nodeProvider.getBlueIdByName('Allowed Item');
    const forbiddenItemId = nodeProvider.getBlueIdByName('Forbidden Item');

    const listWithAllowed = `name: Allowed Container
itemsList:
  type: List
  items:
    - blueId: ${allowedItemId}
`; // simple case with a single allowed element

    const listWithForbidden = `name: Forbidden Container
itemsList:
  type: List
  items:
    - blueId: ${forbiddenItemId}
`;

    nodeProvider.addSingleDocs(listWithAllowed, listWithForbidden);

    const blue = new Blue({ nodeProvider });
    const matcher = new NodeTypeMatcher(blue);

    const targetTypeYaml = `itemsList:
  type: List
  itemType:
    blueId: ${allowedItemId}`;
    const targetType = blue.yamlToNode(targetTypeYaml);

    expect(
      matcher.matchesType(
        nodeProvider.getNodeByName('Allowed Container'),
        targetType,
      ),
    ).toBe(true);

    expect(
      matcher.matchesType(
        nodeProvider.getNodeByName('Forbidden Container'),
        targetType,
      ),
    ).toBe(false);
  });

  test('implicit List/Dictionary structural matching', () => {
    const nodeProvider = new BasicNodeProvider();

    // Implicit list node: has items, but no explicit type
    const implicitListDoc = `name: ImplicitListNode
items:
  - value: 1
  - value: 2`;
    nodeProvider.addSingleDocs(implicitListDoc);

    // Implicit dictionary node: has properties, but no explicit type
    const implicitDictDoc = `name: ImplicitDictNode
a:
  value: 1
b:
  value: 2`;
    nodeProvider.addSingleDocs(implicitDictDoc);

    const blue = new Blue({ nodeProvider });
    const matcher = new NodeTypeMatcher(blue);

    const implicitListNode = nodeProvider.getNodeByName('ImplicitListNode');
    const implicitDictNode = nodeProvider.getNodeByName('ImplicitDictNode');

    // Target types expect core List/Dictionary using blueIds
    const listTypeOnly = `type: List`;
    const dictTypeOnly = `type: Dictionary`;

    // Positive cases: implicit structures should satisfy corresponding core types
    expect(
      matcher.matchesType(implicitListNode, blue.yamlToNode(listTypeOnly)),
    ).toBe(true);
    expect(
      matcher.matchesType(implicitDictNode, blue.yamlToNode(dictTypeOnly)),
    ).toBe(true);

    // Negative cross-cases
    expect(
      matcher.matchesType(implicitListNode, blue.yamlToNode(dictTypeOnly)),
    ).toBe(false);
    expect(
      matcher.matchesType(implicitDictNode, blue.yamlToNode(listTypeOnly)),
    ).toBe(false);

    // Explicit wrong type should not match, even if structure resembles a list
    const explicitTextButHasItems = `type: Text
items:
  - value: 1`;
    expect(
      matcher.matchesType(
        implicitListNode,
        blue.yamlToNode(explicitTextButHasItems),
      ),
    ).toBe(false);
  });

  test('event-like json payloads: request as implicit list vs explicit List', () => {
    const nodeProvider = new BasicNodeProvider();
    const blue = new Blue({ nodeProvider });
    const matcher = new NodeTypeMatcher(blue);

    // Target type expects a List under message.request (use named core type)
    const targetTypeYaml = `message:
  request:
    type: List`;
    const targetType = blue.yamlToNode(targetTypeYaml);

    // Event with explicit List wrapper
    const explicitListEvent = blue.jsonValueToNode({
      message: {
        request: {
          type: 'List',
          items: [1, 2, 3],
        },
      },
    });
    expect(matcher.matchesType(explicitListEvent, targetType)).toBe(true);

    // Event with implicit array (no explicit type)
    const implicitArrayEvent = blue.jsonValueToNode({
      message: {
        request: [1, 2, 3],
      },
    });
    expect(matcher.matchesType(implicitArrayEvent, targetType)).toBe(true);

    // Negative: request is an object (dictionary), not a list
    const wrongShapeEvent = blue.jsonValueToNode({
      message: {
        request: { a: 1, b: 2 },
      },
    });
    expect(matcher.matchesType(wrongShapeEvent, targetType)).toBe(false);
  });

  test('dictionary valueType enforces property types', () => {
    const nodeProvider = new BasicNodeProvider();

    const activationState = `name: Activation State
value: active`;
    const wrongState = `name: Wrong State
value: wrong`;
    nodeProvider.addSingleDocs(activationState, wrongState);

    const activationStateId = nodeProvider.getBlueIdByName('Activation State');
    const wrongStateId = nodeProvider.getBlueIdByName('Wrong State');

    const blue = new Blue({ nodeProvider });
    const matcher = new NodeTypeMatcher(blue);

    const targetTypeYaml = `participantsState:
  type: Dictionary
  valueType:
    blueId: ${activationStateId}`;
    const targetType = blue.yamlToNode(targetTypeYaml);

    const createNodeWithValueBlueId = (valueBlueId: string) =>
      new BlueNode('Container').setProperties({
        participantsState: new BlueNode()
          .setType(new BlueNode().setBlueId(DICTIONARY_TYPE_BLUE_ID))
          .setProperties({
            alice: new BlueNode()
              .setBlueId(valueBlueId)
              .setType(new BlueNode().setBlueId(valueBlueId)),
          }),
      });

    const matchingNode = createNodeWithValueBlueId(activationStateId);

    expect(matcher.matchesType(matchingNode, targetType)).toBe(true);

    const mismatchedNode = createNodeWithValueBlueId(wrongStateId);
    expect(matcher.matchesType(mismatchedNode, targetType)).toBe(false);
  });

  // Note: dictionary event-like case is covered in implicit structural tests above.
});
