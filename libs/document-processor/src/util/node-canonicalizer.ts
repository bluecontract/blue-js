import { Blue, BlueNode } from '@blue-labs/language';
import canonicalize from 'canonicalize';

function toCanonicalPayload(blue: Blue, node: BlueNode): unknown {
  return blue.nodeToJson(node, 'official');
}

function canonicalNodeJson(blue: Blue, node: BlueNode): string {
  const payload = toCanonicalPayload(blue, node);
  return canonicalize(payload);
}

export function canonicalSize(
  blue: Blue,
  node: BlueNode | null | undefined,
): number {
  if (!node) {
    return 0;
  }
  const payload = canonicalNodeJson(blue, node);
  // Use TextEncoder for browser-compatible UTF-8 byte length
  return new TextEncoder().encode(payload).length;
}
