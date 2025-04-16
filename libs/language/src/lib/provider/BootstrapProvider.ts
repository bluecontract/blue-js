import { NodeProvider } from '../NodeProvider';
import { BlueNode } from '../model';

/**
 * A provider that supplies bootstrap nodes
 * This is a simplified version of the Java implementation
 */
export class BootstrapProvider extends NodeProvider {
  public static readonly INSTANCE: BootstrapProvider = new BootstrapProvider();

  private constructor() {
    super();
    // Private constructor to enforce singleton pattern
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  override fetchByBlueId(blueId: string): BlueNode[] {
    // In TypeScript implementation we're returning an empty array
    // The actual implementation would load bootstrap nodes from a resource
    return [];
  }

  // We don't need to implement fetchFirstByBlueId as it's inherited from NodeProvider
}
