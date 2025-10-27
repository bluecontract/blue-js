import { Blue, BlueNode } from '@blue-labs/language';
import canonicalize from 'canonicalize';

function toCanonicalPayload(blue: Blue, node: BlueNode): unknown {
  return blue.nodeToJson(node, 'official');
}

function canonicalJson(blue: Blue, node: BlueNode): string {
  const payload = toCanonicalPayload(blue, node);
  return canonicalize(payload);
}

export function canonicalSignature(
  blue: Blue,
  node: BlueNode | null | undefined
): string | null {
  if (!node) {
    return null;
  }
  return canonicalJson(blue, node);
}

export function canonicalSize(
  blue: Blue,
  node: BlueNode | null | undefined
): number {
  const signature = canonicalSignature(blue, node);
  if (signature == null) {
    return 0;
  }
  // Use TextEncoder for browser-compatible UTF-8 byte length
  return new TextEncoder().encode(signature).length;
}
