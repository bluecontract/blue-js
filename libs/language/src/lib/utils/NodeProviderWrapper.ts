import { NodeProvider } from '../NodeProvider';
import { SequentialNodeProvider } from '../provider/SequentialNodeProvider';
import { BootstrapProvider } from '../provider/BootstrapProvider';
import { VerifyingNodeProvider } from '../provider/VerifyingNodeProvider';

export const REPOSITORY_BASED_NODE_PROVIDER = Symbol.for(
  'blue.repositoryBasedNodeProvider',
);

interface RepositoryBasedNodeProviderMarker extends NodeProvider {
  [REPOSITORY_BASED_NODE_PROVIDER]?: true;
}

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
    if (this.isAlreadyWrapped(originalProvider)) {
      return originalProvider;
    }

    if (this.isUnverified(originalProvider)) {
      return new SequentialNodeProvider([
        BootstrapProvider.INSTANCE,
        originalProvider,
      ]);
    }

    const providers: NodeProvider[] = [
      BootstrapProvider.INSTANCE,
      new VerifyingNodeProvider(originalProvider),
    ];

    return new SequentialNodeProvider(providers);
  }

  public static unverified(originalProvider: NodeProvider): NodeProvider {
    return new UnverifiedNodeProvider(originalProvider);
  }

  public static isUnverified(provider: NodeProvider): boolean {
    if (provider instanceof UnverifiedNodeProvider) {
      return true;
    }
    if (
      (provider as RepositoryBasedNodeProviderMarker)[
        REPOSITORY_BASED_NODE_PROVIDER
      ] === true
    ) {
      return true;
    }
    return (
      provider instanceof SequentialNodeProvider &&
      provider
        .getNodeProviders()
        .some((nestedProvider) => this.isUnverified(nestedProvider))
    );
  }

  private static isAlreadyWrapped(originalProvider: NodeProvider): boolean {
    if (!(originalProvider instanceof SequentialNodeProvider)) {
      return false;
    }
    return originalProvider
      .getNodeProviders()
      .some(
        (provider) =>
          provider === BootstrapProvider.INSTANCE ||
          provider instanceof VerifyingNodeProvider ||
          provider instanceof UnverifiedNodeProvider,
      );
  }
}

class UnverifiedNodeProvider extends NodeProvider {
  constructor(private readonly delegate: NodeProvider) {
    super();
  }

  override fetchByBlueId(blueId: string) {
    return this.delegate.fetchByBlueId(blueId);
  }
}
