import {
  Blue,
  BlueIdCalculator,
  BlueNode,
  createNodeProvider,
} from '@blue-labs/language';
import { describe, expect, it } from 'vitest';

import { BlueNodeTypeGraphProvider } from '../type-graph-provider.js';

describe('BlueNodeTypeGraphProvider', () => {
  it('delegates validation to the real Blue matcher for semantic shape checks', () => {
    const types = new Map<string, { blueId: string; node: BlueNode }>();
    const nodeProvider = createNodeProvider((blueId) =>
      [...types.values()]
        .filter((type) => type.blueId === blueId)
        .map((type) => type.node.clone()),
    );
    const seedBlue = new Blue({ nodeProvider });
    const addType = (name: string, yaml: string): string => {
      const node = seedBlue.yamlToNode(yaml);
      const blueId = BlueIdCalculator.calculateBlueIdSync(node);
      types.set(name, { blueId, node });
      return blueId;
    };

    addType(
      'RequiredAmountOrder',
      `
name: RequiredAmountOrder
amount:
  type: Integer
  schema:
    required: true
`,
    );
    addType(
      'IntegerListHolder',
      `
name: IntegerListHolder
lineItems:
  type: List
  itemType: Integer
`,
    );
    addType(
      'AtLeastTwoItemsHolder',
      `
name: AtLeastTwoItemsHolder
lineItems:
  type: List
  schema:
    minItems: 2
`,
    );
    addType(
      'AtMostOneItemHolder',
      `
name: AtMostOneItemHolder
lineItems:
  type: List
  schema:
    maxItems: 1
`,
    );
    addType(
      'IntegerDictionaryHolder',
      `
name: IntegerDictionaryHolder
values:
  type: Dictionary
  valueType: Integer
`,
    );
    addType(
      'AtLeastTwoFieldsHolder',
      `
name: AtLeastTwoFieldsHolder
attributes:
  type: Dictionary
  schema:
    minFields: 2
`,
    );
    addType(
      'AtMostOneFieldHolder',
      `
name: AtMostOneFieldHolder
attributes:
  type: Dictionary
  schema:
    maxFields: 1
`,
    );
    addType(
      'EURPrice',
      `
name: EURPrice
currency: EUR
`,
    );
    addType(
      'FixedTerms',
      `
name: FixedTerms
terms:
  cancellation: non_refundable
`,
    );
    addType(
      'FixedList',
      `
name: FixedList
allowed:
  - first
  - second
`,
    );
    const componentOrderId = addType(
      'ComponentOrder',
      `
name: ComponentOrder
`,
    );
    const hotelComponentOrderId = addType(
      'HotelComponentOrder',
      `
name: HotelComponentOrder
type:
  blueId: ${componentOrderId}
hotelId:
  type: Text
  schema:
    required: true
`,
    );
    addType(
      'PackageWithHotelComponent',
      `
name: PackageWithHotelComponent
component:
  type:
    blueId: ${hotelComponentOrderId}
`,
    );
    const blue = new Blue({ nodeProvider });
    const provider = new BlueNodeTypeGraphProvider(blue);

    const invalidCases = [
      {
        typeName: 'RequiredAmountOrder',
        yaml: (typeId: string) => `
type:
  blueId: ${typeId}
`,
      },
      {
        typeName: 'IntegerListHolder',
        yaml: (typeId: string) => `
type:
  blueId: ${typeId}
lineItems:
  - not integer
`,
      },
      {
        typeName: 'AtLeastTwoItemsHolder',
        yaml: (typeId: string) => `
type:
  blueId: ${typeId}
lineItems:
  - one
`,
      },
      {
        typeName: 'AtMostOneItemHolder',
        yaml: (typeId: string) => `
type:
  blueId: ${typeId}
lineItems:
  - one
  - two
`,
      },
      {
        typeName: 'IntegerDictionaryHolder',
        yaml: (typeId: string) => `
type:
  blueId: ${typeId}
values:
  x: not integer
`,
      },
      {
        typeName: 'AtLeastTwoFieldsHolder',
        yaml: (typeId: string) => `
type:
  blueId: ${typeId}
attributes:
  a: one
`,
      },
      {
        typeName: 'AtMostOneFieldHolder',
        yaml: (typeId: string) => `
type:
  blueId: ${typeId}
attributes:
  a: one
  b: two
`,
      },
      {
        typeName: 'EURPrice',
        yaml: (typeId: string) => `
type:
  blueId: ${typeId}
currency: USD
`,
      },
      {
        typeName: 'FixedTerms',
        yaml: (typeId: string) => `
type:
  blueId: ${typeId}
terms:
  cancellation: refundable
`,
      },
      {
        typeName: 'FixedList',
        yaml: (typeId: string) => `
type:
  blueId: ${typeId}
allowed:
  - first
  - other
`,
      },
      {
        typeName: 'PackageWithHotelComponent',
        yaml: (typeId: string) => `
type:
  blueId: ${typeId}
component:
  type:
    blueId: ${componentOrderId}
`,
      },
    ];

    for (const { typeName, yaml } of invalidCases) {
      const typeId = types.get(typeName)?.blueId ?? fail(typeName);
      const node = blue.yamlToNode(yaml(typeId));
      expect(provider.isValidForType(node, '/', node, typeId), typeName).toBe(
        false,
      );
    }

    const focusedInvalidCases = [
      {
        typeName: 'RequiredAmountOrder',
        focusPointer: '/amount',
        yaml: (typeId: string) => `
type:
  blueId: ${typeId}
amount:
  description: metadata-only amount
`,
      },
      {
        typeName: 'IntegerListHolder',
        focusPointer: '/lineItems/1',
        yaml: (typeId: string) => `
type:
  blueId: ${typeId}
lineItems:
  - 1
  - not integer
`,
      },
      {
        typeName: 'AtLeastTwoItemsHolder',
        focusPointer: '/lineItems',
        yaml: (typeId: string) => `
type:
  blueId: ${typeId}
lineItems:
  - one
`,
      },
      {
        typeName: 'AtMostOneItemHolder',
        focusPointer: '/lineItems/1',
        yaml: (typeId: string) => `
type:
  blueId: ${typeId}
lineItems:
  - one
  - two
`,
      },
      {
        typeName: 'IntegerDictionaryHolder',
        focusPointer: '/values/x',
        yaml: (typeId: string) => `
type:
  blueId: ${typeId}
values:
  x: not integer
`,
      },
      {
        typeName: 'AtLeastTwoFieldsHolder',
        focusPointer: '/attributes',
        yaml: (typeId: string) => `
type:
  blueId: ${typeId}
attributes:
  a: one
`,
      },
      {
        typeName: 'AtMostOneFieldHolder',
        focusPointer: '/attributes/b',
        yaml: (typeId: string) => `
type:
  blueId: ${typeId}
attributes:
  a: one
  b: two
`,
      },
      {
        typeName: 'EURPrice',
        focusPointer: '/currency',
        yaml: (typeId: string) => `
type:
  blueId: ${typeId}
currency: USD
`,
      },
      {
        typeName: 'FixedTerms',
        focusPointer: '/terms/cancellation',
        yaml: (typeId: string) => `
type:
  blueId: ${typeId}
terms:
  cancellation: refundable
`,
      },
      {
        typeName: 'FixedList',
        focusPointer: '/allowed/1',
        yaml: (typeId: string) => `
type:
  blueId: ${typeId}
allowed:
  - first
  - other
`,
      },
    ];

    for (const { typeName, yaml, focusPointer } of focusedInvalidCases) {
      const typeId = types.get(typeName)?.blueId ?? fail(typeName);
      const node = blue.yamlToNode(yaml(typeId));
      expect(
        provider.isValidForType(
          node,
          '/',
          node,
          typeId,
          undefined,
          focusPointer,
        ),
        `${typeName} focused at ${focusPointer}`,
      ).toBe(false);
    }
  });
});

function fail(typeName: string): never {
  throw new Error(`Missing test type ${typeName}`);
}
