import { BlueNode } from '../../model/Node';
import { NodeDeserializer } from '../../model/NodeDeserializer';
import { BigIntegerNumber as ModelBigIntegerNumber } from '../../model/BigIntegerNumber';
import { BigDecimalNumber as ModelBigDecimalNumber } from '../../model/BigDecimalNumber';
import { JsonPrimitive } from '@blue-labs/shared-utils';

export { ModelBigIntegerNumber as BigIntegerNumber };
export { ModelBigDecimalNumber as BigDecimalNumber };

// Type Helpers from NodePatch.ts
export type Dict = Record<string, BlueNode>;
export type Primitive = JsonPrimitive;
export type Numeric = ModelBigIntegerNumber | ModelBigDecimalNumber;
export type Leaf = Primitive | Numeric;
export type Container = BlueNode | BlueNode[] | Dict | Leaf | undefined;
export type RValue = BlueNode | BlueNode[] | Dict | Leaf | undefined;

export const isDict = (v: unknown): v is Dict =>
  !!v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof BlueNode);
export const isNumeric = (v: unknown): v is Numeric =>
  v instanceof ModelBigIntegerNumber || v instanceof ModelBigDecimalNumber;

// Path Helpers from NodePatch.ts
export const decode = (s: string): string =>
  s.replace(/~1/g, '/').replace(/~0/g, '~');

export function split(path: string): string[] {
  if (path === '/') return [];
  if (!path.startsWith('/'))
    throw new Error(`Path must start with '/': ${path}`);
  return path.split('/').slice(1).map(decode);
}

export function asIndex(t: string | number): number {
  if (t === '-') return -1;
  const n = typeof t === 'number' ? t : parseInt(t, 10);
  if (isNaN(n)) {
    throw new Error(`Invalid array index (NaN) from '${t}'`);
  }
  if (!Number.isFinite(n)) {
    throw new Error(
      `Invalid array index '${t}' results in non-finite number ${n}`,
    );
  }
  return n;
}

// Navigation Helpers from NodePatch.ts
export interface Cursor {
  parent: Container;
  key: string | number;
  actualTarget?: RValue;
}

function _getBlueNodeSpecialProperty(
  node: BlueNode,
  key: string,
  forStepContext: boolean,
  allowStepIntoBlueNodeValue = true,
): RValue | BlueNode[] | Dict | BlueNode | undefined {
  switch (key) {
    case 'name':
      return forStepContext
        ? allowStepIntoBlueNodeValue
          ? (node.getName() ?? null)
          : node
        : node.getName();
    case 'description':
      return forStepContext
        ? allowStepIntoBlueNodeValue
          ? node.getDescription()
          : node
        : node.getDescription();
    case 'type':
      return node.getType();
    case 'itemType':
      return node.getItemType();
    case 'keyType':
      return node.getKeyType();
    case 'valueType':
      return node.getValueType();
    case 'value':
      return forStepContext
        ? allowStepIntoBlueNodeValue
          ? (node.getValue() ?? null)
          : node
        : node.getValue();
    case 'blueId':
      return forStepContext
        ? allowStepIntoBlueNodeValue
          ? (node.getBlueId() ?? null)
          : node
        : node.getBlueId();
    case 'blue':
      return node.getBlue();
    case 'items':
      return node.getItems();
    case 'properties':
      return node.getProperties();
    case 'contracts':
      return node.getContracts();
    default:
      return undefined;
  }
}

export function step(
  container: Container,
  tok: string,
  allowStepIntoBlueNodeValue = true,
): Container {
  if (container instanceof BlueNode) {
    const specialProp = _getBlueNodeSpecialProperty(
      container,
      tok,
      true,
      allowStepIntoBlueNodeValue,
    );
    if (
      specialProp !== undefined ||
      [
        'name',
        'description',
        'type',
        'itemType',
        'keyType',
        'valueType',
        'value',
        'blueId',
        'blue',
        'items',
        'properties',
        'contracts',
      ].includes(tok)
    ) {
      return specialProp as Container;
    }
    if (/^-?\d+$/.test(tok) && tok !== '-') {
      const items = container.getItems();
      const idx = parseInt(tok, 10);
      if (items && idx >= 0 && idx < items.length) return items[idx];
      return undefined;
    }
    const props = container.getProperties();
    if (props && tok in props) return props[tok];
    if (tok === '-') return undefined;
    return undefined;
  }
  if (Array.isArray(container)) {
    if (tok === '-') return undefined;
    const idx = asIndex(tok);
    if (idx >= 0 && idx < container.length) return container[idx];
    return undefined;
  }
  if (isDict(container)) return container[tok];
  return undefined;
}

