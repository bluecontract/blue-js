import { BlueNode } from '../../model/Node';
import {
  resolve,
  read,
  insert,
  remove,
  writePath,
  readPath,
  deepClone,
  deepEqual,
  nodeify,
  split,
  isNumeric,
  RValue,
  BigIntegerNumber,
  BigDecimalNumber, // These are now re-exported from patch-utils
  write,
  Numeric, // write is also needed by opReplace for actualTarget logic
} from './patch-utils';

// opAdd, opReplace, opRemove, opCopy, opMove, opTest functions from NodePatch.ts will go here
// (Their content is large, will be moved from existing NodePatch.ts by a subsequent delete/edit operation on NodePatch.ts)

export function opAdd(root: BlueNode, path: string, raw: unknown): boolean {
  const tokens = split(path);
  if (tokens.length === 0 && path === '/') {
    if (root.getItems() && Array.isArray(raw)) {
      const newRootContent = nodeify(raw);
      if (newRootContent.getItems()) {
        root.setItems(newRootContent.getItems());
        root.setValue(null);
      } else {
        root.setValue(newRootContent.getValue() ?? null);
        root.setItems(undefined);
      }
    } else {
      const newNode = nodeify(raw);
      root.setValue(newNode.getValue() ?? null);
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
        // Intentionally empty block for non-primitive, non-array raw value for root add (no standard behavior to set properties)
      }
    }
    return true;
  }
  const { parent, key } = resolve(root, tokens);
  insert(parent, key, raw, false);
  return true;
}

export function opReplace(root: BlueNode, path: string, raw: unknown): boolean {
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
  const { parent, key, actualTarget } = resolve(root, tokens);
  if (actualTarget !== undefined && parent instanceof BlueNode) {
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
      if (isArrayTarget) {
        throw new Error(
          `REPLACE failed: Target array index '${key.toString()}' is out of bounds or does not exist at path '${path}'.`
        );
      } else {
        insert(parent, key, raw, true);
      }
    } else {
      insert(parent, key, raw, true);
    }
  }
  return true;
}

export function opRemove(root: BlueNode, path: string): boolean {
  const tokens = split(path);
  if (tokens.length === 0 && path === '/') {
    root.setValue(null);
    root.setItems(undefined);
    root.setProperties(undefined);
    return true;
  }
  const { parent, key } = resolve(root, tokens);
  remove(parent, key);
  return true;
}

export function opCopy(root: BlueNode, from: string, to: string): boolean {
  const cloned = deepClone(readPath(root, from));
  writePath(root, to, cloned);
  return true;
}

export function opMove(root: BlueNode, from: string, to: string): boolean {
  const fromTokens = split(from);
  const { parent: fromParent, key: fromKey } = resolve(root, fromTokens);
  const valueAtFrom = read(fromParent, fromKey);
  if (valueAtFrom === undefined) {
    throw new Error(`MOVE failed: 'from' location '${from}' does not exist.`);
  }
  if (opRemove(root, from)) {
    writePath(root, to, valueAtFrom);
    return true;
  }
  return false;
}

export function opTest(
  root: BlueNode,
  path: string,
  expected: unknown
): boolean {
  const actual = readPath(root, path);
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
      expectedToCompare = nodeify(expected);
    }
  } else if (isNumeric(actual) && typeof expected === 'number') {
    if (actual instanceof BigIntegerNumber)
      expectedToCompare = new BigIntegerNumber(expected.toString());
    else if (actual instanceof BigDecimalNumber)
      expectedToCompare = new BigDecimalNumber(expected.toString());
  } else if (
    (actual === null ||
      typeof actual === 'string' ||
      typeof actual === 'number' ||
      typeof actual === 'boolean') &&
    isNumeric(expected)
  ) {
    const expectedNum = expected as Numeric;
    if (
      !deepEqual(actual, expectedNum.toString()) &&
      !(
        typeof actual === 'number' &&
        actual === parseFloat(expectedNum.toString())
      )
    ) {
      // Intentionally empty block for mismatch logic - deepEqual will handle the final throw
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
