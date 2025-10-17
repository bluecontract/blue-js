import {
  NodeToMapListOrValue,
  BlueNode,
  JsonCanonicalizer,
} from '@blue-labs/language';
import { illegalState } from 'src/types/errors.js';

/**
 * Derives the RFC-8785 canonical JSON string for a Blue node.
 */
export function canonicalJson(node: BlueNode): string {
  try {
    const jsonValue = NodeToMapListOrValue.get(node, 'official');
    const canonical = JsonCanonicalizer.canonicalize(jsonValue);

    if (typeof canonical !== 'string') {
      throw new Error('Canonicalization returned a non-string result');
    }

    return canonical;
  } catch {
    throw illegalState('Failed to canonicalize node');
  }
}

/**
 * Computes the canonical JSON size in UTF-8 bytes for a Blue node.
 */
export function canonicalSize(node: BlueNode | null): number {
  if (node == null) {
    return 0;
  }

  const canonical = canonicalJson(node);
  return Buffer.byteLength(canonical, 'utf8');
}

/**
 * Computes the canonical JSON signature for a Blue node.
 */
export function canonicalSignature(node: BlueNode | null): string | null {
  if (node == null) {
    return null;
  }

  return canonicalJson(node);
}
