import { NodeProvider } from '../NodeProvider';
import { SequentialNodeProvider } from '../provider/SequentialNodeProvider';
import { BootstrapProvider } from '../provider/BootstrapProvider';

/**
 * Utility to wrap a NodeProvider with a SequentialNodeProvider that includes bootstrap providers
 */
export class NodeProviderWrapper {
  /**
   * Wraps a NodeProvider with a SequentialNodeProvider that includes bootstrap providers
   * @param originalProvider - The original NodeProvider to wrap
   * @returns A wrapped NodeProvider that includes bootstrap providers
   */
  public static wrap(originalProvider: NodeProvider): NodeProvider {
    return new SequentialNodeProvider([
      BootstrapProvider.INSTANCE,
      originalProvider,
    ]);
  }
}
