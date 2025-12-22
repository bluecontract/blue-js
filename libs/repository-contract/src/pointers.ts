import {
  OBJECT_CONTRACTS,
  OBJECT_MERGE_POLICY,
  OBJECT_SCHEMA,
} from './keys.js';

export class InvalidRepositoryPointerError extends Error {
  constructor(
    public readonly pointer: string,
    message?: string,
  ) {
    super(message ?? `Invalid repository pointer: ${pointer}`);
    this.name = 'InvalidRepositoryPointerError';
  }
}

export const RESERVED_ATTRIBUTES_POINTER_SEGMENTS: ReadonlySet<string> =
  new Set([
    'value',
    'items',
    'blueId',
    'blue',
    OBJECT_SCHEMA,
    OBJECT_MERGE_POLICY,
    OBJECT_CONTRACTS,
  ]);

const RESERVED_ATTRIBUTES_POINTER_TERMINALS: ReadonlySet<string> = new Set([
  'type',
  'itemType',
  'valueType',
  'keyType',
]);

export function unescapePointerToken(token: string): string {
  let result = '';
  for (let i = 0; i < token.length; i++) {
    const ch = token[i];
    if (ch !== '~') {
      result += ch;
      continue;
    }
    const next = token[i + 1];
    if (next === '0') {
      result += '~';
      i++;
    } else if (next === '1') {
      result += '/';
      i++;
    } else {
      throw new InvalidRepositoryPointerError(
        token,
        `Invalid escape sequence in pointer token: ~${next ?? ''}`,
      );
    }
  }
  return result;
}

export function parsePointer(pointer: string): string[] {
  if (pointer === '') {
    return [];
  }
  if (!pointer.startsWith('/')) {
    throw new InvalidRepositoryPointerError(
      pointer,
      'Pointer must start with "/" or be empty',
    );
  }

  const segments = pointer.split('/').slice(1);
  if (segments.some((segment) => segment.length === 0)) {
    throw new InvalidRepositoryPointerError(
      pointer,
      'Pointer must not contain empty segments',
    );
  }

  return segments.map(unescapePointerToken);
}

export function validatePointer(pointer: string): void {
  parsePointer(pointer);
}

export function validateAttributesAddedPointer(pointer: string): void {
  if (pointer === '' || !pointer.startsWith('/')) {
    throw new InvalidRepositoryPointerError(
      pointer,
      'Pointer must start with "/"',
    );
  }

  const segments = parsePointer(pointer);
  for (const segment of segments) {
    if (RESERVED_ATTRIBUTES_POINTER_SEGMENTS.has(segment)) {
      throw new InvalidRepositoryPointerError(
        pointer,
        `attributesAdded pointers must not reference reserved field '${segment}'`,
      );
    }
  }

  const terminal = segments.at(-1);
  if (terminal && RESERVED_ATTRIBUTES_POINTER_TERMINALS.has(terminal)) {
    throw new InvalidRepositoryPointerError(
      pointer,
      `attributesAdded pointers must not end with '${terminal}'`,
    );
  }
}
