import { InMemoryNodeProvider } from '../provider/InMemoryNodeProvider';
import { NodeDeserializer } from '../model';
import { BlueRepository } from '../Blue';

/**
 * Factory for creating InMemoryNodeProvider from repositories with definitions
 */
export class RepositoryNodeProviderFactory {
  /**
   * Creates an InMemoryNodeProvider from repository definitions
   * @param repositories - Optional repositories containing definitions
   * @returns InMemoryNodeProvider if definitions exist, undefined otherwise
   */
  public static createDefinitionsProvider(
    repositories?: BlueRepository[]
  ): InMemoryNodeProvider | undefined {
    if (!repositories) {
      return undefined;
    }

    let definitionsProvider: InMemoryNodeProvider | undefined;

    for (const repository of repositories) {
      if (repository.definitions) {
        if (!definitionsProvider) {
          definitionsProvider = new InMemoryNodeProvider();
        }

        for (const [blueId, definition] of Object.entries(
          repository.definitions
        )) {
          const node = NodeDeserializer.deserialize(definition);
          definitionsProvider.addNodeWithBlueId(blueId, node);
        }
      }
    }

    return definitionsProvider;
  }
}
