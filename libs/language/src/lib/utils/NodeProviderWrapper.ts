import { NodeProvider } from '../NodeProvider';
import { SequentialNodeProvider } from '../provider/SequentialNodeProvider';
import { BootstrapProvider } from '../provider/BootstrapProvider';
import { RepositoryBasedNodeProvider } from '../provider/RepositoryBasedNodeProvider';
import { BlueRepository } from '../types/BlueRepository';

/**
 * Utility to wrap a NodeProvider with a SequentialNodeProvider that includes bootstrap providers
 */
export class NodeProviderWrapper {
  /**
   * Wraps a NodeProvider with a SequentialNodeProvider that includes bootstrap providers and repository definitions
   * @param originalProvider - The original NodeProvider to wrap
   * @param repositories - Optional repositories containing definitions
   * @param options - Additional options
   * @returns A wrapped NodeProvider that includes bootstrap providers and repository definitions
   */
  public static wrap(
    originalProvider: NodeProvider,
    repositories?: BlueRepository[],
    options?: { toCurrentBlueId?: (blueId: string) => string },
  ): NodeProvider {
    const providers: NodeProvider[] = [BootstrapProvider.INSTANCE];

    if (repositories && repositories.length > 0) {
      // Create RepositoryBasedNodeProvider with access to the wrapped provider chain
      // This allows preprocessing to work correctly with all providers
      const repositoryProvider = new RepositoryBasedNodeProvider(
        repositories,
        options?.toCurrentBlueId,
      );
      providers.push(repositoryProvider);
    }

    providers.push(originalProvider);

    return new SequentialNodeProvider(providers);
  }
}
