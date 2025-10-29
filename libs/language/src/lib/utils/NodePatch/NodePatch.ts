/* ---------------------------------------------------------------------------
   NodePatch.ts · Apply RFC-6902 patches to BlueNode graphs
   (c) 2025 — MIT licence
--------------------------------------------------------------------------- */
import { BlueNode } from '../../model/Node';
import {
  opAdd,
  opReplace,
  opRemove,
  opCopy,
  opMove,
  opTest,
} from './patch-operations';

/* ------------------------------------------------------------------ */
/* 1 · Public façade                                                  */
/* ------------------------------------------------------------------ */
export type BlueNodePatch =
  | { op: 'add'; path: string; val: unknown }
  | { op: 'remove'; path: string }
  | { op: 'replace'; path: string; val: unknown }
  | { op: 'move'; path: string; from: string }
  | { op: 'copy'; path: string; from: string }
  | { op: 'test'; path: string; val: unknown };

function applySingle(root: BlueNode, p: BlueNodePatch): boolean {
  switch (p.op) {
    case 'add':
      return opAdd(root, p.path, p.val);
    case 'replace':
      return opReplace(root, p.path, p.val);
    case 'remove':
      return opRemove(root, p.path);
    case 'copy':
      return opCopy(root, p.from, p.path);
    case 'move':
      return opMove(root, p.from, p.path);
    case 'test':
      return opTest(root, p.path, p.val);
  }
}

export function applyBlueNodePatches(
  root: BlueNode,
  patches: readonly BlueNodePatch[],
  mutateOriginal = false,
): BlueNode {
  let mutableBase = mutateOriginal ? root : root.clone();
  for (const patch of patches) {
    mutableBase = applyBlueNodePatch(mutableBase, patch, true);
  }
  return mutableBase;
}

export function applyBlueNodePatch(
  root: BlueNode,
  patch: BlueNodePatch,
  mutateOriginal = false,
): BlueNode {
  const base = mutateOriginal ? root : root.clone();
  applySingle(base, patch);
  return base;
}
