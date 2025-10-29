import { expect } from 'vitest';
import { BlueNode, Blue } from '@blue-labs/language';

import { DocumentProcessor } from '../api/document-processor.js';
import type { AnyContractProcessor } from '../registry/types.js';
import { resolvePointer } from '../util/pointer-utils.js';
import type { DocumentProcessingResult } from '../types/document-processing-result.js';

export function expectOk(
  result: DocumentProcessingResult,
  message = 'Expected successful document processing result',
): DocumentProcessingResult {
  const failureDetails =
    result.failureReason != null
      ? ` Failure reason: ${result.failureReason}`
      : '';
  expect(result.capabilityFailure, `${message}.${failureDetails}`).toBe(false);
  return result;
}

export function expectErr(
  result: DocumentProcessingResult,
  message = 'Expected capability failure',
): DocumentProcessingResult {
  expect(result.capabilityFailure, message).toBe(true);
  return result;
}

export function property(node: BlueNode, key: string): BlueNode {
  const props = node.getProperties();
  expect(props, `Expected properties to contain '${key}'`).toBeDefined();
  const child = props?.[key];
  expect(child, `Missing property '${key}'`).toBeInstanceOf(BlueNode);
  return child as BlueNode;
}

export function propertyOptional(
  node: BlueNode,
  key: string,
): BlueNode | undefined {
  return node.getProperties()?.[key];
}

export function array(node: BlueNode, key: string): readonly BlueNode[] {
  const arrNode = property(node, key);
  const items = arrNode.getItems();
  expect(items, `Expected array for '${key}'`).toBeDefined();
  return items as readonly BlueNode[];
}

export function stringProperty(node: BlueNode, key: string): string | null {
  const value = propertyOptional(node, key)?.getValue();
  return value != null ? String(value) : null;
}

export function typeBlueId(node: BlueNode): string | null {
  const value = node.getType?.()?.getBlueId?.();
  return value != null ? String(value) : null;
}

export function numericProperty(node: BlueNode, key: string): number {
  const valueNode = property(node, key);
  return numericValue(valueNode);
}

export function numericValue(node: BlueNode): number {
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
  document: BlueNode,
  scopePath: string,
): BlueNode | null {
  try {
    const pointer = resolvePointer(scopePath, '/contracts/terminated');
    const value = document.get(pointer);
    return value instanceof BlueNode ? value : null;
  } catch {
    return null;
  }
}
