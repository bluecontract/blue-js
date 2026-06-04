// Properties.ts
import {
  OBJECT_SCHEMA,
  OBJECT_MERGE_POLICY,
  OBJECT_CONTRACTS,
} from '@blue-labs/repository-contract';

export {
  OBJECT_SCHEMA,
  OBJECT_MERGE_POLICY,
  OBJECT_CONTRACTS,
} from '@blue-labs/repository-contract';

export const OBJECT_NAME = 'name';
export const OBJECT_DESCRIPTION = 'description';
export const OBJECT_TYPE = 'type';
export const OBJECT_ITEM_TYPE = 'itemType';
export const OBJECT_KEY_TYPE = 'keyType';
export const OBJECT_VALUE_TYPE = 'valueType';
export const OBJECT_VALUE = 'value';
export const OBJECT_ITEMS = 'items';
export const OBJECT_BLUE_ID = 'blueId';
export const OBJECT_BLUE = 'blue';
export const OBJECT_CONSTRAINTS = 'constraints';
export const OBJECT_PROPERTIES = 'properties';
export const LIST_MERGE_POLICY_POSITIONAL = 'positional';
export const LIST_MERGE_POLICY_APPEND_ONLY = 'append-only';
export const LIST_CONTROL_PREVIOUS = '$previous';
export const LIST_CONTROL_POS = '$pos';
export const LIST_CONTROL_REPLACE = '$replace';
export const LIST_CONTROL_EMPTY = '$empty';

export const OBJECT_SPECIFIC_KEYS = [
  OBJECT_NAME,
  OBJECT_DESCRIPTION,
  OBJECT_TYPE,
  OBJECT_ITEM_TYPE,
  OBJECT_KEY_TYPE,
  OBJECT_VALUE_TYPE,
  OBJECT_VALUE,
  OBJECT_ITEMS,
  OBJECT_BLUE_ID,
  OBJECT_BLUE,
  OBJECT_SCHEMA,
  OBJECT_MERGE_POLICY,
  OBJECT_CONTRACTS,
  OBJECT_CONSTRAINTS,
  OBJECT_PROPERTIES,
  LIST_CONTROL_PREVIOUS,
  LIST_CONTROL_POS,
  LIST_CONTROL_REPLACE,
  LIST_CONTROL_EMPTY,
] as const;

export const TEXT_TYPE = 'Text';
export const DOUBLE_TYPE = 'Double';
export const INTEGER_TYPE = 'Integer';
export const BOOLEAN_TYPE = 'Boolean';
export const LIST_TYPE = 'List';
export const DICTIONARY_TYPE = 'Dictionary';

export const BASIC_TYPES = [
  TEXT_TYPE,
  DOUBLE_TYPE,
  INTEGER_TYPE,
  BOOLEAN_TYPE,
] as const;
export const CORE_TYPES = [...BASIC_TYPES, LIST_TYPE, DICTIONARY_TYPE] as const;

export const TEXT_TYPE_BLUE_ID = 'GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC';
export const DOUBLE_TYPE_BLUE_ID =
  '9eWaHYz2vKrFofdHTHAizNNu8xP6QE3WQ5y7DGrGZvyJ';
export const INTEGER_TYPE_BLUE_ID =
  'E2LM6qgzWG9ttagq2xTmiZkgYEAgkYedFCmU9v7NnVEq';
export const BOOLEAN_TYPE_BLUE_ID =
  'AwvXD961fmnmqcSQhjMA7r15HpVh39cefb6ZTyUz2Fm2';
export const LIST_TYPE_BLUE_ID = '8DSFoWG9MqRSUhStqoPLrwVQiYByRh18NWbDEarN8MKF';
export const DICTIONARY_TYPE_BLUE_ID =
  'Efkz9D1ARMM7rU43w3rDNVqat1naS6qXKCqP4eHin3yG';

export const BASIC_TYPE_BLUE_IDS = [
  TEXT_TYPE_BLUE_ID,
  DOUBLE_TYPE_BLUE_ID,
  INTEGER_TYPE_BLUE_ID,
  BOOLEAN_TYPE_BLUE_ID,
] as const;
export const CORE_TYPE_BLUE_IDS = [
  ...BASIC_TYPE_BLUE_IDS,
  LIST_TYPE_BLUE_ID,
  DICTIONARY_TYPE_BLUE_ID,
] as const;

export const CORE_TYPE_NAME_TO_BLUE_ID_MAP = Object.fromEntries(
  CORE_TYPES.map((type, index) => [type, CORE_TYPE_BLUE_IDS[index]]),
) as Record<(typeof CORE_TYPES)[number], (typeof CORE_TYPE_BLUE_IDS)[number]>;

