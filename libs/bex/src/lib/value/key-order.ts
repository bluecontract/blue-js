export function compareUnicodeCodePoints(left: string, right: string): number {
  const leftPoints = Array.from(left);
  const rightPoints = Array.from(right);
  const length = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < length; index += 1) {
    const leftCodePoint = leftPoints[index].codePointAt(0) ?? 0;
    const rightCodePoint = rightPoints[index].codePointAt(0) ?? 0;
    if (leftCodePoint !== rightCodePoint) {
      return leftCodePoint - rightCodePoint;
    }
  }
  return leftPoints.length - rightPoints.length;
}

export function sortBexKeys(keys: string[]): string[] {
  return [...keys].sort(compareUnicodeCodePoints);
}
