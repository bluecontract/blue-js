import { NodeProvider } from '../NodeProvider';
import { BlueNode } from '../model';
import { BaseContentNodeProvider } from './BaseContentNodeProvider';

/**
 * A provider that supplies bootstrap nodes
 * This is a simplified version of the Java implementation
 */
export class BootstrapProvider extends NodeProvider {
  public static readonly INSTANCE: BootstrapProvider = new BootstrapProvider();

  private nodeProvider: NodeProvider;

  private constructor() {
    super();
    this.nodeProvider = new BaseContentNodeProvider();
  }

  override fetchByBlueId(blueId: string): BlueNode[] | null {
    return this.nodeProvider.fetchByBlueId(blueId);
  }
}
