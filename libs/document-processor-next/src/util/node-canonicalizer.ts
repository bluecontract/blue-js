import { Blue } from '@blue-labs/language';
import { Buffer } from 'node:buffer';

import type { Node } from '../types/index.js';

const blueHelper = new Blue();

function toCanonicalPayload(node: Node): unknown {
  return blueHelper.nodeToJson(node, 'official');
}

function canonicalizeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (value === true) {
    return 'true';
  }
  if (value === false) {
    return 'false';
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Canonical JSON cannot represent non-finite numbers');
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const serializedItems = value.map((item) => canonicalizeValue(item));
    return `[${serializedItems.join(',')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    const keys = entries.map(([key]) => key).sort();
    const serializedPairs = keys.map((key) => {
      const keyString = JSON.stringify(key);
      const serializedValue = canonicalizeValue(
        (value as Record<string, unknown>)[key],
      );
      return `${keyString}:${serializedValue}`;
    });
    return `{${serializedPairs.join(',')}}`;
  }
  throw new Error('Unsupported value encountered during canonicalization');
}

function canonicalJson(node: Node): string {
  const payload = toCanonicalPayload(node);
  return canonicalizeValue(payload);
}

export function canonicalSignature(node: Node | null | undefined): string | null {
  if (!node) {
    return null;
  }
  return canonicalJson(node);
}

export function canonicalSize(node: Node | null | undefined): number {
  const signature = canonicalSignature(node);
  if (signature == null) {
    return 0;
  }
  return Buffer.byteLength(signature, 'utf8');
}
