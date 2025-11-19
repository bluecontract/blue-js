function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodePointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function isArrayIndex(segment: string): boolean {
  if (segment.length === 0) {
    return false;
  }
  if (!/^\d+$/.test(segment)) {
    return false;
  }
  const index = Number(segment);
  return Number.isSafeInteger(index);
}

export function unwrapCanonicalValue(value: unknown, deep = true): unknown {
  if (Array.isArray(value)) {
    if (!deep) {
      return value.slice();
    }
    return value.map((item) => unwrapCanonicalValue(item, true));
  }
  if (!isPlainObject(value)) {
    return value;
  }

  if (Object.prototype.hasOwnProperty.call(value, 'value')) {
    const nested = (value as Record<string, unknown>).value;
    return deep ? unwrapCanonicalValue(nested, true) : nested;
  }

  const items = (value as Record<string, unknown>).items;
  if (Array.isArray(items)) {
    if (!deep) {
      return items.slice();
    }
    return items.map((item) => unwrapCanonicalValue(item, true));
  }

  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    result[key] = deep ? unwrapCanonicalValue(child, true) : child;
  }
  return result;
}

export function getCanonicalPointerValue(
  target: unknown,
  pointer: string,
): unknown {
  if (pointer === '') {
    return target;
  }
  if (!pointer.startsWith('/')) {
    throw new TypeError('JSON pointer must start with "/"');
  }
  const segments = pointer
    .split('/')
    .slice(1)
    .map((segment) => decodePointerSegment(segment));

  let current: unknown = target;
  for (const segment of segments) {
    if (current == null) {
      return undefined;
    }
    if (Array.isArray(current)) {
      if (!isArrayIndex(segment)) {
        return undefined;
      }
      const index = Number(segment);
      current = current[index];
      continue;
    }
    if (isPlainObject(current)) {
      current = (current as Record<string, unknown>)[segment];
      continue;
    }
    return undefined;
  }
  return current;
}
