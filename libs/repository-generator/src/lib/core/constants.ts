import { Properties } from '@blue-labs/language';

export const PRIMITIVE_TYPES = new Set<string>([...Properties.CORE_TYPES]);
export const PRIMITIVE_BLUE_IDS: Record<string, string> =
  Properties.CORE_TYPE_NAME_TO_BLUE_ID_MAP;

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
