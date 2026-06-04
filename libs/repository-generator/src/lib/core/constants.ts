import { Properties } from '@blue-labs/language';
import { BUILTIN_RUNTIME_TYPE_NAME_TO_BLUE_ID_MAP } from './builtinRuntimeTypes';

export const PRIMITIVE_BLUE_IDS: Record<string, string> = {
  ...Properties.CORE_TYPE_NAME_TO_BLUE_ID_MAP,
  ...BUILTIN_RUNTIME_TYPE_NAME_TO_BLUE_ID_MAP,
};
export const PRIMITIVE_TYPES = new Set<string>(Object.keys(PRIMITIVE_BLUE_IDS));
export const SCALAR_PRIMITIVE_TYPES = new Set<string>([
  ...Properties.BASIC_TYPES,
]);

export const RESERVED_LANGUAGE_KEYS = new Set<string>([
  'name',
  'description',
  'type',
  'itemType',
  'keyType',
  'valueType',
  'value',
  'items',
  'blueId',
  'blue',
  'schema',
  'mergePolicy',
  'contracts',
]);

export const BLUE_REPOSITORY_NAME = 'Blue Repository';

export const BLUE_TYPE_STATUS = {
  Dev: 'dev',
  Stable: 'stable',
} as const;

export type BlueTypeStatusLiteral =
  (typeof BLUE_TYPE_STATUS)[keyof typeof BLUE_TYPE_STATUS];

export const IGNORED_PACKAGE_DIRS = new Set([
  '.git',
  '.github',
  '.husky',
  'node_modules',
  '.nx',
  '.vscode',
  '.idea',
]);
