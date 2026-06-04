import { Blue, BlueNode, PathLimits } from '@blue-labs/language';

import type { TypeValidationMemo } from './type-validation-memo.js';
import { escapePointerSegment } from './type-generalization-pointer-utils.js';

const DEFAULT_MAX_TYPE_GRAPH_CACHE_ENTRIES = 4096;

export interface TypeDescriptor {
  readonly blueId: string;
  readonly parentBlueId: string | null;
  readonly fixedValues: ReadonlyMap<string, BlueNode>;
  readonly fieldTypes: ReadonlyMap<string, string>;
}

export interface TypeGraphProvider {
  typeFor(blueId: string): TypeDescriptor | undefined;
  parentType(blueId: string | null | undefined): string | null;
  isSubtypeOf(candidate: string, expectedAncestor: string): boolean;
  isValidForType(
    root: BlueNode,
    pointer: string,
    node: BlueNode,
    blueId: string,
    validationMemo?: TypeValidationMemo,
    focusPointer?: string,
  ): boolean;
}

export class EmptyTypeGraphProvider implements TypeGraphProvider {
  typeFor(): TypeDescriptor | undefined {
    return undefined;
  }

  parentType(): string | null {
    return null;
  }

  isSubtypeOf(candidate: string, expectedAncestor: string): boolean {
    return candidate === expectedAncestor;
  }

  isValidForType(): boolean {
    return true;
  }
}

export class StaticTypeGraphProvider implements TypeGraphProvider {
  private readonly types: ReadonlyMap<string, TypeDescriptor>;

  constructor(
    types: Iterable<TypeDescriptor>,
    private readonly blue: Blue,
    private readonly nodeAt: (
      root: BlueNode | null,
      pointer: string,
    ) => BlueNode | null,
  ) {
    this.types = new Map([...types].map((type) => [type.blueId, type]));
  }

  typeFor(blueId: string): TypeDescriptor | undefined {
    return this.types.get(blueId);
  }

  parentType(blueId: string | null | undefined): string | null {
    if (!blueId) {
      return null;
    }
    return this.typeFor(blueId)?.parentBlueId ?? null;
  }

  isSubtypeOf(candidate: string, expectedAncestor: string): boolean {
    let current: string | null = candidate;
    while (current) {
      if (current === expectedAncestor) {
        return true;
      }
      current = this.parentType(current);
    }
    return false;
  }

  isValidForType(
    root: BlueNode,
    pointer: string,
    node: BlueNode,
    blueId: string,
    validationMemo?: TypeValidationMemo,
    focusPointer?: string,
    seenTypes = new Set<string>(),
  ): boolean {
    const type = this.typeFor(blueId);
    if (!type) {
      return true;
    }
    if (seenTypes.has(blueId)) {
      return false;
    }
    seenTypes.add(blueId);

    if (
      type.parentBlueId &&
      !this.isValidForType(
        root,
        pointer,
        node,
        type.parentBlueId,
        validationMemo,
        focusPointer,
        seenTypes,
      )
    ) {
      return false;
    }

    for (const [fixedPath, expected] of type.fixedValues) {
      const actual = this.nodeAt(node, fixedPath);
      if (!actual || !this.nodesEqual(expected, actual)) {
        return false;
      }
    }

    for (const [fieldPath, expectedType] of type.fieldTypes) {
      const child = this.nodeAt(node, fieldPath);
      if (!child) {
        continue;
      }
      const childType = child.getType()?.getBlueId() ?? null;
      if (!childType || !this.isSubtypeOf(childType, expectedType)) {
        return false;
      }
    }

    return true;
  }

  private nodesEqual(left: BlueNode, right: BlueNode): boolean {
    return (
      JSON.stringify(this.blue.nodeToJson(left, 'simple')) ===
      JSON.stringify(this.blue.nodeToJson(right, 'simple'))
    );
  }
}

export class BlueNodeTypeGraphProvider implements TypeGraphProvider {
  private readonly typeCache = new Map<string, BlueNode | null>();
  private readonly descriptorCache = new Map<
    string,
    TypeDescriptor | undefined
  >();

  constructor(private readonly blue: Blue) {}

  typeFor(blueId: string): TypeDescriptor | undefined {
    if (this.descriptorCache.has(blueId)) {
      return this.descriptorCache.get(blueId);
    }

    const typeNode = this.fetchType(blueId);
    if (!typeNode) {
      setBoundedCacheEntry(this.descriptorCache, blueId, undefined);
      return undefined;
    }

    const fixedValues = new Map<string, BlueNode>();
    const fieldTypes = new Map<string, string>();
    for (const [key, child] of Object.entries(typeNode.getProperties() ?? {})) {
      const pointer = `/${escapePointerSegment(key)}`;
      if (child.getValue() !== undefined) {
        fixedValues.set(pointer, child.clone());
      }
      const childType = typeBlueId(child.getType());
      if (childType) {
        fieldTypes.set(pointer, childType);
      }
    }

    const descriptor = {
      blueId,
      parentBlueId: typeBlueId(typeNode.getType()),
      fixedValues,
      fieldTypes,
    };
    setBoundedCacheEntry(this.descriptorCache, blueId, descriptor);
    return descriptor;
  }