export const CORE_TYPE_BLUE_ID_TO_NAME_MAP = Object.fromEntries(
  CORE_TYPE_BLUE_IDS.map((blueId, index) => [blueId, CORE_TYPES[index]]),
) as Record<(typeof CORE_TYPE_BLUE_IDS)[number], (typeof CORE_TYPES)[number]>;

export const BLUE_CONTRACTS_RUNTIME_TYPE_NAME_TO_BLUE_ID_MAP = {
  Contract: '6WrVQoSpKHUUg5HPrwjkVV6pxe4sdkyGnakMs8ayEGeF',
  'Json Patch Entry': '61W96XosAp3DrEC7PuqLYtmF2A6ETpqH6qF2DgYwDq4c',
  'Contract Execution Result': 'AMtAXPmvumgz1GxKUU9uv3ncXiKMENvqq8AaLvD5LXhv',
  Channel: '4FAZ94JPExNM4pn2ZhtdHa4CVP7uASmLNVrBy7aCG1p5',
  Handler: '7X46P3Q6FJrogqKrBXTALpqzkieyyiQeatnqLvWzAPXE',
  Marker: '6zqbYGDGrMv5ReuEsjyzyyjjuqVnqDZxtY7RsPXdBTNy',
  'Process Embedded': '8FVc8MPz6DcTMgcY3RXU6EBpGa9arWPJ141K2H86yi8Q',
  'Processing Initialized Marker':
    '6JjyUKoK7uJxA5NY9YhMaKJbXC6c9iHyx1khv4gaAq4Q',
  'Processing Terminated Marker':
    'GBDBthfshBFr4GQKUU1fmy4GnPL7q2y3as4deUWpuBtu',
  'Channel Event Checkpoint': '9GEC24YbFG9hj4banjYh2oEnDpAob1wAPmhjuykJp8T1',
  'Type Generalization Policy': 'Fbenow6tanFHkWzKiDD8fGxminQswQ1FecMRakaCx2WX',
  'Type Generalization Rule': '7Vnmk8StjwY7e9mBNpACrn8oh3KZ7yQBjnXe5bLDWn4D',
  'Document Update Channel': 'Ac9LC5T7pHVa1TtkhMBjBRtxecShzvbe7ugUdXT1Mu2o',
  'Triggered Event Channel': '5HwxfbwRBCxG8xYpowWkCPC9akqUSKV7So2M4QHEmLsZ',
  'Lifecycle Event Channel': '2DXGQUiQBQ6CT89jwAsTAXaEPhLgiSXhKCGh9Q7Hv3MQ',
  'Embedded Node Channel': 'H6iUJp3GcLypsJDimMSVoxQQdxxuD8j6eqEUWWqCZ6i',
  'Document Update': '7HEaG1SpBdsbVHsrwRTZSZGmpJUWHfFoEzecYWpjo1vm',
  'Document Processing Initiated':
    'Ht1o66MTLKf7JmnEiR27rRLSwdz8FUTgf2mGPNuLSDUL',
  'Document Processing Terminated':
    '4HWncQEQsdpk8zcXxYxgdtoXo5nKHxFPWeJfTscCbmeK',
  'Document Processing Fatal Error':
    'AMZbj5tNGxjPrvaNyw56sfqcLSW2j1XmkncEYUVtgmVC',
} as const;

export const DEFAULT_BLUE_TYPE_NAME_TO_BLUE_ID_MAP = {
  ...CORE_TYPE_NAME_TO_BLUE_ID_MAP,
  ...BLUE_CONTRACTS_RUNTIME_TYPE_NAME_TO_BLUE_ID_MAP,
} as const;

export const BLUE_CONTRACTS_RUNTIME_TYPE_BLUE_ID_TO_NAME_MAP =
  Object.fromEntries(
    Object.entries(BLUE_CONTRACTS_RUNTIME_TYPE_NAME_TO_BLUE_ID_MAP).map(
      ([name, blueId]) => [blueId, name],
    ),
  ) as Record<
    (typeof BLUE_CONTRACTS_RUNTIME_TYPE_NAME_TO_BLUE_ID_MAP)[keyof typeof BLUE_CONTRACTS_RUNTIME_TYPE_NAME_TO_BLUE_ID_MAP],
    keyof typeof BLUE_CONTRACTS_RUNTIME_TYPE_NAME_TO_BLUE_ID_MAP
  >;

export const DEFAULT_BLUE_TYPE_BLUE_ID_TO_NAME_MAP = {
  ...CORE_TYPE_BLUE_ID_TO_NAME_MAP,
  ...BLUE_CONTRACTS_RUNTIME_TYPE_BLUE_ID_TO_NAME_MAP,
} as const;
