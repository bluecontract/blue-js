export function normalizeSnapshotPointer(pointer: string): string | undefined {
  if (pointer === '' || pointer === '/') {
    return '/';
  }

  if (!pointer.startsWith('/')) {
    return undefined;
  }

  const normalizedSegments: string[] = [];

  for (const segment of pointer.slice(1).split('/')) {
    const decodedSegment = decodeSnapshotPointerSegment(segment);
    if (decodedSegment === undefined) {
      return undefined;
    }

    normalizedSegments.push(encodeSnapshotPointerSegment(decodedSegment));
  }

  return `/${normalizedSegments.join('/')}`;
}

export function appendSnapshotPointerSegment(
  pointer: string,
  segment: string,
): string {
  const encodedSegment = encodeSnapshotPointerSegment(segment);
  return pointer === '/'
    ? `/${encodedSegment}`
    : `${pointer}/${encodedSegment}`;
}

export function encodeSnapshotPointerSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

export function decodeSnapshotPointerSegment(
  segment: string,
): string | undefined {
  if (/~(?![01])/.test(segment)) {
    return undefined;
  }

  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}
