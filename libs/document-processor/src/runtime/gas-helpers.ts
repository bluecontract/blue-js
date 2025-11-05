import { normalizePointer } from '../util/pointer-utils.js';

export function ceil100(n: number): number {
  return Math.floor((n + 99) / 100);
}

export function utf8(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function pointerDepth(absPointer: string): number {
  const normalized = normalizePointer(absPointer);
  if (normalized === '/') {
    return 0;
  }
  return normalized.split('/').length - 1;
}

export function jsCodeBaseAmount(code: string): number {
  return 100 + ceil100(utf8(code));
}

export function updateDocumentBaseAmount(changesetLength: number): number {
  return 40 + 5 * Math.max(0, changesetLength);
}

export function expressionAmount(expression: string): number {
  return 5 + ceil100(utf8(expression));
}

export function templateAmount(
  placeholderCount: number,
  template: string,
): number {
  return 3 * Math.max(0, placeholderCount) + ceil100(utf8(template));
}

export function documentSnapshotAmount(
  absPointer: string,
  snapshotBytes: number,
): number {
  return 8 + pointerDepth(absPointer) + ceil100(snapshotBytes);
}
