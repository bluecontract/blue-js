import { normalizePointer } from '../../util/pointer-utils.js';

export function descendantOrEqual(
  pathValue: string,
  ancestorValue: string,
): boolean {
  const pathSegments = splitPointer(pathValue);
  const ancestorSegments = splitPointer(ancestorValue);
  if (ancestorSegments.length > pathSegments.length) {
    return false;
  }
  return ancestorSegments.every(
    (segment, index) => segment === pathSegments[index],
  );
}

export function strictlyInside(
  pathValue: string,
  ancestorValue: string,
): boolean {
  return (
    normalizePointer(pathValue) !== normalizePointer(ancestorValue) &&
    descendantOrEqual(pathValue, ancestorValue)
  );
}

export function parentPointer(pointer: string): string | null {
  const segments = splitPointer(pointer);
  if (segments.length === 0) {
    return null;
  }
  if (segments.length === 1) {
    return '/';
  }
  return `/${segments.slice(0, -1).map(escapePointerSegment).join('/')}`;
}

export function metadataWriteNodePath(pointer: string): string | null {
  const segments = splitPointer(pointer);
  if (segments.length === 0) {
    return null;
  }
  const last = segments[segments.length - 1];
  if (
    last !== 'type' &&
    last !== 'itemType' &&
    last !== 'keyType' &&
    last !== 'valueType'
  ) {
    return null;
  }
  if (segments.length === 1) {
    return '/';
  }
  return `/${segments.slice(0, -1).map(escapePointerSegment).join('/')}`;
}

export function splitPointer(pointer: string): string[] {
  const normalized = normalizePointer(pointer);
  if (normalized === '/') {
    return [];
  }
  return normalized
    .slice(1)
    .split('/')
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
}

export function escapePointerSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}
