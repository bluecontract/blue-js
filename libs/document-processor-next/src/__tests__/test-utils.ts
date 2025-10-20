import { expect } from 'vitest';
import { BlueNode, Blue } from '@blue-labs/language';

import type { Result } from '../types/result.js';
import type { Node } from '../types/index.js';
import { DocumentProcessor } from '../api/document-processor.js';
import type { AnyContractProcessor } from '../registry/types.js';
import { resolvePointer } from '../util/pointer-utils.js';

export function expectOk<T, E>(
  result: Result<T, E>,
  message = 'Expected result to be ok'
): T {
  expect(result.ok, message).toBe(true);
  if (!result.ok) {
    throw new Error(
      `${message}: ${JSON.stringify(result.error, null, 2) ?? 'unknown error'}`
    );
  }
  return result.value;
}

export function expectErr<T, E>(
  result: Result<T, E>,
  message = 'Expected result to be err'
): E {
  expect(result.ok, message).toBe(false);
  if (result.ok) {
    throw new Error(`${message}: received ok(${String(result.value)})`);
  }
  return result.error;
}

export function property(node: Node, key: string): BlueNode {
  const props = node.getProperties();
  expect(props, `Expected properties to contain '${key}'`).toBeDefined();
  const child = props?.[key];
  expect(child, `Missing property '${key}'`).toBeInstanceOf(BlueNode);
  return child as BlueNode;
}

export function propertyOptional(node: Node, key: string): BlueNode | undefined {
  return node.getProperties()?.[key];
}

export function array(node: Node, key: string): readonly BlueNode[] {
  const arrNode = property(node, key);
  const items = arrNode.getItems();
  expect(items, `Expected array for '${key}'`).toBeDefined();
  return items as readonly BlueNode[];
}

export function stringProperty(node: Node, key: string): string | null {
  const value = propertyOptional(node, key)?.getValue();
  return value != null ? String(value) : null;
}

export function numericProperty(node: Node, key: string): number {
  const valueNode = property(node, key);
  return numericValue(valueNode);
}

export function numericValue(node: Node): number {
  const raw = node.getValue();
  if (raw == null) {
    throw new Error('Expected numeric value but received null');
  }
  if (typeof raw === 'number') {
    return raw;
  }
  if (typeof (raw as { toNumber?: unknown }).toNumber === 'function') {
    return (raw as { toNumber: () => number }).toNumber();
  }
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Expected numeric value but received ${String(raw)}`);
  }
  return parsed;
}

export function valueNode(value: string | number | boolean | null): BlueNode {
  return new BlueNode().setValue(value ?? null);
}

export function buildProcessor(
  blue: Blue,
  ...processors: readonly AnyContractProcessor[]
): DocumentProcessor {
  const processor = new DocumentProcessor({ blue });
  for (const p of processors) {
    processor.registerContractProcessor(p);
  }
  return processor;
}

export function terminatedMarker(
  document: Node,
  scopePath: string
): BlueNode | null {
  try {
    const pointer = resolvePointer(scopePath, '/contracts/terminated');
    const value = document.get(pointer);
    return value instanceof BlueNode ? value : null;
  } catch {
    return null;
  }
}
