import { FrozenNode } from './FrozenNode';
import {
  appendSnapshotPointerSegment,
  normalizeSnapshotPointer,
} from './pointer';

type FrozenNodeGetter = (node: FrozenNode) => FrozenNode | undefined;

const STRUCTURAL_NODE_FIELDS: ReadonlyArray<{
  segment: string;
  getter: FrozenNodeGetter;
}> = [
  { segment: 'type', getter: (node) => node.getType() },
  { segment: 'itemType', getter: (node) => node.getItemType() },
  { segment: 'keyType', getter: (node) => node.getKeyType() },
  { segment: 'valueType', getter: (node) => node.getValueType() },
  { segment: 'blue', getter: (node) => node.getBlue() },
];

export class SnapshotPathIndex {
  private readonly nodeByPointer = new Map<string, FrozenNode>();
  private readonly pointerByNode = new WeakMap<FrozenNode, string>();

  public static fromRoot(root: FrozenNode): SnapshotPathIndex {
    const index = new SnapshotPathIndex();
    index.visit(root, '/');
    return index;
  }

  public getNode(pointer: string): FrozenNode | undefined {
    const normalizedPointer = normalizeSnapshotPointer(pointer);
    return normalizedPointer === undefined
      ? undefined
      : this.nodeByPointer.get(normalizedPointer);
  }

  public hasNode(pointer: string): boolean {
    return this.getNode(pointer) !== undefined;
  }

  public getPointer(node: FrozenNode): string | undefined {
    return this.pointerByNode.get(node);
  }

  private visit(node: FrozenNode, pointer: string): void {
    if (!this.nodeByPointer.has(pointer)) {
      this.nodeByPointer.set(pointer, node);
    }

    if (!this.pointerByNode.has(node)) {
      this.pointerByNode.set(node, pointer);
    }

    for (const [key, child] of Object.entries(node.getProperties() ?? {})) {
      this.visitChild(child, pointer, key);
    }

    node
      .getItems()
      ?.forEach((child, index) =>
        this.visitChild(child, pointer, String(index)),
      );

    for (const { segment, getter } of STRUCTURAL_NODE_FIELDS) {
      const child = getter(node);
      if (child !== undefined) {
        this.visitChild(child, pointer, segment);
      }
    }
  }

  private visitChild(
    child: FrozenNode,
    parentPointer: string,
    segment: string,
  ): void {
    const childPointer = appendSnapshotPointerSegment(parentPointer, segment);
    if (this.nodeByPointer.has(childPointer)) {
      return;
    }

    this.visit(child, childPointer);
  }
}
