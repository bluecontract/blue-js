import { NodeProvider } from '../NodeProvider';
import { SequentialNodeProvider } from '../provider/SequentialNodeProvider';
import { BootstrapProvider } from '../provider/BootstrapProvider';
import { InMemoryNodeProvider } from '../provider/InMemoryNodeProvider';

/**
 * Utility to wrap a NodeProvider with a SequentialNodeProvider that includes bootstrap providers
 */
export class NodeProviderWrapper {
  /**
   * Wraps a NodeProvider with a SequentialNodeProvider that includes bootstrap providers
   * @param originalProvider - The original NodeProvider to wrap
   * @param definitionsProvider - Optional InMemoryNodeProvider containing definitions
   * @returns A wrapped NodeProvider that includes bootstrap providers and optional definitions
   */
  public static wrap(
    originalProvider: NodeProvider,
    definitionsProvider?: InMemoryNodeProvider
  ): NodeProvider {
    const providers: NodeProvider[] = [BootstrapProvider.INSTANCE];

    if (definitionsProvider) {
      providers.push(definitionsProvider);
    }

    providers.push(originalProvider);

    return new SequentialNodeProvider(providers);
  }
}
