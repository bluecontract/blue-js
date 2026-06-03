import { Blue, BlueNode, PathLimits } from '@blue-labs/language';

import type { TypeValidationMemo } from './type-validation-memo.js';
import {
  descendantOrEqual,
  escapePointerSegment,
  splitPointer,
} from './type-generalization-pointer-utils.js';

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
      this.descriptorCache.set(blueId, undefined);
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
    this.descriptorCache.set(blueId, descriptor);
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

    const memo = memoForFocus(validationMemo, focusPointer);
    const cached = memo?.get(pointer, blueId);
    if (cached !== undefined) {
      return cached;
    }

    const typed = node.clone().setType(new BlueNode().setBlueId(blueId));
    const limits =
      focusPointer === undefined
        ? undefined
        : PathLimits.withSinglePath(
            relativeFocusPointer(pointer, focusPointer),
          );
    const result = this.blue.isTypeOfNode(
      typed,
      typeNode.clone().setBlueId(blueId),
      {
        memo,
        pointer,
        limits,
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
      this.typeCache.set(blueId, null);
      return null;
    }
    const typeNode = nodes[0].clone().setBlueId(blueId);
    this.typeCache.set(blueId, typeNode);
    return typeNode.clone();
  }
}

function typeBlueId(node: BlueNode | null | undefined): string | null {
  return node?.getBlueId() ?? node?.getReferenceBlueId() ?? null;
}

function relativeFocusPointer(
  pointer: string,
  focusPointer: string | undefined,
): string {
  if (!focusPointer || !descendantOrEqual(focusPointer, pointer)) {
    return '/';
  }

  const pointerSegments = splitPointer(pointer);
  const focusSegments = splitPointer(focusPointer);
  const relativeSegments = focusSegments.slice(pointerSegments.length);
  if (relativeSegments.length === 0) {
    return '/';
  }
  return `/${relativeSegments.map(escapePointerSegment).join('/')}`;
}

function memoForFocus(
  memo: TypeValidationMemo | undefined,
  focusPointer: string | undefined,
): Pick<TypeValidationMemo, 'get' | 'set'> | undefined {
  if (!memo || focusPointer === undefined) {
    return memo;
  }

  const profile = `focus:${focusPointer}`;
  return {
    get(pointer, expectedTypeBlueId) {
      return memo.get(pointer, profileKey(expectedTypeBlueId, profile));
    },
    set(pointer, expectedTypeBlueId, value) {
      memo.set(pointer, profileKey(expectedTypeBlueId, profile), value);
    },
  };
}

function profileKey(expectedTypeBlueId: string, profile: string): string {
  return `${expectedTypeBlueId}\u0001${profile}`;
}
