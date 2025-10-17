import { Blue, BlueNode, applyBlueNodePatch } from '@blue-labs/language';
import type { JsonPatch } from '../model/shared/json-patch.js';
import type { Node } from '../types/index.js';
import { normalizePointer, normalizeScope } from '../util/pointer-utils.js';

const ARRAY_APPEND_TOKEN = '-';

type PatchOp = 'add' | 'replace' | 'remove';

export interface PatchResult {
  readonly path: string;
  readonly before: Node | null;
  readonly after: Node | null;
  readonly op: PatchOp;
  readonly originScope: string;
  readonly cascadeScopes: readonly string[];
}

export class PatchEngine {
  constructor(private document: Node) {}

  applyPatch(originScopePath: string, patch: JsonPatch): PatchResult {
    const normalizedScope = normalizeScope(originScopePath);
    const targetPath = normalizePointer(patch.path);
    const before = cloneAt(this.document, targetPath);

    const tsPatch = toBlueNodePatch(patch, targetPath);
    applyBlueNodePatch(this.document, tsPatch, true);

    const after = patch.op === 'REMOVE' ? null : cloneAt(this.document, targetPath);
    return {
      path: targetPath,
      before,
      after,
      op: tsPatch.op,
      originScope: normalizedScope,
      cascadeScopes: computeCascadeScopes(normalizedScope),
    };
  }

  directWrite(path: string, value: Node | null): void {
    const normalized = normalizePointer(path);
    if (normalized === '/') {
      throw new Error('Direct write cannot target root document');
    }
    const segments = splitPointer(normalized);
    const { parent, leaf } = this.resolveParent(segments);
    if (leaf === ARRAY_APPEND_TOKEN) {
      throw new Error(`Direct write does not support append token '-' for path ${normalized}`);
    }

    const items = parent.getItems();
    if (items && isArrayIndexSegment(leaf)) {
      this.directWriteArray(parent, items, leaf, value, normalized);
      return;
    }

    this.directWriteObject(parent, leaf, value);
  }

  private directWriteArray(parent: Node, items: Node[], leaf: string, value: Node | null, normalized: string): void {
    const mutable = ensureMutableItems(parent, items);
    const index = parseArrayIndex(leaf, normalized);
    if (value == null) {
      if (index < 0 || index >= mutable.length) {
        return;
      }
      mutable.splice(index, 1);
      parent.setItems(mutable);
      return;
    }
    const cloned = value.clone();
    if (index === mutable.length) {
      mutable.push(cloned);
      parent.setItems(mutable);
      return;
    }
    if (index >= 0 && index < mutable.length) {
      mutable[index] = cloned;
      parent.setItems(mutable);
      return;
    }
    throw new Error(`Array index out of bounds for direct write: ${normalized}`);
  }

  private directWriteObject(parent: Node, leaf: string, value: Node | null): void {
    const properties = ensureMutableProperties(parent);
    if (value == null) {
      delete properties[leaf];
      parent.setProperties(Object.keys(properties).length > 0 ? properties : undefined);
      return;
    }
    properties[leaf] = value.clone();
    parent.setProperties(properties);
  }

  private resolveParent(segments: readonly string[]): { parent: Node; leaf: string } {
    if (segments.length === 0) {
      throw new Error('Cannot apply direct write to root');
    }
    let current = this.document;
    for (let i = 0; i < segments.length - 1; i += 1) {
      const segment = segments[i];
      current = this.getOrCreateChild(current, segment, segments, i + 1);
    }
    return { parent: current, leaf: segments[segments.length - 1] };
  }

  private getOrCreateChild(
    current: Node,
    segment: string,
    segments: readonly string[],
    depth: number,
  ): Node {
    if (segment === ARRAY_APPEND_TOKEN) {
      throw new Error(`Append token '-' must be final segment: ${pointerPrefix(segments, depth)}`);
    }
    const items = current.getItems();
    if (items && isArrayIndexSegment(segment)) {
      const index = parseArrayIndex(segment, pointerPrefix(segments, depth));
      if (index < 0 || index >= items.length) {
        throw new Error(`Array index out of bounds: ${pointerPrefix(segments, depth)}`);
      }
      const child = items[index];
      if (!child) {
        throw new Error(`Path does not exist: ${pointerPrefix(segments, depth)}`);
      }
      return child;
    }

    const properties = ensureMutableProperties(current);
    let child = properties[segment];
    if (!child) {
      child = new BlueNode();
      properties[segment] = child;
      current.setProperties(properties);
    }
    return child;
  }
}

function toBlueNodePatch(patch: JsonPatch, normalizedPath: string) {
  const base = patch.op.toLowerCase() as PatchOp;
  if (base === 'remove') {
    return { op: 'remove' as const, path: normalizedPath };
  }
  const value = patch.val ? patch.val.clone() : null;
  return { op: base, path: normalizedPath, val: value ?? null };
}

function computeCascadeScopes(scopePath: string): string[] {
  const scopes: string[] = [];
  let current = scopePath;
  while (true) {
    scopes.push(current);
    if (current === '/') {
      break;
    }
    const idx = current.lastIndexOf('/');
    current = idx <= 0 ? '/' : current.substring(0, idx);
  }
  return scopes;
}

function cloneAt(root: Node, pointer: string): Node | null {
  if (pointer === '/' || pointer === '') {
    return root.clone();
  }
  try {
    const value = root.get(pointer);
    if (value instanceof BlueNode) {
      return value.clone();
    }
    if (value === undefined) {
      return null;
    }
    const node = blueHelper.jsonValueToNode(value);
    return node.clone();
  } catch {
    return null;
  }
}

function splitPointer(path: string): string[] {
  if (path === '/' || path === '') {
    return [];
  }
  const raw = path.startsWith('/') ? path.slice(1) : path;
  if (raw.length === 0) {
    return [];
  }
  return raw.split('/');
}

function parseArrayIndex(segment: string, path: string): number {
  const value = Number.parseInt(segment, 10);
  if (Number.isNaN(value)) {
    throw new Error(`Expected numeric array index in path: ${path}`);
  }
  if (value < 0) {
    throw new Error(`Negative array index in path: ${path}`);
  }
  return value;
}

function pointerPrefix(segments: readonly string[], length: number): string {
  if (length <= 0) {
    return '/';
  }
  const limit = Math.min(length, segments.length);
  let result = '';
  for (let i = 0; i < limit; i += 1) {
    result += `/${segments[i] ?? ''}`;
  }
  return result === '' ? '/' : result;
}

function ensureMutableItems(node: Node, original: Node[]): Node[] {
  const mutable = [...original];
  node.setItems(mutable);
  return mutable;
}

function ensureMutableProperties(node: Node): Record<string, Node> {
  const properties = node.getProperties();
  if (!properties) {
    const fresh: Record<string, Node> = {};
    node.setProperties(fresh);
    return fresh;
  }
  const clone: Record<string, Node> = { ...properties };
  node.setProperties(clone);
  return clone;
}

function isArrayIndexSegment(segment: string): boolean {
  return segment === ARRAY_APPEND_TOKEN || /^\d+$/.test(segment);
}
const blueHelper = new Blue();
