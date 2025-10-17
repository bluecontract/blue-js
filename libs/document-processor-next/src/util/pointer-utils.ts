function isNullOrEmpty(value: string | null | undefined): value is null | '' | undefined {
  return value == null || value.length === 0;
}

export function normalizeScope(scopePath: string | null | undefined): string {
  if (isNullOrEmpty(scopePath)) {
    return '/';
  }
  return scopePath!.startsWith('/') ? scopePath! : `/${scopePath}`;
}

export function normalizePointer(pointer: string | null | undefined): string {
  if (isNullOrEmpty(pointer)) {
    return '/';
  }
  return pointer!.startsWith('/') ? pointer! : `/${pointer}`;
}

export function stripSlashes(value: string | null | undefined): string {
  if (value == null) {
    return '';
  }
  let stripped = value.trim();
  if (stripped.length === 0) {
    return '';
  }
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
  tail: string | null | undefined,
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
  relativePointer: string | null | undefined,
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
  absolutePath: string | null | undefined,
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
