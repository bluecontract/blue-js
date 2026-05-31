import { Blue, BlueNode } from '@blue-labs/language';

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
      !this.isValidForType(root, pointer, node, type.parentBlueId, seenTypes)
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
  constructor(
    private readonly blue: Blue,
    private readonly nodeAt: (
      root: BlueNode | null,
      pointer: string,
    ) => BlueNode | null,
  ) {}

  typeFor(blueId: string): TypeDescriptor | undefined {
    const typeNode = this.fetchType(blueId);
    if (!typeNode) {
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

    return {
      blueId,
      parentBlueId: typeBlueId(typeNode.getType()),
      fixedValues,
      fieldTypes,
    };
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
  ): boolean {
    const typeNode = this.fetchType(blueId);
    if (!typeNode) {
      return true;
    }

    const typed = node.clone().setType(new BlueNode().setBlueId(blueId));
    if (this.blue.isTypeOfNode(typed, typeNode.clone().setBlueId(blueId))) {
      return true;
    }

    const descriptor = this.typeFor(blueId);
    if (!descriptor) {
      return true;
    }
    for (const [fixedPath, expected] of descriptor.fixedValues) {
      const actual = this.nodeAt(node, fixedPath);
      if (!actual || !this.nodesEqual(expected, actual)) {
        return false;
      }
    }
    for (const [fieldPath, expectedType] of descriptor.fieldTypes) {
      const child = this.nodeAt(node, fieldPath);
      if (!child) {
        continue;
      }
      const childType = typeBlueId(child.getType());
      if (!childType || !this.isSubtypeOf(childType, expectedType)) {
        return false;
      }
    }
    return true;
  }

  private fetchType(blueId: string): BlueNode | null {
    const nodes = this.blue.getNodeProvider().fetchByBlueId(blueId);
    if (!nodes || nodes.length !== 1) {
      return null;
    }
    return nodes[0].clone().setBlueId(blueId);
  }

  private nodesEqual(left: BlueNode, right: BlueNode): boolean {
    return (
      JSON.stringify(this.blue.nodeToJson(left, 'simple')) ===
      JSON.stringify(this.blue.nodeToJson(right, 'simple'))
    );
  }
}

function typeBlueId(node: BlueNode | null | undefined): string | null {
  return node?.getBlueId() ?? node?.getReferenceBlueId() ?? null;
}

function escapePointerSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}
