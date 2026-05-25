import { FrozenNode } from './FrozenNode';

export class ResolvedReferenceCache {
  private readonly values = new Map<string, FrozenNode>();

  public get(blueId: string): FrozenNode | undefined {
    return this.values.get(blueId);
  }

  public set(blueId: string, node: FrozenNode): void {
    this.values.set(blueId, node);
  }

  public clear(): void {
    this.values.clear();
  }
}
