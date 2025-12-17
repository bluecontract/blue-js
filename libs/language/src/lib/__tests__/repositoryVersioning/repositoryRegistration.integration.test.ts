import { describe, expect, it } from 'vitest';
import { Blue } from '../../Blue';
import { BlueNode } from '../../model';
import { BlueIdCalculator } from '../../utils/BlueIdCalculator';
import { NodeToMapListOrValue } from '../../utils/NodeToMapListOrValue';
import { BlueError, BlueErrorCode } from '../../errors/BlueError';
import { TEXT_TYPE_BLUE_ID } from '../../utils/Properties';

describe('Repository versioning: blueContext.repositories string parsing (integration)', () => {
  const repository = buildRepository();
  const blue = new Blue({ repositories: [repository] });
  const node = blue.jsonValueToNode({
    type: { blueId: repository.packages.core.aliases['core/Value'] },
    min: {
      type: { blueId: TEXT_TYPE_BLUE_ID },
      value: 'drop',
    },
    keep: {
      type: { blueId: TEXT_TYPE_BLUE_ID },
      value: 'keep',
    },
  });

  it('accepts repository selection as map or header string', () => {
    const mapContext = {
      blueContext: {
        repositories: { 'repo.blue': repository.repositoryVersions[0] },
      },
    };
    const stringContext = {
      blueContext: {
        repositories: `'repo.blue'=${repository.repositoryVersions[0]}`,
      },
    };

    const mapJson = blue.nodeToJson(node, mapContext) as any;
    const stringJson = blue.nodeToJson(node, stringContext) as any;

    expect(mapJson).toEqual(stringJson);
    expect(mapJson.min).toBeUndefined();
    expect(mapJson.keep).toBeDefined();
  });

  it('throws for invalid repository header string', () => {
    expect(() =>
      blue.nodeToJson(node, {
        blueContext: { repositories: 'invalid-format' },
      }),
    ).toThrow(BlueError);

    try {
      blue.nodeToJson(node, {
        blueContext: { repositories: 'invalid-format' },
      });
    } catch (err) {
      expect((err as BlueError).code).toEqual(
        BlueErrorCode.INVALID_BLUE_CONTEXT_REPOSITORIES,
      );
    }
  });
});

function buildRepository() {
  const repositoryVersions = ['R0', 'R1'] as const;

  const valueV1 = new BlueNode('Value').setProperties({
    keep: new BlueNode().setType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID)),
  });
  const valueV1Id = BlueIdCalculator.calculateBlueIdSync(valueV1);
  const valueV2 = valueV1
    .clone()
    .addProperty(
      'min',
      new BlueNode().setType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID)),
    );
  const valueV2Id = BlueIdCalculator.calculateBlueIdSync(valueV2);

  const typesMeta = {
    [valueV2Id]: {
      status: 'stable' as const,
      name: 'Value',
      versions: [
        {
          repositoryVersionIndex: 0,
          typeBlueId: valueV1Id,
          attributesAdded: [],
        },
        {
          repositoryVersionIndex: 1,
          typeBlueId: valueV2Id,
          attributesAdded: ['/min'],
        },
      ],
    },
  };

  return {
    name: 'repo.blue',
    repositoryVersions,
    packages: {
      core: {
        name: 'core',
        aliases: {
          'core/Value': valueV2Id,
        },
        typesMeta,
        contents: {
          [valueV2Id]: NodeToMapListOrValue.get(valueV2),
        },
        schemas: {},
      },
    },
  };
}
