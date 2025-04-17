import { NodeProvider } from '../NodeProvider';
import { BlueNode } from '../model';
import { BasicDirectoryBasedNodeProvider } from './DirectoryBasedNodeProvider';

/**
 * A provider that supplies bootstrap nodes
 * This is a simplified version of the Java implementation
 */
export class BootstrapProvider extends NodeProvider {
  public static readonly INSTANCE: BootstrapProvider = new BootstrapProvider();

  private nodeProvider: NodeProvider;

  private constructor() {
    super();
    this.nodeProvider = new BasicDirectoryBasedNodeProvider();
  }

  override fetchByBlueId(blueId: string): BlueNode[] | null {
    return this.nodeProvider.fetchByBlueId(blueId);
  }
}
