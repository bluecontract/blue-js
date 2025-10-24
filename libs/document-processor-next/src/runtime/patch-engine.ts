import { BlueNode } from '@blue-labs/language';
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
    const segments = splitPointer(targetPath);
    const before = cloneAtSafe(this.document, segments, 'before', targetPath);
    switch (patch.op) {
      case 'ADD':
        this.applyAdd(segments, targetPath, patch.val ?? null);
        break;
      case 'REPLACE':
        this.applyReplace(segments, targetPath, patch.val ?? null);
        break;
      case 'REMOVE':
        this.applyRemove(segments, targetPath);
        break;
    }
    const after =
      patch.op === 'REMOVE'
        ? null
        : cloneAtSafe(this.document, segments, 'after', targetPath);
    return {
      path: targetPath,
      before,
      after,
      op: patch.op.toLowerCase() as PatchOp,
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

  private applyAdd(
    segments: string[],
    path: string,
    value: Node | null
  ): void {
    if (path === '/' || path.length === 0) {
      throw new Error('ADD operation cannot target document root');
    }
    const { parent, key, pointer, created } = this.resolveParentForPatch(segments, path, 'ADD');
    try {
      if (isArrayIndexSegment(key)) {
        const items = parent.getItems();
        const isAppend = key === ARRAY_APPEND_TOKEN;
        if (!items) {
          throw new Error(isAppend ? `Append token '-' requires array at ${pointer}` : `Array index segment requires array at ${pointer}`);
        }
        if (isAppend) {
          const mutable = ensureMutableItems(parent, items);
          mutable.push(cloneValue(value));
          return;
        }
        const index = parseArrayIndex(key, path);
        if (index < 0 || index > items.length) {
          throw new Error(`Array index out of bounds in path: ${path}`);
        }
        const mutable = ensureMutableItems(parent, items);
        mutable.splice(index, 0, cloneValue(value));
        return;
      }

      const properties = ensureMutableProperties(parent);
      properties[key] = cloneValue(value);
      parent.setProperties(properties);
    } catch (error) {
      this.rollbackCreated(created);
      throw error;
    }
  }

  private applyReplace(
    segments: string[],
    path: string,
    value: Node | null
  ): void {
    if (path === '/' || path.length === 0) {
      throw new Error('REPLACE operation cannot target document root');
    }
    const { parent, key, created } = this.resolveParentForPatch(segments, path, 'REPLACE');
    try {
      if (isArrayIndexSegment(key)) {
        const items = parent.getItems();
        if (!items) {
          throw new Error(`Array index segment requires array at ${path}`);
        }
        const index = parseArrayIndex(key, path);
        if (index < 0 || index >= items.length) {
          throw new Error(`Array index out of bounds in path: ${path}`);
        }
        items[index] = cloneValue(value);
        parent.setItems(items);
        return;
      }

      const properties = ensureMutableProperties(parent);
      properties[key] = cloneValue(value);
      parent.setProperties(properties);
    } catch (error) {
      this.rollbackCreated(created);
      throw error;
    }
  }

  private applyRemove(segments: string[], path: string): void {
    if (path === '/' || path.length === 0) {
      throw new Error('REMOVE operation cannot target document root');
    }
    const { parent, key } = this.resolveParentForPatch(segments, path, 'REMOVE');

    if (isArrayIndexSegment(key)) {
      const items = parent.getItems();
      if (!items) {
        throw new Error(`Array index segment requires array at ${path}`);
      }
      const index = parseArrayIndex(key, path);
      if (index < 0 || index >= items.length) {
        throw new Error(`Array index out of bounds in path: ${path}`);
      }
      items.splice(index, 1);
      parent.setItems(items);
      return;
    }

    const currentProps = parent.getProperties();
    if (!currentProps || !Object.prototype.hasOwnProperty.call(currentProps, key)) {
      throw new Error(`Path does not exist: ${path}`);
    }
    const properties = { ...currentProps };
    delete properties[key];
    parent.setProperties(properties);
  }

  private resolveParentForPatch(
    segments: string[],
    originalPath: string,
    op: 'ADD' | 'REPLACE' | 'REMOVE',
  ): { parent: BlueNode; key: string; pointer: string; created: Array<{ owner: BlueNode; key: string }> } {
    if (segments.length === 0) {
      throw new Error(`${op} operation cannot target document root`);
    }
    let current = this.document as BlueNode;
    const created: Array<{ owner: BlueNode; key: string }> = [];
    for (let i = 0; i < segments.length - 1; i += 1) {
      const segment = segments[i];
      const pointer = pointerPrefix(segments, i + 1);
      if (isArrayIndexSegment(segment)) {
        const items = current.getItems();
        if (!items) {
          throw new Error(`Array index segment requires array at ${pointer}`);
        }
        const index = parseArrayIndex(segment, pointer);
        if (index < 0 || index >= items.length) {
          throw new Error(`Array index out of bounds in path: ${pointer}`);
        }
        const child = items[index];
        if (!(child instanceof BlueNode)) {
          throw new Error(`Array index out of bounds in path: ${pointer}`);
        }
        current = child;
        continue;
      }

      let properties = current.getProperties();
      let child = properties?.[segment] ?? null;
      if (!(child instanceof BlueNode)) {
        if (op === 'REMOVE') {
          throw new Error(`Path does not exist: ${pointer}`);
        }
        child = new BlueNode();
        if (!properties) {
          properties = {};
        }
        properties[segment] = child;
        current.setProperties(properties);
        created.push({ owner: current, key: segment });
      }
      current = child;
    }
    const key = segments[segments.length - 1];
    return { parent: current, key, pointer: originalPath, created };
  }

  private rollbackCreated(created: Array<{ owner: BlueNode; key: string }>): void {
    for (let i = created.length - 1; i >= 0; i -= 1) {
      const { owner, key } = created[i];
      const props = owner.getProperties();
      if (!props) {
        continue;
      }
      delete props[key];
      if (Object.keys(props).length === 0) {
        owner.setProperties(undefined);
      } else {
        owner.setProperties(props);
      }
    }
  }
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

function cloneAtSafe(
  root: Node,
  segments: readonly string[],
  mode: 'before' | 'after',
  path: string
): Node | null {
  try {
    if (segments.length === 0) {
      return root.clone();
    }
    const node = readNode(root, segments, mode, path);
    return node ? node.clone() : null;
  } catch {
    return null;
  }
}

function readNode(
  root: Node,
  segments: readonly string[],
  mode: 'before' | 'after',
  path: string
): Node | null {
  let current: Node | null = root;
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i] ?? '';
    const last = i === segments.length - 1;
    current = descendForRead(current, segment, last, mode, path);
    if (!current) {
      return null;
    }
  }
  return current;
}

function descendForRead(
  current: Node | null,
  segment: string,
  isLast: boolean,
  mode: 'before' | 'after',
  path: string
): Node | null {
  if (!current) {
    return null;
  }

  const items = current.getItems();
  if (items) {
    if (segment === ARRAY_APPEND_TOKEN) {
      if (!isLast) {
        throw new Error(`Append token '-' must be final segment: ${path}`);
      }
      if (mode === 'before') {
        return null;
      }
      if (items.length === 0) {
        return null;
      }
      return items[items.length - 1] ?? null;
    }
    const index = parseArrayIndex(segment, path);
    if (index < 0 || index >= items.length) {
      return null;
    }
    return items[index] ?? null;
  }

  const properties = current.getProperties() as Record<string, Node> | undefined;
  if (!properties) {
    return null;
  }
  const next = properties[segment];
  if (!(next instanceof BlueNode)) {
    return null;
  }
  return next;
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

function cloneValue(value: Node | null): BlueNode {
  if (value == null) {
    return new BlueNode().setValue(null);
  }
  const cloned = value.clone();
  return cloned as BlueNode;
}
