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