  parentType(blueId: string | null | undefined): string | null {
    if (!blueId) {
      return null;
    }
    return this.typeFor(blueId)?.parentBlueId ?? null;
  }

  isSubtypeOf(candidate: string, expectedAncestor: string): boolean {
    let current: string | null = candidate;
    while (current) {
      if (current === expectedAncestor) {
        return true;
      }
      current = this.parentType(current);
    }
    return false;
  }

  isValidForType(
    root: BlueNode,
    pointer: string,
    node: BlueNode,
    blueId: string,
    validationMemo?: TypeValidationMemo,
    focusPointer?: string,
  ): boolean {
    const typeNode = this.fetchType(blueId);
    if (!typeNode) {
      return true;
    }

    const memo = validationMemo;
    const cached = memo?.get(pointer, blueId);
    if (cached !== undefined) {
      return cached;
    }

    const typed = node.clone().setType(new BlueNode().setBlueId(blueId));
    const result = this.blue.isTypeOfNode(
      typed,
      typeNode.clone().setBlueId(blueId),
      {
        limits: limitsForFocusedValidation(pointer, focusPointer, typeNode),
        memo,
        pointer,
      },
    );
    memo?.set(pointer, blueId, result);
    return result;
  }

  private fetchType(blueId: string): BlueNode | null {
    if (this.typeCache.has(blueId)) {
      return this.typeCache.get(blueId) ?? null;
    }
    const nodes = this.blue.getNodeProvider().fetchByBlueId(blueId);
    if (!nodes || nodes.length !== 1) {
      setBoundedCacheEntry(this.typeCache, blueId, null);
      return null;
    }
    const typeNode = nodes[0].clone().setBlueId(blueId);
    setBoundedCacheEntry(this.typeCache, blueId, typeNode);
    return typeNode.clone();
  }
}

function limitsForFocusedValidation(
  pointer: string,
  focusPointer: string | undefined,
  targetType: BlueNode,
): PathLimits | undefined {
  const relative = relativeFocusPath(pointer, focusPointer);
  if (
    relative === undefined ||
    focusPathRequiresWholeNodeValidation(targetType, relative)
  ) {
    return undefined;
  }
  return PathLimits.withSinglePath(relative);
}

function relativeFocusPath(
  pointer: string,
  focusPointer: string | undefined,
): string | undefined {
  if (!focusPointer) {
    return undefined;
  }

  const base = normalizeValidationPointer(pointer);
  const focus = normalizeValidationPointer(focusPointer);
  if (base === '/') {
    return focus;
  }
  if (focus === base) {
    return '/';
  }
  if (focus.startsWith(`${base}/`)) {
    return focus.slice(base.length);
  }
  return undefined;
}

function normalizeValidationPointer(pointer: string): string {
  const trimmed = pointer.trim();
  if (trimmed.length === 0 || trimmed === '/') {
    return '/';
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function focusPathRequiresWholeNodeValidation(
  targetType: BlueNode,
  relativeFocusPath: string,
): boolean {
  let current: BlueNode | undefined = targetType;
  for (const segment of splitValidationPointer(relativeFocusPath)) {
    if (!current) {
      return false;
    }
    if (requiresWholeNodeValidation(current)) {
      return true;
    }
    current =
      current.getProperties()?.[segment] ??
      current.getItems()?.[Number(segment)];
  }
  return current ? requiresWholeNodeValidation(current) : false;
}

function requiresWholeNodeValidation(node: BlueNode): boolean {
  return (
    node.getItemType() !== undefined ||
    node.getValueType() !== undefined ||
    schemaInteger(node, 'minItems') !== undefined ||
    schemaInteger(node, 'maxItems') !== undefined ||
    schemaInteger(node, 'minFields') !== undefined ||
    schemaInteger(node, 'maxFields') !== undefined
  );
}

function schemaInteger(
  node: BlueNode,
  key: 'minItems' | 'maxItems' | 'minFields' | 'maxFields',
): number | undefined {
  const value = node.getSchema()?.get(key)?.getValue();
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (
    value &&
    typeof value === 'object' &&
    typeof value.toString === 'function'
  ) {
    const numeric = Number(value.toString());
    if (Number.isInteger(numeric)) {
      return numeric;
    }
  }
  return undefined;
}

function splitValidationPointer(pointer: string): string[] {
  const normalized = normalizeValidationPointer(pointer);
  if (normalized === '/') {
    return [];
  }
  return normalized
    .slice(1)
    .split('/')
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function typeBlueId(node: BlueNode | null | undefined): string | null {
  return node?.getBlueId() ?? node?.getReferenceBlueId() ?? null;
}

function setBoundedCacheEntry<T>(
  cache: Map<string, T>,
  key: string,
  value: T,
): void {
  if (!cache.has(key) && cache.size >= DEFAULT_MAX_TYPE_GRAPH_CACHE_ENTRIES) {
    cache.clear();
  }
  cache.set(key, value);
}