export function resolve(root: BlueNode, tokens: readonly string[]): Cursor {
  if (tokens.length === 0) {
    return {
      parent: root,
      key: 'value',
      actualTarget: root.getValue() ?? root,
    };
  }
  let cursor: Container = root;
  for (let i = 0; i < tokens.length - 1; ++i) {
    const currentToken = tokens[i];
    const nextCursor = step(cursor, currentToken);
    if (nextCursor === undefined) {
      throw new Error(`Cannot resolve '/${tokens.slice(0, i + 1).join('/')}'`);
    }
    cursor = nextCursor;
  }
  const lastToken = tokens[tokens.length - 1];
  if (cursor instanceof BlueNode) {
    const potentialPrimitive = step(cursor, lastToken, false);
    if (
      (typeof potentialPrimitive !== 'object' ||
        potentialPrimitive === null ||
        isNumeric(potentialPrimitive)) &&
      !(potentialPrimitive instanceof BlueNode) &&
      !Array.isArray(potentialPrimitive) &&
      ['name', 'description', 'value', 'blueId'].includes(lastToken)
    ) {
      return {
        parent: cursor,
        key: lastToken,
        actualTarget: potentialPrimitive,
      };
    }
  }
  if (Array.isArray(cursor) && lastToken === '-')
    return { parent: cursor, key: '-' };
  if (cursor instanceof BlueNode && cursor.getItems() && lastToken === '-')
    return { parent: cursor, key: '-' };
  return {
    parent: cursor,
    key: Array.isArray(cursor) ? asIndex(lastToken) : lastToken,
  };
}

// Read/Write Helpers from NodePatch.ts
export function read(parent: Container, key: string | number): RValue {
  if (parent instanceof BlueNode) {
    const k = key as string;
    const specialProp = _getBlueNodeSpecialProperty(parent, k, false);
    if (
      specialProp !== undefined ||
      [
        'name',
        'description',
        'type',
        'itemType',
        'keyType',
        'valueType',
        'value',
        'blueId',
        'blue',
        'items',
        'properties',
        'contracts',
      ].includes(k)
    ) {
      return specialProp;
    }
    if (
      typeof key === 'number' ||
      (typeof key === 'string' && /^\d+$/.test(key))
    ) {
      const items = parent.getItems();
      const idx = typeof key === 'number' ? key : parseInt(key, 10);
      if (items && idx >= 0 && idx < items.length) return items[idx];
    }
    return parent.getProperties()?.[k];
  }
  if (Array.isArray(parent)) return parent[key as number];
  if (isDict(parent)) return parent[key as string];
  return parent;
}

export function nodeify(v: unknown): BlueNode {
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
  const cleanValue = cleanUndefinedValues(v);
  return NodeDeserializer.deserialize(cleanValue as never);
}

function cleanUndefinedValues(obj: unknown): unknown {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanUndefinedValues);
  const cleaned: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(obj as Record<string, unknown>)) {
    cleaned[k] = cleanUndefinedValues(val);
  }
  return cleaned;
}

export function write(
  parent: Container,
  key: string | number,
  raw: RValue,
): void {
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
        parent.setType(
          raw instanceof BlueNode ||
            typeof raw === 'string' ||
            raw === undefined
            ? raw
            : nodeify(raw),
        );
        return;
      case 'itemType':
        parent.setItemType(
          raw instanceof BlueNode ||
            typeof raw === 'string' ||
            raw === undefined
            ? raw
            : nodeify(raw),
        );
        return;
      case 'keyType':
        parent.setKeyType(
          raw instanceof BlueNode ||
            typeof raw === 'string' ||
            raw === undefined
            ? raw
            : nodeify(raw),
        );
        return;
      case 'valueType':
        parent.setValueType(
          raw instanceof BlueNode ||
            typeof raw === 'string' ||
            raw === undefined
            ? raw
            : nodeify(raw),
        );
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
        parent.setBlue(
          raw instanceof BlueNode || raw === undefined ? raw : nodeify(raw),
        );
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
          parent.addProperty(k, raw instanceof BlueNode ? raw : nodeify(raw));
        }
        return;
      }
    }
  }
  if (Array.isArray(parent)) {
    parent.splice(asIndex(key), 1);
  } // This branch for remove via write(parent,key,undefined)
  else if (isDict(parent)) {
    if (raw === undefined) delete parent[key as string];
    else parent[key as string] = raw as BlueNode;
  }
}

