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
items:
  type: List
  itemType: Integer
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
items:
  - not integer
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
        focusPointer: '/items/1',
        yaml: (typeId: string) => `
type:
  blueId: ${typeId}
items:
  - 1
  - not integer
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
