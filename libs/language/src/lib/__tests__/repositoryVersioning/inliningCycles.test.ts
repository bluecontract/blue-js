import { describe, expect, it } from 'vitest';
import { Blue } from '../../Blue';
import { BlueError, BlueErrorCode } from '../../errors/BlueError';
import { BlueNode } from '../../model';
import { NodeToMapListOrValue } from '../../utils/NodeToMapListOrValue';
import type { VersionedBlueRepository } from '../../types/BlueRepository';

describe('Repository versioning: inlining cycles', () => {
  it('throws when inlining encounters a type chain cycle', () => {
    const typeAId = 'cycle/TypeA';
    const typeBId = 'cycle/TypeB';

    const typeADefinition = new BlueNode('TypeA').setType(
      new BlueNode().setBlueId(typeBId),
    );
    const typeBDefinition = new BlueNode('TypeB').setType(
      new BlueNode().setBlueId(typeAId),
    );

    const repository: VersionedBlueRepository = {
      name: 'repo.cycle',
      repositoryVersions: ['R0', 'R1'] as const,
      packages: {
        cycle: {
          name: 'cycle',
          aliases: {},
          typesMeta: {
            [typeAId]: {
              status: 'stable',
              name: 'TypeA',
              versions: [
                {
                  repositoryVersionIndex: 1,
                  typeBlueId: typeAId,
                  attributesAdded: [],
                },
              ],
            },
            [typeBId]: {
              status: 'stable',
              name: 'TypeB',
              versions: [
                {
                  repositoryVersionIndex: 1,
                  typeBlueId: typeBId,
                  attributesAdded: [],
                },
              ],
            },
          },
          contents: {
            [typeAId]: NodeToMapListOrValue.get(typeADefinition),
            [typeBId]: NodeToMapListOrValue.get(typeBDefinition),
          },
          schemas: {},
        },
      },
    };

    const blue = new Blue({ repositories: [repository] });
    const instance = blue.jsonValueToNode({
      type: { blueId: typeAId },
      value: 'inline-cycle',
    });

    try {
      blue.nodeToJson(instance, {
        blueContext: {
          repositories: { 'repo.cycle': 'R0' },
          fallbackToCurrentInlineDefinitions: true,
        },
      });
      throw new Error('expected inlining cycle to throw');
    } catch (err) {
      const error = err as BlueError;
      expect(error.code).toEqual(
        BlueErrorCode.REPO_UNREPRESENTABLE_IN_TARGET_VERSION,
      );
      const cycle = error.details[0]?.context?.cycle as string[] | undefined;
      expect(cycle).toEqual([typeAId, typeBId, typeAId]);
    }
  });

  it('throws when inlining encounters a property-based cycle', () => {
    const typeAId = 'cycle/PropA';
    const typeBId = 'cycle/PropB';

    const typeADefinition = new BlueNode('PropA').setProperties({
      b: new BlueNode().setType(new BlueNode().setBlueId(typeBId)),
    });
    const typeBDefinition = new BlueNode('PropB').setProperties({
      a: new BlueNode().setType(new BlueNode().setBlueId(typeAId)),
    });

    const repository: VersionedBlueRepository = {
      name: 'repo.cycle.props',
      repositoryVersions: ['R0', 'R1'] as const,
      packages: {
        cycle: {
          name: 'cycle',
          aliases: {},
          typesMeta: {
            [typeAId]: {
              status: 'stable',
              name: 'PropA',
              versions: [
                {
                  repositoryVersionIndex: 1,
                  typeBlueId: typeAId,
                  attributesAdded: [],
                },
              ],
            },
            [typeBId]: {
              status: 'stable',
              name: 'PropB',
              versions: [
                {
                  repositoryVersionIndex: 1,
                  typeBlueId: typeBId,
                  attributesAdded: [],
                },
              ],
            },
          },
          contents: {
            [typeAId]: NodeToMapListOrValue.get(typeADefinition),
            [typeBId]: NodeToMapListOrValue.get(typeBDefinition),
          },
          schemas: {},
        },
      },
    };

    const blue = new Blue({ repositories: [repository] });
    const instance = blue.jsonValueToNode({
      type: { blueId: typeAId },
    });

    try {
      blue.nodeToJson(instance, {
        blueContext: {
          repositories: { 'repo.cycle.props': 'R0' },
          fallbackToCurrentInlineDefinitions: true,
        },
      });
      throw new Error('expected inlining cycle to throw');
    } catch (err) {
      const error = err as BlueError;
      expect(error.code).toEqual(
        BlueErrorCode.REPO_UNREPRESENTABLE_IN_TARGET_VERSION,
      );
      const cycle = error.details[0]?.context?.cycle as string[] | undefined;
      expect(cycle).toEqual([typeAId, typeBId, typeAId]);
    }
  });
});
