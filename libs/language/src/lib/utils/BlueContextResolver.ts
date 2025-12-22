import { BlueNode } from '../model';
import type { BlueIdMapper } from '../types/BlueIdMapper';
import { BlueContext } from '../types/BlueContext';
import { BlueError, BlueErrorCode } from '../errors/BlueError';
import { RepositoryRegistry } from '../repository/RepositoryRuntime';
import { normalizeBlueContextRepositories } from './BlueContextRepositoriesParser';
import { RepositoryVersionSerializer } from './RepositoryVersionSerializer';
import { normalizeNodeBlueIds } from './repositoryVersioning/normalizeNodeBlueIds';

interface BlueContextResolverOptions {
  registry: RepositoryRegistry;
  blueIdMapper?: BlueIdMapper;
}

export class BlueContextResolver {
  private readonly registry: RepositoryRegistry;
  private readonly blueIdMapper?: BlueIdMapper;

  constructor(options: BlueContextResolverOptions) {
    this.registry = options.registry;
    this.blueIdMapper = options.blueIdMapper;
  }

  public transform(node: BlueNode, blueContext: BlueContext): BlueNode {
    const targetRepoVersionIndexes =
      this.computeTargetRepoVersionIndexes(blueContext);

    if (Object.keys(targetRepoVersionIndexes).length === 0) {
      return node;
    }

    const normalized = normalizeNodeBlueIds(node, this.blueIdMapper);

    const serializer = new RepositoryVersionSerializer({
      registry: this.registry,
      targetRepoVersionIndexes,
      fallbackToCurrentInlineDefinitions:
        blueContext.fallbackToCurrentInlineDefinitions !== false,
    });

    return serializer.transform(normalized);
  }

  private computeTargetRepoVersionIndexes(
    blueContext: BlueContext | undefined,
  ): Record<string, number> {
    const result: Record<string, number> = {};

    if (!blueContext?.repositories) {
      return result;
    }

    const repositories =
      typeof blueContext.repositories === 'string'
        ? normalizeBlueContextRepositories(blueContext.repositories)
        : blueContext.repositories;
    for (const [repoName, repoBlueId] of Object.entries(repositories)) {
      const runtime = this.registry.findRuntimeByName(repoName);
      if (!runtime) {
        continue;
      }
      const index = runtime.repoVersionIndexById[repoBlueId];
      if (index === undefined) {
        throw this.unknownRepoBlueIdError(
          repoName,
          repoBlueId,
          runtime.currentRepoBlueId,
        );
      }
      result[repoName] = index;
    }

    return result;
  }

  private unknownRepoBlueIdError(
    repoName: string,
    requestedRepoBlueId: string,
    serverRepoBlueId: string,
  ): BlueError {
    const message = `Unknown RepoBlueId '${requestedRepoBlueId}' for repository '${repoName}'.`;
    const detail = {
      code: BlueErrorCode.REPO_UNKNOWN_REPO_BLUE_ID,
      message,
      locationPath: [],
      context: {
        repoName,
        requestedRepoBlueId,
        serverRepoBlueId,
      },
    };
    return new BlueError(BlueErrorCode.REPO_UNKNOWN_REPO_BLUE_ID, message, [
      detail,
    ]);
  }
}
