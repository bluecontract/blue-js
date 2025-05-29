/* ---------------------------------------------------------------------------
   NodePatch.ts · Apply RFC-6902 patches to BlueNode graphs
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

export function applyBlueNodePatches(
  root: BlueNode,
  patches: readonly BlueNodePatch[],
  mutateOriginal = false
): BlueNode {
  if (!patches.length) {
    // If no patches, return original or a clone based on mutateOriginal intent for consistency,
    // though typically one might expect original if no changes.
    // For safety and consistency with patching always returning a new instance (if mutateOriginal=false at core level),
    // let's return a clone if not mutating, or root if mutating.
    return mutateOriginal ? root : root.clone();
  }

  let workingNode = root.clone(); // Always start with a clone for the sequence integrity

  for (const patch of patches) {
    // applyBlueNodePatch (single patch version) will handle its own cloning via its mutateOriginal flag.
    // To ensure that modifications within this loop don't affect 'workingNode' across iterations
    // if an error occurs mid-patch, and to ensure each patch applies to the result of the PREVIOUS one,
    // we pass `false` for mutateOriginal to the single patch function, so it always returns a new node.
    workingNode = applyBlueNodePatch(workingNode, patch, false);
  }
  // At this point, workingNode is the result of all patches successfully applied to a clone of the original root.
  // If the applyBlueNodePatches was called with mutateOriginal = true, we have an issue:
  // we can't easily mutate the *original caller's root reference* from here.
  // The best contract for applyBlueNodePatches is that it returns the new state.
  // The caller can do `root = applyBlueNodePatches(root, patchesArray, true);` if they want to reassign.
  // Therefore, the mutateOriginal flag on applyBlueNodePatches is best removed or ignored for the return.
  return workingNode;
}

export function applyBlueNodePatch(
  root: BlueNode,
  patch: BlueNodePatch,
  mutateOriginal = false
): BlueNode {
  const base = mutateOriginal ? root : root.clone();
  applySingle(base, patch);
  return base;
}

/* ------------------------------------------------------------------ */
/* 2 · Path helpers                                                   */
/* ------------------------------------------------------------------ */
const decode = (s: string): string => s.replace(/~1/g, '/').replace(/~0/g, '~');

