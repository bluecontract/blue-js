import { Blue } from '../../Blue';
import { BasicNodeProvider } from '../../provider/BasicNodeProvider';
import { BlueNode } from '../../model';
import { NodeTypeMatcher } from '../NodeTypeMatcher';
import { DICTIONARY_TYPE_BLUE_ID, TEXT_TYPE_BLUE_ID } from '../Properties';
import { BlueIdCalculator } from '../BlueIdCalculator';
import type { BlueRepository } from '../../types/BlueRepository';

const matcherRepository = buildMatcherRepository();

function buildMatcherRepository(): BlueRepository {
  const blue = new Blue();
  const definitions = [
    {
      alias: 'Matcher/Permission',
      name: 'Permission',
      json: {
        name: 'Permission',
        read: { type: 'Boolean' },
      },
    },
    {
      alias: 'Matcher/Permission Set',
      name: 'Permission Set',
      json: {
        name: 'Permission Set',
        type: 'Dictionary',
        keyType: 'Text',
        valueType: 'Matcher/Permission',
      },
    },
    {
      alias: 'Matcher/Link',
      name: 'Link',
      json: {
        name: 'Link',
        anchor: { type: 'Text' },
      },
    },
    {
      alias: 'Matcher/Session Link',
      name: 'Session Link',
      json: {
        name: 'Session Link',
        type: 'Matcher/Link',
        sessionId: { type: 'Text' },
      },
    },
    {
      alias: 'Matcher/Document Links',
      name: 'Document Links',
      json: {
        name: 'Document Links',
        type: 'Dictionary',
        keyType: 'Text',
        valueType: 'Matcher/Link',
      },
    },
    {
      alias: 'Matcher/Change Entry',
      name: 'Change Entry',
      json: {
        name: 'Change Entry',
        op: { type: 'Text' },
        path: { type: 'Text' },
        val: { type: 'Text' },
      },
    },
    {
      alias: 'Matcher/Change Request',
      name: 'Change Request',
      json: {
        name: 'Change Request',
        changeset: {
          type: 'List',
          itemType: 'Matcher/Change Entry',
        },
      },
    },
    {
      alias: 'Matcher/Worker Permission',
      name: 'Worker Permission',
      json: {
        name: 'Worker Permission',
        workerType: { type: 'Text' },
        permissions: {
          type: 'Dictionary',
          keyType: 'Text',
          valueType: 'Boolean',
        },
      },
    },
    {
      alias: 'Matcher/Grant Progress',
      name: 'Grant Progress',
      json: {
        name: 'Grant Progress',
        granteeDocumentId: { type: 'Text' },
        allowedWorkerAgencyPermissions: {
          type: 'List',
          itemType: 'Matcher/Worker Permission',
        },
      },
    },
  ] as const;

  const aliases: Record<string, string> = {};
  const typesMeta: BlueRepository['packages'][string]['typesMeta'] = {};
  const contents: BlueRepository['packages'][string]['contents'] = {};

  for (const definition of definitions) {
    const node = blue.jsonValueToNode(definition.json);
    const blueId = BlueIdCalculator.calculateBlueIdSync(node);

    blue.registerBlueIds({ [definition.alias]: blueId });

    aliases[definition.alias] = blueId;
    typesMeta[blueId] = {
      status: 'stable',
      name: definition.name,
      versions: [
        {
          repositoryVersionIndex: 0,
          typeBlueId: blueId,
          attributesAdded: [],
        },
      ],
    };
    contents[blueId] = blue.nodeToJson(node);
  }

  return {
    name: 'matcher.repo',
    repositoryVersions: ['R0'],
    packages: {
      matcher: {
        name: 'matcher',
        aliases,
        typesMeta,
        contents,
        schemas: {},
      },
    },
  };
}

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

  test('explicit blueId matchers reject mismatched node blueIds even when type blueId matches', () => {
    const nodeProvider = new BasicNodeProvider();

    nodeProvider.addSingleDocs(`name: Alpha`, `name: Beta`);

    const alphaId = nodeProvider.getBlueIdByName('Alpha');
    const betaId = nodeProvider.getBlueIdByName('Beta');

    const blue = new Blue({ nodeProvider });
    const matcher = new NodeTypeMatcher(blue);

    const node = blue.yamlToNode(`blueId: ${betaId}
type:
  blueId: ${alphaId}`);

    const targetType = blue.yamlToNode(`blueId: ${alphaId}`);

    expect(matcher.matchesType(node, targetType)).toBe(false);
  });

  test('schema-owned matchers reject untyped nodes with unrelated blueIds', () => {
    const nodeProvider = new BasicNodeProvider();

    nodeProvider.addSingleDocs(
      `name: Expected Schema
label:
  type: Text`,
      `name: Other Schema
label:
  type: Text`,
    );

    const blue = new Blue({ nodeProvider });
    const matcher = new NodeTypeMatcher(blue);

    const expectedSchema = nodeProvider.getNodeByName('Expected Schema');
    const otherSchemaId = nodeProvider.getBlueIdByName('Other Schema');

    const structuralNode = blue.yamlToNode(`label: ok`);
    const wrongBlueIdNode = blue.yamlToNode(`blueId: ${otherSchemaId}
label: ok`);

    expect(matcher.matchesType(structuralNode, expectedSchema)).toBe(true);
    expect(matcher.matchesType(wrongBlueIdNode, expectedSchema)).toBe(false);
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

  test('top-level implicit collections should still honor matcher constraints', () => {
    const nodeProvider = new BasicNodeProvider();
    const blue = new Blue({ nodeProvider });
    const matcher = new NodeTypeMatcher(blue);

    const implicitListNode = blue.jsonValueToNode([1, 2, 3]);
    const implicitDictNode = blue.jsonValueToNode({
      first: 1,
      second: 2,
    });

    const listMatcher = blue.yamlToNode(`type: List
itemType: Text`);
    const dictMatcher = blue.yamlToNode(`type: Dictionary
valueType: Text`);

    expect(matcher.matchesType(implicitListNode, listMatcher)).toBe(false);
    expect(matcher.matchesType(implicitDictNode, dictMatcher)).toBe(false);
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

  test('dictionary valueType should contextually resolve implicit structured values', () => {
    const nodeProvider = new BasicNodeProvider();

    nodeProvider.addSingleDocs(`name: Participant State
read:
  type: Text`);

    const participantStateId =
      nodeProvider.getBlueIdByName('Participant State');

    const blue = new Blue({ nodeProvider });
    const matcher = new NodeTypeMatcher(blue);

    const targetType = blue.yamlToNode(`participantsState:
  type: Dictionary
  valueType:
    type:
      blueId: ${participantStateId}`);

    const node = blue.yamlToNode(`participantsState:
  alice:
    read: ok
  bob:
    read: yes`);

    expect(matcher.matchesType(node, targetType)).toBe(true);
  });

  test('blueId references with keyType are not treated as bare references', () => {
    const blue = new Blue({ nodeProvider: new BasicNodeProvider() });
    const matcher = new NodeTypeMatcher(blue) as unknown as {
      isBareBlueIdReference(node: BlueNode): boolean;
    };

    const constrainedReference = new BlueNode()
      .setBlueId(DICTIONARY_TYPE_BLUE_ID)
      .setKeyType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID));

    expect(matcher.isBareBlueIdReference(constrainedReference)).toBe(false);
  });

  // Note: dictionary event-like case is covered in implicit structural tests above.

  test('self-referential schema types do not overflow during comparison', () => {
    const nodeProvider = new BasicNodeProvider();

    nodeProvider.addSingleDocs(`name: Recursive Type
label:
  type: Text
next:
  type:
    blueId: this`);

    const blue = new Blue({ nodeProvider });
    const matcher = new NodeTypeMatcher(blue);
    const recursiveType = nodeProvider.getNodeByName('Recursive Type');
    const recursiveTypeId = recursiveType.getBlueId()!;

    const instance = blue.yamlToNode(`type:
  blueId: ${recursiveTypeId}
label: root`);

    expect(matcher.matchesType(instance, recursiveType)).toBe(true);
  });

  test('repository valueType accepts implicit structured values when the type schema matches', () => {
    const blue = new Blue({ repositories: [matcherRepository] });
    const matcher = new NodeTypeMatcher(blue);

    const node = blue.resolve(
      blue.jsonValueToNode({
        type: 'Matcher/Permission Set',
        orders: {
          read: true,
        },
      }),
    );

    expect(matcher.matchesType(node, node.getType()!)).toBe(true);
  });

  test('repository valueType accepts explicit subtypes of the declared base type', () => {
    const blue = new Blue({ repositories: [matcherRepository] });
    const matcher = new NodeTypeMatcher(blue);

    const node = blue.resolve(
      blue.jsonValueToNode({
        type: 'Matcher/Document Links',
        shopOrdersLink: {
          type: 'Matcher/Session Link',
          sessionId: 'shop-session',
          anchor: 'orders',
        },
      }),
    );

    expect(matcher.matchesType(node, node.getType()!)).toBe(true);
  });

  test('repository itemType accepts implicit structured items when the type schema matches', () => {
    const blue = new Blue({ repositories: [matcherRepository] });
    const matcher = new NodeTypeMatcher(blue);

    const changeRequest = blue.resolve(
      blue.jsonValueToNode({
        type: 'Matcher/Change Request',
        changeset: [
          {
            op: 'replace',
            path: '/title',
            val: 'Updated',
          },
        ],
      }),
    );

    expect(matcher.matchesType(changeRequest, changeRequest.getType()!)).toBe(
      true,
    );

    const workerAgencyGrant = blue.resolve(
      blue.jsonValueToNode({
        type: 'Matcher/Grant Progress',
        granteeDocumentId: 'doc-1',
        allowedWorkerAgencyPermissions: [
          {
            workerType: 'agent',
            permissions: {
              read: true,
            },
          },
        ],
      }),
    );

    expect(
      matcher.matchesType(workerAgencyGrant, workerAgencyGrant.getType()!),
    ).toBe(true);
  });
});
