/* ---------------------------------------------------------------------------
   blue-node-patch.ts · Apply RFC-6902 patches to BlueNode graphs
   (c) 2025 — MIT licence
--------------------------------------------------------------------------- */
import { BlueNode } from '../model/Node';
import { NodeDeserializer } from '../model/NodeDeserializer';
import { BigIntegerNumber } from '../model/BigIntegerNumber';
import { BigDecimalNumber } from '../model/BigDecimalNumber';
import { JsonPrimitive } from '@blue-company/shared-utils';

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

export function applyBlueNodePatch(
  root: BlueNode,
  patches: readonly BlueNodePatch[],
  mutateOriginal = false
): BlueNode {
  const base = mutateOriginal ? root : root.clone();
  patches.forEach((p) => applySingle(base, p));
  return base;
}

/* ------------------------------------------------------------------ */
/* 2 · Path helpers                                                   */
/* ------------------------------------------------------------------ */
const decode = (s: string): string => s.replace(/~1/g, '/').replace(/~0/g, '~');

function split(path: string): string[] {
  if (!path.startsWith('/'))
    throw new Error(`Path must start with '/': ${path}`);
  return path.split('/').slice(1).map(decode);
}

/* ------------------------------------------------------------------ */
/* 3 · Type helpers                                                   */
/* ------------------------------------------------------------------ */
type Dict = Record<string, BlueNode>;
type Primitive = JsonPrimitive;
type Numeric = BigIntegerNumber | BigDecimalNumber;
type Leaf = Primitive | Numeric;
type Container = BlueNode | BlueNode[] | Dict | Leaf | undefined;

const isDict = (v: unknown): v is Dict =>
  !!v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof BlueNode);
const isNumeric = (v: unknown): v is Numeric =>
  v instanceof BigIntegerNumber || v instanceof BigDecimalNumber;

/* ------------------------------------------------------------------ */
/* 4 · Navigation                                                     */
/* ------------------------------------------------------------------ */
interface Cursor {
  parent: Container;
  key: string | number;
}

function resolve(root: BlueNode, tokens: readonly string[]): Cursor {
  let cursor: Container = root;
  for (let i = 0; i < tokens.length - 1; ++i) {
    cursor = step(cursor, tokens[i]);
    if (cursor === undefined) {
      throw new Error(`Cannot resolve '/${tokens.slice(0, i + 1).join('/')}'`);
    }
  }
  const last = tokens[tokens.length - 1];
  return { parent: cursor, key: Array.isArray(cursor) ? asIndex(last) : last };
}

function step(container: Container, tok: string): Container {
  if (container instanceof BlueNode) {
    switch (tok) {
      case 'name':
        return container.getName();
      case 'description':
        return container.getDescription();
      case 'type':
        return container.getType();
      case 'itemType':
        return container.getItemType();
      case 'keyType':
        return container.getKeyType();
      case 'valueType':
        return container.getValueType();
      case 'value':
        return container.getValue();
      case 'blueId':
        return container.getBlueId();
      case 'blue':
        return container.getBlue();
      case 'items':
        return container.getItems();
      case 'properties':
        return container.getProperties();
      case 'contracts':
        return container.getContracts();
      default:
        return container.getProperties()?.[tok];
    }
  }
  if (Array.isArray(container)) return container[asIndex(tok)];
  if (isDict(container)) return container[tok];
  return undefined;
}

/* ------------------------------------------------------------------ */
/* 5 · Read / write helpers                                           */
/* ------------------------------------------------------------------ */
type RValue = BlueNode | BlueNode[] | Dict | Leaf | undefined;