// Insert/Remove Helpers from NodePatch.ts
function _insertOrReplaceBlueNodeItem(
  blueNodeParent: BlueNode,
  key: string | number,
  valueNode: BlueNode,
  overwrite: boolean,
): void {
  let numKey = -1;
  if (key !== '-') {
    numKey = typeof key === 'number' ? key : parseInt(key as string, 10);
    if (isNaN(numKey))
      throw new Error(
        `Invalid numeric key for BlueNode item operation: ${key}`,
      );
  }
  if (numKey < -1)
    throw new Error(`Invalid array index for BlueNode items: ${numKey}`);
  let items = blueNodeParent.getItems();
  if (!items) {
    items = [];
    blueNodeParent.setItems(items);
  }
  if (!overwrite && numKey !== -1 && numKey > items.length) {
    throw new Error(
      `ADD operation failed: Target array index '${numKey}' is greater than array length ${items.length}.`,
    );
  }
  if (key === '-') {
    items.push(valueNode);
  } else if (overwrite) {
    if (numKey >= 0) {
      if (numKey < items.length) items[numKey] = valueNode;
      else {
        for (let i = items.length; i < numKey; i++)
          items.push(NodeDeserializer.deserialize(null));
        items.push(valueNode);
      }
    }
  } else {
    items.splice(numKey, 0, valueNode);
  }
}

export function insert(
  parent: Container,
  key: string | number,
  rawVal: unknown,
  overwrite: boolean,
): void {
  if (Array.isArray(parent)) {
    const idx = key === '-' ? parent.length : asIndex(key);
    if (!overwrite && idx > parent.length) {
      throw new Error(
        `ADD operation failed: Target array index '${idx}' is greater than array length ${parent.length}. Path involving key '${key}'.`,
      );
    }
    if (idx < 0 && key !== '-')
      throw new Error(`Invalid negative array index: ${key}`);
    const newNode = nodeify(rawVal);
    if (overwrite) {
      if (idx >= 0 && idx < parent.length) parent[idx] = newNode;
      else if (idx >= parent.length) {
        for (let i = parent.length; i < idx; i++)
          parent.push(NodeDeserializer.deserialize(null));
        parent.push(newNode);
      }
    } else {
      parent.splice(idx, 0, newNode);
    }
    return;
  }
  if (parent instanceof BlueNode) {
    if (
      key === '-' ||
      (typeof key === 'number' && !isNaN(key)) ||
      (typeof key === 'string' && /^\d+$/.test(key))
    ) {
      _insertOrReplaceBlueNodeItem(parent, key, nodeify(rawVal), overwrite);
    } else {
      write(parent, key as string, rawVal as RValue);
    }
    return;
  }
  if (isDict(parent)) {
    parent[key as string] = nodeify(rawVal);
    return;
  }
  throw new Error(`Cannot insert into parent of type ${typeof parent}`);
}

export function remove(parent: Container, key: string | number): void {
  if (Array.isArray(parent)) {
    const idx = asIndex(key);
    if (idx === -1 && key === '-') {
      if (parent.length > 0) parent.pop();
    } else if (idx >= 0 && idx < parent.length) parent.splice(idx, 1);
    return;
  }
  if (parent instanceof BlueNode) {
    if (
      typeof key === 'number' ||
      (typeof key === 'string' && /^-?\d+$/.test(key))
    ) {
      const items = parent.getItems();
      if (items) {
        const idx = asIndex(key);
        if (idx === -1 && key === '-') {
          if (items.length > 0) items.pop();
        } else if (idx >= 0 && idx < items.length) items.splice(idx, 1);
        if (items.length === 0) parent.setItems(undefined);
        return;
      }
    }
    write(parent, key as string, undefined);
  } else if (isDict(parent)) {
    delete parent[key as string];
  }
}

// General Utilities from NodePatch.ts
export function deepClone(v: RValue): RValue {
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
  return v;
}

export function deepEqual(a: RValue, b: unknown): boolean {
  if (a === b) return true;
  if (
    a instanceof BlueNode &&
    (a.isInlineValue() || a.getValue() !== undefined)
  ) {
    if (deepEqual(a.getValue() ?? null, b)) return true;
  }
  if (
    b instanceof BlueNode &&
    (b.isInlineValue() || b.getValue() !== undefined)
  ) {
    if (deepEqual(a, b.getValue() ?? null)) return true;
  }
  if (a instanceof BlueNode && b instanceof BlueNode) {
    return a.toString() === b.toString();
  }
  if (isNumeric(a) && isNumeric(b)) return a.toString() === b.toString();
  if (isNumeric(a) && typeof b === 'number')
    return a.toString() === b.toString();
  if (typeof a === 'number' && isNumeric(b))
    return a.toString() === b.toString();
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

// High-level wrappers (originally in NodePatch.ts, moved here as they use utils)
export function readPath(root: BlueNode, path: string): RValue {
  const { parent, key } = resolve(root, split(path));
  return read(parent, key);
}

export function writePath(root: BlueNode, path: string, raw: unknown): void {
  const tokens = split(path);
  if (tokens.length === 0 && path === '/') {
    const newNode = nodeify(raw);
    root.setValue(newNode.getValue() ?? null);
    if (newNode.getItems()) {
      root.setItems(newNode.getItems());
    } else {
      root.setItems(undefined);
    }
    return;
  }
  const { parent, key } = resolve(root, tokens);
  insert(parent, key, raw, true); // true for overwrite, effectively "set"
}
