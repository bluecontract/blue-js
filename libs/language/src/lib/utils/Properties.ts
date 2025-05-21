// Properties.ts

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
export const OBJECT_CONTRACTS = 'contracts';

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
  OBJECT_CONTRACTS,
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

export const TEXT_TYPE_BLUE_ID = 'F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP';
export const DOUBLE_TYPE_BLUE_ID =
  '68ryJtnmui4j5rCZWUnkZ3DChtmEb7Z9F8atn1mBSM3L';
export const INTEGER_TYPE_BLUE_ID =
  'DHmxTkFbXePZHCHCYmQr2dSzcNLcryFVjXVHkdQrrZr8';
export const BOOLEAN_TYPE_BLUE_ID =
  'EL6AjrbJsxTWRTPzY8WR8Y2zAMXRbydQj83PcZwuAHbo';
export const LIST_TYPE_BLUE_ID = 'G8wmfjEqugPEEXByMYWJXiEdbLToPRWNQEekNxrxfQWB';
export const DICTIONARY_TYPE_BLUE_ID =
  '294NBTj2mFRL3RB4kDRUSckwGg7Kzj6T8CTAFeR1kcSA';

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
  CORE_TYPES.map((type, index) => [type, CORE_TYPE_BLUE_IDS[index]])
) as Record<(typeof CORE_TYPES)[number], (typeof CORE_TYPE_BLUE_IDS)[number]>;

export const CORE_TYPE_BLUE_ID_TO_NAME_MAP = Object.fromEntries(
  CORE_TYPE_BLUE_IDS.map((blueId, index) => [blueId, CORE_TYPES[index]])
) as Record<(typeof CORE_TYPE_BLUE_IDS)[number], (typeof CORE_TYPES)[number]>;
