import { Blue } from '@blue-labs/language';
import { Buffer } from 'node:buffer';
import canonicalize from 'canonicalize';
import type { Node } from '../types/index.js';

// TODO: Replace with NodeToMapListOrValue.get or use blue from context
const blueHelper = new Blue();

function toCanonicalPayload(node: Node): unknown {
  return blueHelper.nodeToJson(node, 'official');
}

function canonicalJson(node: Node): string {
  const payload = toCanonicalPayload(node);
  return canonicalize(payload);
}

export function canonicalSignature(
  node: Node | null | undefined
): string | null {
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
