/**
 * 1:1 port of {@code blue.language.processor.util.PointerUtils}.
 */
export function normalizeScope(
  scopePath: string | null | undefined
): string {
  const value = scopePath ?? '';
  if (value.length === 0) {
    return '/';
  }
  return value.startsWith('/') ? value : `/${value}`;
}

export function normalizePointer(
  pointer: string | null | undefined
): string {
  const value = pointer ?? '';
  if (value.length === 0) {
    return '/';
  }
  return value.startsWith('/') ? value : `/${value}`;
}

export function stripSlashes(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? '';
  if (trimmed.length === 0) {
    return '';
  }
  let stripped = trimmed;
  while (stripped.startsWith('/')) {
    stripped = stripped.substring(1);
  }
  while (stripped.endsWith('/')) {
    stripped = stripped.substring(0, stripped.length - 1);
  }
  return stripped;
}

export function joinRelativePointers(
  base: string | null | undefined,
  tail: string | null | undefined
): string {
  const basePart = stripSlashes(base);
  const tailPart = stripSlashes(tail);
  if (basePart.length === 0 && tailPart.length === 0) {
    return '/';
  }
  if (basePart.length === 0) {
    return `/${tailPart}`;
  }
  if (tailPart.length === 0) {
    return `/${basePart}`;
  }
  return `/${basePart}/${tailPart}`;
}

export function resolvePointer(
  scopePath: string | null | undefined,
  relativePointer: string | null | undefined
): string {
  const normalizedScope = normalizeScope(scopePath);
  const normalizedPointer = normalizePointer(relativePointer);
  if (normalizedScope === '/') {
    return normalizedPointer;
  }
  if (normalizedPointer === '/') {
    return normalizedScope;
  }
  if (normalizedPointer.length === 1) {
    return normalizedScope;
  }
  return `${normalizedScope}${normalizedPointer}`;
}

export function relativizePointer(
  scopePath: string | null | undefined,
  absolutePath: string | null | undefined
): string {
  const normalizedScope = normalizeScope(scopePath);
  const normalizedAbsolute = normalizePointer(absolutePath);
  if (normalizedScope === '/') {
    return normalizedAbsolute;
  }
  if (!normalizedAbsolute.startsWith(normalizedScope)) {
    return normalizedAbsolute;
  }
  if (normalizedAbsolute.length === normalizedScope.length) {
    return '/';
  }
  const remainder = normalizedAbsolute.substring(normalizedScope.length);
  if (remainder.length === 0) {
    return '/';
  }
  return remainder.startsWith('/') ? remainder : `/${remainder}`;
}
