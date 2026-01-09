import { describe, expect, it } from 'vitest';
import { BlueContextResolver } from '../BlueContextResolver';
import { RepositoryRegistry } from '../../../repository/RepositoryRuntime';
import { BlueNode } from '../../../model';
import { BlueError, BlueErrorCode } from '../../../errors/BlueError';
import type { BlueRepository } from '../../../types/BlueRepository';
import {
  ids,
  repoBlue,
  textValue,
} from '../../../__tests__/repositoryVersioning/fixtures';

function createResolver(
  repositories: BlueRepository[] = [repoBlue],
  options?: { blueIdMapper?: { toCurrentBlueId: (blueId: string) => string } },
) {
  return new BlueContextResolver({
    registry: new RepositoryRegistry(repositories),
    blueIdMapper: options?.blueIdMapper,
  });
}

describe('BlueContextResolver', () => {
  it('returns the original node when repositories are empty', () => {
    const resolver = createResolver();
    const node = new BlueNode().setType(
      new BlueNode().setBlueId(ids.ruleCurrent),
    );

    const transformed = resolver.transform(node, { repositories: {} });

    expect(transformed).toBe(node);
  });

  it('ignores unknown repository names', () => {
    const resolver = createResolver();
    const node = new BlueNode().setType(
      new BlueNode().setBlueId(ids.ruleCurrent),
    );

    const transformed = resolver.transform(node, {
      repositories: { 'unknown.repo': 'R0' },
    });

    expect(transformed).toBe(node);
  });

  it('throws for unknown repository blue ids', () => {
    const resolver = createResolver();
    const node = new BlueNode().setType(
      new BlueNode().setBlueId(ids.ruleCurrent),
    );

    expect(() =>
      resolver.transform(node, {
        repositories: { 'repo.blue': 'R999' },
      }),
    ).toThrow(BlueError);
    try {
      resolver.transform(node, {
        repositories: { 'repo.blue': 'R999' },
      });
    } catch (err) {
      expect((err as BlueError).code).toEqual(
        BlueErrorCode.REPO_UNKNOWN_REPO_BLUE_ID,
      );
    }
  });

  it('serializes to the requested repository version', () => {
    const resolver = createResolver();
    const node = new BlueNode()
      .setType(new BlueNode().setBlueId(ids.ruleCurrent))
      .setProperties({
        when: textValue('on'),
        then: textValue('off'),
        severity: textValue('high'),
      });

    const transformed = resolver.transform(node, {
      repositories: `repo.blue=${repoBlue.repositoryVersions[0]}`,
    });

    expect(transformed.getType()?.getBlueId()).toEqual(ids.ruleHistoric);
    expect(transformed.getProperties()?.severity).toBeDefined();
    expect(transformed.getProperties()?.when).toBeDefined();
    expect(transformed.getProperties()?.then).toBeDefined();
  });

  it('inlines types when fallback is enabled', () => {
    const resolver = createResolver();
    const node = new BlueNode()
      .setType(new BlueNode().setBlueId(ids.message))
      .setProperties({ text: textValue('hello') });

    const transformed = resolver.transform(node, {
      repositories: { 'repo.blue': repoBlue.repositoryVersions[0] },
    });

    const inlineType = transformed.getType();
    expect(inlineType?.getBlueId()).toBeUndefined();
    expect(inlineType?.getName()).toEqual('Message');
  });

  it('throws when fallback is disabled and type is not representable', () => {
    const resolver = createResolver();
    const node = new BlueNode().setType(new BlueNode().setBlueId(ids.message));

    expect(() =>
      resolver.transform(node, {
        repositories: { 'repo.blue': repoBlue.repositoryVersions[0] },
        fallbackToCurrentInlineDefinitions: false,
      }),
    ).toThrow(BlueError);
    try {
      resolver.transform(node, {
        repositories: { 'repo.blue': repoBlue.repositoryVersions[0] },
        fallbackToCurrentInlineDefinitions: false,
      });
    } catch (err) {
      expect((err as BlueError).code).toEqual(
        BlueErrorCode.REPO_UNREPRESENTABLE_IN_TARGET_VERSION,
      );
    }
  });

  it('normalizes ids with a blue id mapper before serialization', () => {
    const mappedId = 'mapped@v0';
    const repository: BlueRepository = {
      name: 'repo.map',
      repositoryVersions: ['R0'],
      packages: {
        core: {
          name: 'core',
          aliases: { 'core/Mapped': mappedId },
          typesMeta: {
            [mappedId]: {
              status: 'stable',
              name: 'Mapped',
              versions: [
                {
                  repositoryVersionIndex: 0,
                  typeBlueId: mappedId,
                  attributesAdded: [],
                },
              ],
            },
          },
          contents: { [mappedId]: {} },
          schemas: {},
        },
      },
    };
    const resolver = createResolver([repository], {
      blueIdMapper: {
        toCurrentBlueId: (blueId) =>
          blueId === 'mapped@old' ? mappedId : blueId,
      },
    });
    const node = new BlueNode().setType(new BlueNode().setBlueId('mapped@old'));

    const transformed = resolver.transform(node, {
      repositories: { 'repo.map': 'R0' },
    });

    expect(transformed.getType()?.getBlueId()).toEqual(mappedId);
  });
});
