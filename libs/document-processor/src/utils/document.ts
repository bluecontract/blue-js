import { DocumentNode } from '../types';
import { makePath } from './path';
import { PatchApplicationError } from './exceptions';
import { ProcessEmbeddedSchema } from '@blue-repository/core-dev';
import {
  applyBlueNodePatch,
  type BlueNodePatch,
  BlueNodeTypeSchema,
  Blue,
} from '@blue-labs/language';
import { deepFreeze } from '@blue-labs/shared-utils';

/* ---------------------------------------------------------- */
/* Helper: collect absolute embedded paths once per document  */
/* ---------------------------------------------------------- */
type EmbeddedSpec = { absPath: string; contractPath: string };

/**
 * Makes a document immutable during processing for safety
 */
export function freeze(doc: DocumentNode): DocumentNode {
  return deepFreeze(doc);
}

/**
 * Creates a mutable copy of a document for processing
 */
export function mutable(doc: DocumentNode): DocumentNode {
  return doc.clone();
}

export function collectEmbeddedPaths(
  doc: DocumentNode,
  blue: Blue,
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
      const processEmbedded = blue.nodeToSchemaOutput(
        node,
        ProcessEmbeddedSchema
      );
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
    collectEmbeddedPaths(value as DocumentNode, blue, makePath(base, key), out);
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

  let mutableDoc = mutable(document);

  for (const patch of patches) {
    try {
      mutableDoc = applyBlueNodePatch(mutableDoc, patch, true);
    } catch (error) {
      throw new PatchApplicationError(patch, error);
    }
  }

  return freeze(mutableDoc);
}
