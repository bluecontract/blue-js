import { NodeProvider } from '../NodeProvider';
import { BlueNode } from '../model';

/**
 * A NodeProvider that tries to fetch nodes sequentially from a list of providers
 * Returns the result from the first provider that returns a non-empty result
 */
export class SequentialNodeProvider extends NodeProvider {
  private nodeProviders: NodeProvider[];

  constructor(nodeProviders: NodeProvider[]) {
    super();
    this.nodeProviders = nodeProviders;
  }

  override fetchByBlueId(blueId: string): BlueNode[] {
    for (const provider of this.nodeProviders) {
      const nodes = provider.fetchByBlueId(blueId);
      if (nodes && nodes.length > 0) {
        return nodes;
      }
    }
    return [];
  }

  // Override fetchFirstByBlueId for more efficient implementation
  // In Java, this would call the default implementation, but we optimize here
  override fetchFirstByBlueId(blueId: string): BlueNode | null {
    for (const provider of this.nodeProviders) {
      const node = provider.fetchFirstByBlueId(blueId);
      if (node) {
        return node;
      }
    }
    return null;
  }

  getNodeProviders(): NodeProvider[] {
    return this.nodeProviders;
  }
}
