import { DocumentNode } from '../types';
import { makePath } from './path';
import { PatchApplicationError } from './exceptions';
import { ProcessEmbeddedSchema } from '../../../repo/core';
import { BlueNodeTypeSchema } from '../../utils/TypeSchema';
import { NodeToObjectConverter } from '../../mapping/NodeToObjectConverter';
import { applyBlueNodePatch, BlueNodePatch } from '../../utils/NodePatch';
import { deepFreeze } from '../../../utils/deepFreeze';

// Config flag for enabling immutability
export const ENABLE_IMMUTABILITY = true; // This should be configurable

/* ---------------------------------------------------------- */
/* Helper: collect absolute embedded paths once per document  */
/* ---------------------------------------------------------- */
type EmbeddedSpec = { absPath: string; contractPath: string };

// TODO: use Blue instead
const nodeToObject = new NodeToObjectConverter();

export function collectEmbeddedPaths(
  doc: DocumentNode,
  base = '/',
  out: EmbeddedSpec[] = []
): EmbeddedSpec[] {
  const contracts = (doc.getContracts() ?? {}) as Record<string, DocumentNode>;

  for (const [name, node] of Object.entries(contracts)) {
    const isProcessEmbedded = BlueNodeTypeSchema.isTypeOf(
      node,
      ProcessEmbeddedSchema
    );
    if (isProcessEmbedded) {
      const processEmbedded = nodeToObject.convert(node, ProcessEmbeddedSchema);
      const paths = processEmbedded.paths ?? [];

      for (const rel of paths) {
        out.push({
          absPath: makePath(base, rel),
          contractPath: makePath(base, `contracts/${name}`),
        });
      }
    }
  }

  for (const [key, value] of Object.entries(doc.getProperties() ?? {})) {
    collectEmbeddedPaths(value as DocumentNode, makePath(base, key), out);
  }
  return out;
}

/* ---------------------------------------------------------- */
/* Helper: does a patch path fall inside one of those paths?  */
/* ---------------------------------------------------------- */
export function isInside(target: string, root: string): boolean {
  return (
    target === root || target.startsWith(root.endsWith('/') ? root : root + '/')
  );
}

/**
 * Apply a collection of patches to a document
 */
export function applyPatches(
  document: DocumentNode,
  patches: BlueNodePatch[]
): DocumentNode {
  if (!patches.length) return document;

  let mutableDoc = document.clone();

  for (const patch of patches) {
    try {
      mutableDoc = applyBlueNodePatch(mutableDoc, [patch]);
    } catch (error) {
      throw new PatchApplicationError(patch, error);
    }
  }

  return ENABLE_IMMUTABILITY ? deepFreeze(mutableDoc) : mutableDoc;
}

/**
 * Create an immutable copy of a document if immutability is enabled
 */
export function createImmutableDocument(document: DocumentNode): DocumentNode {
  return ENABLE_IMMUTABILITY ? deepFreeze(document.clone()) : document.clone();
}