function read(parent: Container, key: string | number): RValue {
  if (parent instanceof BlueNode) {
    switch (key as string) {
      case 'name':
        return parent.getName();
      case 'description':
        return parent.getDescription();
      case 'type':
        return parent.getType();
      case 'itemType':
        return parent.getItemType();
      case 'keyType':
        return parent.getKeyType();
      case 'valueType':
        return parent.getValueType();
      case 'value':
        return parent.getValue();
      case 'blueId':
        return parent.getBlueId();
      case 'blue':
        return parent.getBlue();
      case 'items':
        return parent.getItems();
      case 'properties':
        return parent.getProperties();
      case 'contracts':
        return parent.getContracts();
      default:
        return parent.getProperties()?.[key as string];
    }
  }
  if (Array.isArray(parent)) return parent[key as number];
  if (isDict(parent)) return parent[key as string];
  return parent; // primitive leaf
}

function write(parent: Container, key: string | number, raw: RValue): void {
  if (parent instanceof BlueNode) {
    const k = key as string;
    switch (k) {
      case 'name':
        parent.setName(raw as string | undefined);
        return;
      case 'description':
        parent.setDescription(raw as string | undefined);
        return;
      case 'type':
        parent.setType(raw as BlueNode | undefined);
        return;
      case 'itemType':
        parent.setItemType(raw as BlueNode | undefined);
        return;
      case 'keyType':
        parent.setKeyType(raw as BlueNode | undefined);
        return;
      case 'valueType':
        parent.setValueType(raw as BlueNode | undefined);
        return;
      case 'value': {
        const prim = raw as Primitive | Numeric | undefined;
        parent.setValue(prim === undefined ? null : prim);
        return;
      }
      case 'blueId':
        parent.setBlueId(raw as string | undefined);
        return;
      case 'blue':
        parent.setBlue(raw as BlueNode | undefined);
        return;
      case 'items':
        parent.setItems(raw as BlueNode[] | undefined);
        return;
      case 'properties':
        parent.setProperties(raw as Dict | undefined);
        return;
      case 'contracts':
        parent.setContracts(raw as Dict | undefined);
        return;
      default: {
        if (raw === undefined) {
          const props = parent.getProperties();
          if (props && k in props) delete props[k];
        } else {
          if (!parent.getProperties()) parent.setProperties({});
          parent.addProperty(k, raw as BlueNode);
        }
      }
    }
    return;
  }

  if (Array.isArray(parent)) {
    const idx = asIndex(key);
    parent.splice(idx, 1);
  } else if (isDict(parent)) {
    if (raw === undefined) {
      delete parent[key as string];
    } else {
      parent[key as string] = raw as BlueNode;
    }
  }
}

/* ------------------------------------------------------------------ */
/* 6 · Core operations                                                */
/* ------------------------------------------------------------------ */
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