function split(path: string): string[] {
  if (path === '/') return []; // Handle root path
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
/* 4 · Internal Property Accessor Helper                             */
/* ------------------------------------------------------------------ */

/**
 * Internal helper to get special properties from a BlueNode.
 * Used by both step and read to avoid duplicate switch statements.
 * @param node The BlueNode to access.
 * @param key The property key (e.g., 'name', 'items').
 * @param forStepContext If true, behaves like 'step' (may return containers like arrays/dicts).
 *                       If false, behaves like 'read' (may return primitives directly for some props).
 * @param allowStepIntoBlueNodeValue Only relevant if forStepContext is true, mimics param from original step.
 */
function _getBlueNodeSpecialProperty(
  node: BlueNode,
  key: string,
  forStepContext: boolean,
  allowStepIntoBlueNodeValue = true
): RValue | BlueNode[] | Dict | BlueNode | undefined {
  switch (key) {
    case 'name':
      return forStepContext
        ? allowStepIntoBlueNodeValue
          ? node.getName() ?? null
          : node
        : node.getName();
    case 'description':
      return forStepContext
        ? allowStepIntoBlueNodeValue
          ? node.getDescription()
          : node // undefined is fine for step
        : node.getDescription();
    case 'type':
      return node.getType(); // Returns BlueNode | undefined
    case 'itemType':
      return node.getItemType();
    case 'keyType':
      return node.getKeyType();
    case 'valueType':
      return node.getValueType();
    case 'value':
      return forStepContext
        ? allowStepIntoBlueNodeValue
          ? node.getValue() ?? null
          : node
        : node.getValue();
    case 'blueId':
      return forStepContext
        ? allowStepIntoBlueNodeValue
          ? node.getBlueId() ?? null
          : node
        : node.getBlueId();
    case 'blue':
      return node.getBlue();
    case 'items':
      return node.getItems(); // BlueNode[] | undefined
    case 'properties':
      return node.getProperties(); // Record<string, BlueNode> | undefined
    case 'contracts':
      return node.getContracts(); // Record<string, BlueNode> | undefined
    default:
      return undefined; // Not a special property
  }
}

/* ------------------------------------------------------------------ */
/* 4 · Navigation                                                     */
/* ------------------------------------------------------------------ */
interface Cursor {
  parent: Container;
  key: string | number;
  actualTarget?: RValue; // Used if the path points directly to a primitive BlueNode property like name, description, or value
}

function resolve(root: BlueNode, tokens: readonly string[]): Cursor {
  if (tokens.length === 0) {
    // Path is "/"
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

  // If the cursor is a BlueNode and the lastToken refers to a primitive value property that step itself would return (like name, value)
  // the parent should be the BlueNode, and key should be the token.
  if (cursor instanceof BlueNode) {
    // Check if lastToken is a "primitive-holding" property of BlueNode
    // For these, 'cursor' (the BlueNode itself) is the parent.
    // 'step' returns the primitive value directly for these, not the node.
    // 'read' will also get the primitive. 'write' will use the setter.
    const potentialPrimitive = step(cursor, lastToken, false);
    if (
      (typeof potentialPrimitive !== 'object' ||
        potentialPrimitive === null ||
        isNumeric(potentialPrimitive)) &&
      !(potentialPrimitive instanceof BlueNode) &&
      !Array.isArray(potentialPrimitive) &&
      ['name', 'description', 'value', 'blueId'].includes(lastToken) // more specific check?
    ) {
      return {
        parent: cursor,
        key: lastToken,
        actualTarget: potentialPrimitive,
      };
    }
  }

  // If parent is an array and lastToken is '-', key should be '-' (string)
  if (Array.isArray(cursor) && lastToken === '-') {
    return { parent: cursor, key: '-' };
  }
  // If parent is BlueNode, its items are an array, and lastToken is '-', key should be '-'
  if (cursor instanceof BlueNode && cursor.getItems() && lastToken === '-') {
    return { parent: cursor, key: '-' };
  }

  // If the final step results in a container (BlueNode, Array, Dict)
  // then 'cursor' is the parent container, and 'lastToken' is the key within it.
  // If 'step' resolved lastToken to a non-container (e.g. a primitive from a Dict),
  // 'cursor' is the Dict, lastToken is key.

  return {
    parent: cursor,
    key: Array.isArray(cursor) ? asIndex(lastToken) : lastToken,
  };
}

function step(
  container: Container,
  tok: string,
  allowStepIntoBlueNodeValue = true
): Container {
  if (container instanceof BlueNode) {
    const specialProp = _getBlueNodeSpecialProperty(
      container,
      tok,
      true,
      allowStepIntoBlueNodeValue
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
      // If tok is a special property name, _getBlueNodeSpecialProperty handles it (even if it returns undefined e.g. for an unset optional like .blue)
      return specialProp as Container; // Cast needed as specialProp can be BlueNode[] or Dict not in RValue leaf part
    }
    // Not a special property, try user properties or indexed access
    if (/^-?\d+$/.test(tok) && tok !== '-') {
      const items = container.getItems();
      const idx = parseInt(tok, 10);
      if (items && idx >= 0 && idx < items.length) {
        return items[idx];
      }
      return undefined;
    }
    const props = container.getProperties();
    if (props && tok in props) {
      return props[tok];
    }
    if (tok === '-') return undefined;
    return undefined; // Fallback if not found anywhere
  }
  if (Array.isArray(container)) {
    if (tok === '-') return undefined; // '-' is for ops like 'add', not for stepping into.
    const idx = asIndex(tok);
    if (idx >= 0 && idx < container.length) {
      // Check bounds for positive indices
      return container[idx];
    }
    return undefined; // Out of bounds or invalid index like non-numeric string not '-'
  }
  if (isDict(container)) {
    return container[tok];
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* 5 · Read / write helpers                                           */
/* ------------------------------------------------------------------ */
type RValue = BlueNode | BlueNode[] | Dict | Leaf | undefined;

function read(parent: Container, key: string | number): RValue {
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

    // Not a special property, try user properties or indexed access
    if (
      typeof key === 'number' ||
      (typeof key === 'string' && /^\d+$/.test(key))
    ) {
      const items = parent.getItems();
      const idx = typeof key === 'number' ? key : parseInt(key, 10);
      if (items && idx >= 0 && idx < items.length) {
        return items[idx];
      }
    }
    return parent.getProperties()?.[k];
  }
  if (Array.isArray(parent)) return parent[key as number];
  if (isDict(parent)) return parent[key as string];
  return parent; // primitive leaf
}

function write(parent: Container, key: string | number, raw: RValue): void {
  if (parent instanceof BlueNode) {
    const k = key as string;
    // Ensure raw is nodeified if it's a complex object for properties that expect BlueNode
    // but keep it primitive if 'key' is 'value', 'name', 'description', 'blueId'.

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
            : nodeify(raw)
        );
        return;
      case 'itemType':
        parent.setItemType(
          raw instanceof BlueNode ||
            typeof raw === 'string' ||
            raw === undefined
            ? raw
            : nodeify(raw)
        );
        return;
      case 'keyType':
        parent.setKeyType(
          raw instanceof BlueNode ||
            typeof raw === 'string' ||
            raw === undefined
            ? raw
            : nodeify(raw)
        );
        return;
      case 'valueType':
        parent.setValueType(
          raw instanceof BlueNode ||
            typeof raw === 'string' ||
            raw === undefined
            ? raw
            : nodeify(raw)
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
          raw instanceof BlueNode || raw === undefined ? raw : nodeify(raw)
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
        // User-defined properties or indexed access (handled by insert)
        if (raw === undefined) {
          // removing property
          const props = parent.getProperties();
          if (props && k in props) {
            delete props[k];
            // Optional: if properties becomes empty, set it to undefined?
            // if (Object.keys(props).length === 0) parent.setProperties(undefined);
          }
        } else {
          // adding or updating property
          if (!parent.getProperties()) parent.setProperties({});
          // raw should be a BlueNode here, nodeify if it came directly.
          parent.addProperty(k, raw instanceof BlueNode ? raw : nodeify(raw));
        }
        return;
      }
    }
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
  const tokens = split(path);
  if (tokens.length === 0 && path === '/') {
    // Adding to root, typically means replacing root items or value
    if (root.getItems() && Array.isArray(raw)) {
      // if root is an array and raw is an array
      // This case is ambiguous with RFC6902 'add' to root.
      // Typically 'add' to root with object replaces the document.
      // For BlueNode, if it's array-like, it might mean set its items.
      // Let's assume it means replacing the value or items if it's an array.
      const newRootContent = nodeify(raw);
      if (newRootContent.getItems()) {
        root.setItems(newRootContent.getItems());
        root.setValue(null); // Clear scalar value if it becomes an array
      } else {
        root.setValue(newRootContent.getValue() ?? null);
        root.setItems(undefined); // Clear items if it becomes scalar
      }
    } else {
      const newNode = nodeify(raw); // Treat 'raw' as the new value for the root node.
      root.setValue(newNode.getValue() ?? null); // If raw was a primitive, it's set
      // Copy other relevant root properties? This is ill-defined for "add" to "/".
      // For simplicity, assume 'add' to '/' primarily affects 'value' or 'items'.
      if (newNode.getItems()) root.setItems(newNode.getItems());
      else if (
        !(
          raw === null ||
          typeof raw === 'string' ||
          typeof raw === 'number' ||
          typeof raw === 'boolean' ||
          isNumeric(raw)
        )
      ) {
        // If raw was an object, try to set its properties on root.
        // This is very custom. RFC add to / replaces the document.
        // For now, limited to value/items.
      }
    }
    return true;
  }

  const { parent, key } = resolve(root, tokens);
  insert(parent, key, raw, false); // false for overwrite means add
  return true;
}
/* -- replace ------------------------------------------------------- */
function opReplace(root: BlueNode, path: string, raw: unknown): boolean {
  const tokens = split(path);
  if (tokens.length === 0 && path === '/') {
    const newNode = nodeify(raw);
    root.setValue(newNode.getValue() ?? null);
    if (newNode.getItems()) {
      root.setItems(newNode.getItems());
    } else {
      root.setItems(undefined);
    }
    return true;
  }

  // Resolve must succeed for the immediate parent.
  // If an intermediate segment is missing, resolve() itself will throw,
  // and opReplace will let that propagate (RFC compliant).
  const { parent, key, actualTarget } = resolve(root, tokens);

  if (actualTarget !== undefined && parent instanceof BlueNode) {
    // Replacing a direct primitive-like property (e.g. /name, /value)
    // These are considered to always "exist" on the parent BlueNode for replacement purposes.
    write(parent, key, raw as RValue);
  } else {
    const currentValue = read(parent, key);
    const isArrayTarget =
      Array.isArray(parent) ||
      (parent instanceof BlueNode &&
        parent.getItems() &&
        (typeof key === 'number' ||
          (typeof key === 'string' && /^\d+$/.test(key))));

    if (currentValue === undefined) {
      // Final target segment does not exist on the resolved parent.
      if (isArrayTarget) {
        // e.g. path /list/5 when list has < 5 items.
        // RFC: Target location MUST exist. This is an error.
        throw new Error(
          `REPLACE failed: Target array index '${key.toString()}' is out of bounds or does not exist at path '${path}'.`
        );
      } else {
        // e.g. path /some when 'some' is not a property of parent.
        // RFC: "functionally identical to a "remove" operation ... followed immediately by an "add" operation"
        // Remove on non-existent is no-op. Add creates the member.
        // This aligns with fast-json-patch creating the final segment if parent exists.
        insert(parent, key, raw, true);
      }
    } else {
      // Target exists, perform replacement.
      insert(parent, key, raw, true);
    }
  }
  return true;
}
/* -- remove -------------------------------------------------------- */
function opRemove(root: BlueNode, path: string): boolean {
  const tokens = split(path);
  if (tokens.length === 0 && path === '/') {
    // Removing root
    // This is usually not allowed or means clearing the document.
    // For BlueNode, maybe set value to null and clear items/props?
    root.setValue(null);
    root.setItems(undefined);
    root.setProperties(undefined);
    // Keep other BlueNode specific fields like name, type? This is ambiguous.
    // For now, primarily affect content.
    return true;
  }
  const { parent, key } = resolve(root, tokens);
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
  const fromTokens = split(from);
  // The 'from' location MUST exist. resolve() will throw if intermediate path fails.
  const { parent: fromParent, key: fromKey } = resolve(root, fromTokens);
  const valueAtFrom = read(fromParent, fromKey);

  // Check if the 'from' path actually yielded a defined value.
  // Reading a non-existent property or an out-of-bounds array index via read() yields undefined.
  if (valueAtFrom === undefined) {
    // If intermediate paths in 'from' were missing, resolve() would have thrown above.
    // If resolve() succeeded, but read() is undefined, the final segment of 'from' doesn't exist.
    throw new Error(`MOVE failed: 'from' location '${from}' does not exist.`);
  }

  // If we reached here, 'from' location exists and valueAtFrom is its value.
  // opRemove must be robust enough to handle removing an existing item.
  // If opRemove were to fail here (e.g., if it also re-checked existence and failed), it would be an inconsistency.
  if (opRemove(root, from)) {
    writePath(root, to, valueAtFrom);
    return true;
  }
  // This path implies opRemove failed unexpectedly after we've established 'from' exists.
  // This suggests an issue in opRemove or an inconsistent state.
  // For strictness, if opRemove fails after existence check, it could be an internal error.
  // However, opRemove is generally designed to be robust for existing paths.
  // If opRemove is a no-op for a path that resolve says exists but read gives undefined (e.g. optional prop),
  // then the above check for valueAtFrom === undefined is critical.
  return false; // Should ideally not be reached if 'from' exists and opRemove is correct.
}
/* -- test ---------------------------------------------------------- */
function opTest(root: BlueNode, path: string, expected: unknown): boolean {
  const actual = readPath(root, path);
  // Nodeify 'expected' for comparison if 'actual' is a BlueNode representing a primitive
  // and 'expected' is a raw primitive.
  // Or, if 'actual' is a primitive, and 'expected' is a primitive, compare directly.
  // If 'actual' is a BlueNode, and 'expected' is an object structure, nodeify 'expected'.

  let expectedToCompare: RValue = expected as RValue;

  if (actual instanceof BlueNode) {
    if (
      (expected === null ||
        typeof expected === 'string' ||
        typeof expected === 'number' ||
        typeof expected === 'boolean' ||
        isNumeric(expected)) &&
      (actual.isInlineValue() || actual.getValue() !== undefined)
    ) {
      // 'actual' is a BlueNode wrapping a primitive (inline or has value).
      // 'expected' is a raw primitive. Compare actual.getValue() with expected.
      if (!deepEqual(actual.getValue() ?? null, expected)) {
        throw new Error(
          `TEST failed at '${path}': Expected ${JSON.stringify(
            expected
          )}, got ${JSON.stringify(actual.getValue() ?? null)}`
        );
      }
      return true;
    } else if (
      typeof expected === 'object' &&
      !(expected instanceof BlueNode)
    ) {
      // 'actual' is BlueNode, 'expected' is a plain object structure for a BlueNode. Nodeify expected.
      expectedToCompare = nodeify(expected);
    }
  } else if (isNumeric(actual) && typeof expected === 'number') {
    // actual is BigInt/BigDecimal, expected is JS number. Convert expected for comparison.
    if (actual instanceof BigIntegerNumber) {
      expectedToCompare = new BigIntegerNumber(expected.toString());
    } else if (actual instanceof BigDecimalNumber) {
      expectedToCompare = new BigDecimalNumber(expected.toString());
    }
  } else if (
    (actual === null ||
      typeof actual === 'string' ||
      typeof actual === 'number' ||
      typeof actual === 'boolean') &&
    isNumeric(expected)
  ) {
    // actual is primitive, expected is BigNumber. Compare actual with expected.toString() or expected.toNumber()
    // This comparison logic might need refinement for precision with BigDecimalNumber
    const expectedNum = expected as Numeric;
    if (
      !deepEqual(actual, expectedNum.toString()) &&
      !(
        typeof actual === 'number' &&
        actual === parseFloat(expectedNum.toString())
      )
    ) {
      // If direct string comparison fails, and actual is not a float matching expected,
      // it might be a mismatch.
    }
  }

  if (!deepEqual(actual, expectedToCompare)) {
    const actualJson =
      actual instanceof BlueNode ? actual.toString() : JSON.stringify(actual);
    const expectedJson =
      expectedToCompare instanceof BlueNode
        ? expectedToCompare.toString()
        : JSON.stringify(expectedToCompare);
    throw new Error(
      `TEST failed at '${path}': Expected ${expectedJson}, got ${actualJson}`
    );
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
  const tokens = split(path);
  if (tokens.length === 0 && path === '/') {
    // Writing to root
    // This is like 'replace' or 'add' to root.
    // Assume 'raw' is the new content for the root.
    const newNode = nodeify(raw);
    root.setValue(newNode.getValue() ?? null);
    if (newNode.getItems()) {
      root.setItems(newNode.getItems());
    } else {
      root.setItems(undefined);
    }
    // Other root properties could be copied if 'raw' was a full BlueNode structure.
    return;
  }
  const { parent, key } = resolve(root, tokens);
  insert(parent, key, raw, true); // true for overwrite, effectively "set"
}

/* ------------------------------------------------------------------ */
/* 8 · Insert / remove                                                */
/* ------------------------------------------------------------------ */

function _insertOrReplaceBlueNodeItem(
  blueNodeParent: BlueNode,
  key: string | number, // Expect number or '-'
  valueNode: BlueNode,
  overwrite: boolean
): void {
  let numKey = -1;
  if (key !== '-') {
    numKey = typeof key === 'number' ? key : parseInt(key as string, 10);
    // asIndex would have already validated if key was a string, but double check for safety / direct calls
    if (isNaN(numKey))
      throw new Error(
        `Invalid numeric key for BlueNode item operation: ${key}`
      );
  }
  if (numKey < -1)
    throw new Error(`Invalid array index for BlueNode items: ${numKey}`);

  let items = blueNodeParent.getItems();
  if (!items) {
    items = [];
    blueNodeParent.setItems(items);
  }

  // For ADD (overwrite is false), index MUST NOT be greater than array length (RFC 6902, Sec 4.1)
  if (!overwrite && numKey !== -1 && numKey > items.length) {
    throw new Error(
      `ADD operation failed: Target array index '${numKey}' is greater than array length ${items.length}.`
    );
  }

  if (key === '-') {
    // Append
    items.push(valueNode);
  } else if (overwrite) {
    // Replace or upsert-like add to an array index
    if (numKey >= 0) {
      if (numKey < items.length) {
        items[numKey] = valueNode;
      } else {
        // numKey >= items.length, extend array (for upsert-like replace)
        for (let i = items.length; i < numKey; i++) {
          items.push(NodeDeserializer.deserialize(null));
        }
        items.push(valueNode);
      }
    }
  } else {
    // Add (insert at numKey)
    // numKey <= items.length due to check above for add operations.
    items.splice(numKey, 0, valueNode);
  }
}

function insert(
  parent: Container,
  key: string | number,
  rawVal: unknown,
  overwrite: boolean
): void {
  if (Array.isArray(parent)) {
    const idx = key === '-' ? parent.length : asIndex(key);
    if (!overwrite && idx > parent.length) {
      throw new Error(
        `ADD operation failed: Target array index '${idx}' is greater than array length ${parent.length}. Path involving key '${key}'.`
      );
    }
    if (idx < 0 && key !== '-')
      throw new Error(`Invalid negative array index: ${key}`);

    const newNode = nodeify(rawVal);

    if (overwrite) {
      if (idx >= 0 && idx < parent.length) {
        parent[idx] = newNode;
      } else if (idx >= parent.length) {
        for (let i = parent.length; i < idx; i++) {
          parent.push(NodeDeserializer.deserialize(null));
        }
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
      (typeof key === 'number' && !isNaN(key)) || // Simplified check for number
      (typeof key === 'string' && /^\d+$/.test(key))
    ) {
      _insertOrReplaceBlueNodeItem(parent, key, nodeify(rawVal), overwrite);
    } else {
      // Not an array-like operation on items, must be a property or special setter
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

function remove(parent: Container, key: string | number): void {
  if (Array.isArray(parent)) {
    const idx = asIndex(key);
    if (idx === -1 && key === '-') {
      if (parent.length > 0) parent.pop();
    } else if (idx >= 0 && idx < parent.length) {
      parent.splice(idx, 1); // Directly splice, no call to write()
    }
    // No error thrown for out-of-bounds remove, it's a no-op, which is acceptable.
    return; // Ensure we return after handling array
  }

  if (parent instanceof BlueNode) {
    // Check if key is an index for BlueNode items
    if (
      typeof key === 'number' ||
      (typeof key === 'string' && /^-?\d+$/.test(key))
    ) {
      const items = parent.getItems(); // Changed to const
      if (items) {
        const idx = asIndex(key);
        if (idx === -1 && key === '-') {
          // Removing last element with '-'
          if (items.length > 0) items.pop();
        } else if (idx >= 0 && idx < items.length) {
          items.splice(idx, 1);
        }
        // Optionally: if items becomes empty, set parent.setItems(undefined)?
        if (items.length === 0) parent.setItems(undefined); // Modified: Clear if empty
        return;
      }
    }
    // If not an index, assume it's a property handled by write(parent, key, undefined)
    write(parent, key as string, undefined);
  } else if (isDict(parent)) {
    delete parent[key as string];
  } else {
    // Cannot remove from a primitive.
    // throw new Error(`REMOVE failed: cannot remove from primitive parent.`);
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

  // Handle cases where 'a' is a BlueNode wrapping a primitive and 'b' is the primitive
  if (
    a instanceof BlueNode &&
    (a.isInlineValue() || a.getValue() !== undefined)
  ) {
    if (deepEqual(a.getValue() ?? null, b)) return true;
  }
  // Handle cases where 'b' is a BlueNode wrapping a primitive and 'a' is the primitive
  if (
    b instanceof BlueNode &&
    (b.isInlineValue() || b.getValue() !== undefined)
  ) {
    if (deepEqual(a, b.getValue() ?? null)) return true;
  }

  if (a instanceof BlueNode && b instanceof BlueNode) {
    // More robust BlueNode comparison might be needed if .toString() is not sufficient
    // For now, if values are different, they are different.
    // If structure is different (different properties, items), they are different.
    // This is complex. A simple `JSON.stringify(NodeSerializer.serialize(a))` might be better if available.
    // For 'test' op, this needs to be quite accurate.
    // The current implementation might rely on `nodeify(expected)` in opTest to make types match.
    return a.toString() === b.toString(); // Placeholder, might need better comparison
  }

  if (isNumeric(a) && isNumeric(b)) {
    return a.toString() === b.toString();
  }
  if (isNumeric(a) && typeof b === 'number') {
    return a.toString() === b.toString();
  }
  if (typeof a === 'number' && isNumeric(b)) {
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
  if (t === '-') return -1; // Keep -1 for append semantic if used directly by operations
  const n = typeof t === 'number' ? t : parseInt(t, 10);
  // Allow non-finite for initial check, but operations should validate further if needed
  if (isNaN(n)) {
    // Check for NaN specifically
    throw new Error(`Invalid array index (NaN) from '${t}'`);
  }
  if (!Number.isFinite(n) /*&& n !== -1 removed as -1 is finite */) {
    throw new Error(
      `Invalid array index '${t}' results in non-finite number ${n}`
    );
  }
  return n;
}
