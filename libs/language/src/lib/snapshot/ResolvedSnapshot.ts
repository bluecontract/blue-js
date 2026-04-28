import { SemanticIdentityService } from '../identity/SemanticIdentityService';
import { BlueNode } from '../model';
import { ResolvedBlueNode } from '../model/ResolvedNode';
import { FrozenNode } from './FrozenNode';
import { SnapshotPathIndex } from './SnapshotPathIndex';

export class ResolvedSnapshot {
  private minimalRoot?: FrozenNode;
  private blueIdCache?: string;
  private pathIndex?: SnapshotPathIndex;

  constructor(
    public readonly resolvedRoot: FrozenNode,
    private readonly semanticIdentityService = new SemanticIdentityService(),
  ) {}

  public static fromResolvedNode(
    resolvedNode: ResolvedBlueNode,
    semanticIdentityService?: SemanticIdentityService,
  ): ResolvedSnapshot {
    return new ResolvedSnapshot(
      FrozenNode.fromBlueNode(resolvedNode),
      semanticIdentityService,
    );
  }

  public get blueId(): string {
    if (this.blueIdCache === undefined) {
      this.blueIdCache = this.semanticIdentityService.hashMinimalTrusted(
        this.toMinimal().toMutableNode(),
      );
    }

    return this.blueIdCache;
  }

  public toMinimal(): FrozenNode {
    if (this.minimalRoot === undefined) {
      this.minimalRoot = FrozenNode.fromBlueNode(
        this.semanticIdentityService.minimizeResolved(this.toResolvedNode()),
      );
    }

    return this.minimalRoot;
  }

  public toResolvedNode(): ResolvedBlueNode {
    const resolvedNode = this.resolvedRoot.toMutableNode();
    if (resolvedNode instanceof ResolvedBlueNode) {
      return resolvedNode;
    }

    return new ResolvedBlueNode(resolvedNode);
  }

  public toMutableNode(): BlueNode {
    return this.resolvedRoot.toMutableNode();
  }

  public getNode(pointer: string): FrozenNode | undefined {
    return this.getPathIndex().getNode(pointer);
  }

  public hasNode(pointer: string): boolean {
    return this.getPathIndex().hasNode(pointer);
  }

  public getPointer(node: FrozenNode): string | undefined {
    return this.getPathIndex().getPointer(node);
  }

  private getPathIndex(): SnapshotPathIndex {
    if (this.pathIndex === undefined) {
      this.pathIndex = SnapshotPathIndex.fromRoot(this.resolvedRoot);
    }

    return this.pathIndex;
  }
}