/* -- add ----------------------------------------------------------- */
function opAdd(root: BlueNode, path: string, raw: unknown): boolean {
  const { parent, key } = resolve(root, split(path));
  insert(parent, key, raw, false);
  return true;
}
/* -- replace ------------------------------------------------------- */
function opReplace(root: BlueNode, path: string, raw: unknown): boolean {
  try {
    const { parent, key } = resolve(root, split(path));
    const currentValue = read(parent, key);

    if (currentValue === undefined) {
      // Key doesn't exist, but parent exists (since resolve succeeded)
      // Create the key (essentially an add operation)
      insert(parent, key, raw, false);
    } else {
      // Key exists, do normal replace
      insert(parent, key, raw, true);
    }
    return true;
  } catch (error) {
    // If resolve failed, it means intermediate paths don't exist
    throw new Error(
      `REPLACE failed: intermediate path does not exist in ${path}`
    );
  }
}
/* -- remove -------------------------------------------------------- */
function opRemove(root: BlueNode, path: string): boolean {
  const { parent, key } = resolve(root, split(path));
  remove(parent, key);
  return true;
}
/* -- copy ---------------------------------------------------------- */
function opCopy(root: BlueNode, from: string, to: string): boolean {
  const cloned = deepClone(readPath(root, from));
  writePath(root, to, cloned);
  return true;
}
/* -- move ---------------------------------------------------------- */
function opMove(root: BlueNode, from: string, to: string): boolean {
  const val = readPath(root, from);
  opRemove(root, from);
  writePath(root, to, val);
  return true;
}
/* -- test ---------------------------------------------------------- */
function opTest(root: BlueNode, path: string, expected: unknown): boolean {
  if (!deepEqual(readPath(root, path), expected)) {
    throw new Error(`TEST failed at '${path}'`);
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* 7 · High-level wrappers                                            */
/* ------------------------------------------------------------------ */
function readPath(root: BlueNode, path: string): RValue {
  const { parent, key } = resolve(root, split(path));
  return read(parent, key);
}

function writePath(root: BlueNode, path: string, raw: unknown): void {
  const { parent, key } = resolve(root, split(path));
  insert(parent, key, raw, false);
}

/* ------------------------------------------------------------------ */
/* 8 · Insert / remove                                                */
/* ------------------------------------------------------------------ */
function insert(
  parent: Container,
  key: string | number,
  raw: unknown,
  overwrite: boolean
): void {
  if (Array.isArray(parent)) {
    if (key === '-' || key === -1) {
      parent.push(nodeify(raw));
    } else {
      const idx = asIndex(key);
      if (overwrite) parent[idx] = nodeify(raw);
      else parent.splice(idx, 0, nodeify(raw));
    }
    return;
  }

  if (parent instanceof BlueNode) {
    if (key === '-' || key === -1) {
      parent.addItems(nodeify(raw));
      return;
    }

    if (key === 'value') {
      write(parent, key, raw as Primitive | Numeric | undefined);
    } else {
      write(parent, key, nodeify(raw));
    }
    return;
  }

  write(parent, key, nodeify(raw));
}

function remove(parent: Container, key: string | number): void {
  if (Array.isArray(parent)) {
    parent.splice(asIndex(key), 1);
  } else {
    write(parent, key, undefined);
  }
}

/* ------------------------------------------------------------------ */
/* 9 · Utilities                                                      */
/* ------------------------------------------------------------------ */

function nodeify(v: unknown): BlueNode {
  if (v instanceof BlueNode) return v;

  if (
    v === null ||
    typeof v === 'string' ||
    typeof v === 'number' ||
    typeof v === 'boolean' ||
    isNumeric(v)
  ) {
    return NodeDeserializer.deserialize(v as never);
  }

  // Handle undefined values by converting them to null
  const cleanValue = cleanUndefinedValues(v);
  return NodeDeserializer.deserialize(cleanValue as never);
}

// Helper function to recursively clean undefined values
function cleanUndefinedValues(obj: unknown): unknown {
  if (obj === undefined) {
    return null;
  }

  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(cleanUndefinedValues);
  }

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    cleaned[key] = cleanUndefinedValues(value);
  }
  return cleaned;
}

function deepClone(v: RValue): RValue {
  if (v instanceof BlueNode) return v.clone();

  if (Array.isArray(v)) {
    const arr = v.map((item) => deepClone(item) as BlueNode);
    return arr as BlueNode[];
  }

  if (isDict(v)) {
    const out: Dict = {};
    Object.keys(v).forEach((k) => {
      out[k] = deepClone(v[k]) as BlueNode;
    });
    return out;
  }

  return v; // primitive or numeric
}

function deepEqual(a: RValue, b: unknown): boolean {
  if (a === b) return true;

  if (a instanceof BlueNode && b instanceof BlueNode) {
    return a.toString() === b.toString();
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    return (
      a.length === b.length &&
      a.every((e, i) => deepEqual(e, (b as unknown[])[i]))
    );
  }

  if (isDict(a) && isDict(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
  }

  return false;
}

function asIndex(t: string | number): number {
  if (t === '-') return -1;
  const n = typeof t === 'number' ? t : parseInt(t, 10);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid array index '${t}'`);
  }
  return n;
}
