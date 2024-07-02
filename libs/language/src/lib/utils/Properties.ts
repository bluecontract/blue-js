export const OBJECT_NAME = 'name';
export const OBJECT_DESCRIPTION = 'description';
export const OBJECT_TYPE = 'type';
export const OBJECT_CONSTRAINTS = 'constraints';
export const OBJECT_VALUE = 'value';
export const OBJECT_ITEMS = 'items';
export const OBJECT_REF = 'ref';
export const OBJECT_BLUE_ID = 'blueId';
export const OBJECT_SPECIFIC_KEYS = [
  OBJECT_NAME,
  OBJECT_DESCRIPTION,
  OBJECT_TYPE,
  OBJECT_CONSTRAINTS,
  OBJECT_VALUE,
  OBJECT_ITEMS,
  OBJECT_REF,
  OBJECT_BLUE_ID,
] as const;

export const TRANSLATION_TRANSLATION = 'translation';
export const TRANSLATION_TRANSLATION_SOURCE = 'translation source';
export const TRANSLATION_TRANSLATION_TARGET_LANGUAGE =
  'translation target language';

export const TEXT_TYPE = 'Text';
export const NUMBER_TYPE = 'Number';
export const INTEGER_TYPE = 'Integer';
export const BOOLEAN_TYPE = 'Boolean';

export const BASIC_TYPES = [
  TEXT_TYPE,
  NUMBER_TYPE,
  INTEGER_TYPE,
  BOOLEAN_TYPE,
] as const;
