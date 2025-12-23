import { describe, expect, it } from 'vitest';
import { Blue } from '../../Blue';
import { BlueNode } from '../../model';
import { BlueIdCalculator } from '../../utils/BlueIdCalculator';
import { NodeToMapListOrValue } from '../../utils/NodeToMapListOrValue';
import { BlueError, BlueErrorCode } from '../../errors/BlueError';
import type { BlueRepository } from '../../types/BlueRepository';
import { TEXT_TYPE_BLUE_ID } from '../../utils/Properties';

describe('Repository versioning: registration validation', () => {
  it('rejects invalid attributesAdded pointers during registration', () => {
    const coreTypes = {
      bad: {
        status: 'stable' as const,
        name: 'Bad',
        versions: [
          {
            repositoryVersionIndex: 0,
            typeBlueId: 'bad',
            attributesAdded: ['/items/0/severity'],
          },
        ],
      },
    };

    const repository: BlueRepository = {
      name: 'invalid.repo',
      repositoryVersions: ['R0'],
      packages: {
        core: {
          name: 'core',
          aliases: { 'core/Bad': 'bad' },
          typesMeta: coreTypes,
          contents: { bad: { name: 'Bad' } },
          schemas: {},
        },
      },
    };

    expect(() => new Blue({ repositories: [repository] })).toThrowError();
  });

  it('rejects attributesAdded pointers with empty segments during registration', () => {
    const coreTypes = {
      bad: {
        status: 'stable' as const,
        name: 'Bad',
        versions: [
          {
            repositoryVersionIndex: 0,
            typeBlueId: 'bad',
            attributesAdded: ['/a//b'],
          },
        ],
      },
    };

    const repository: BlueRepository = {
      name: 'invalid.repo',
      repositoryVersions: ['R0'],
      packages: {
        core: {
          name: 'core',
          aliases: { 'core/Bad': 'bad' },
          typesMeta: coreTypes,
          contents: { bad: { name: 'Bad' } },
          schemas: {},
        },
      },
    };

    expect(() => new Blue({ repositories: [repository] })).toThrowError();
  });

  it('rejects attributesAdded pointers with invalid escapes during registration', () => {
    const coreTypes = {
      bad: {
        status: 'stable' as const,
        name: 'Bad',
        versions: [
          {
            repositoryVersionIndex: 0,
            typeBlueId: 'bad',
            attributesAdded: ['/a~2b'],
          },
        ],
      },
    };

    const repository: BlueRepository = {
      name: 'invalid.repo',
      repositoryVersions: ['R0'],
      packages: {
        core: {
          name: 'core',
          aliases: { 'core/Bad': 'bad' },
          typesMeta: coreTypes,
          contents: { bad: { name: 'Bad' } },
          schemas: {},
        },
      },
    };

    expect(() => new Blue({ repositories: [repository] })).toThrowError();
  });

  it('accepts itemType/valueType as intermediate segments during registration', () => {
    const coreTypes = {
      list: {
        status: 'stable' as const,
        name: 'ListType',
        versions: [
          {
            repositoryVersionIndex: 0,
            typeBlueId: 'list',
            attributesAdded: ['/field/listProp/itemType/prop2'],
          },
        ],
      },
      dict: {
        status: 'stable' as const,
        name: 'DictType',
        versions: [
          {
            repositoryVersionIndex: 0,
            typeBlueId: 'dict',
            attributesAdded: ['/field/dictProp/valueType/prop2'],
          },
        ],
      },
    };

    const repository: BlueRepository = {
      name: 'repo.blue',
      repositoryVersions: ['R0', 'R1'],
      packages: {
        core: {
          name: 'core',
          aliases: {},
          typesMeta: coreTypes,
          contents: { list: { name: 'ListType' }, dict: { name: 'DictType' } },
          schemas: {},
        },
      },
    };

    expect(() => new Blue({ repositories: [repository] })).not.toThrow();
  });

  it('rejects pointers ending with itemType/valueType during registration', () => {
    const coreTypes = {
      list: {
        status: 'stable' as const,
        name: 'ListType',
        versions: [
          {
            repositoryVersionIndex: 0,
            typeBlueId: 'list',
            attributesAdded: ['/field/listProp/itemType'],
          },
        ],
      },
      dict: {
        status: 'stable' as const,
        name: 'DictType',
        versions: [
          {
            repositoryVersionIndex: 0,
            typeBlueId: 'dict',
            attributesAdded: ['/field/dictProp/valueType'],
          },
        ],
      },
    };

    const repository: BlueRepository = {
      name: 'repo.blue',
      repositoryVersions: ['R0', 'R1'],
      packages: {
        core: {
          name: 'core',
          aliases: {},
          typesMeta: coreTypes,
          contents: { list: { name: 'ListType' }, dict: { name: 'DictType' } },
          schemas: {},
        },
      },
    };

    expect(() => new Blue({ repositories: [repository] })).toThrowError(
      /must not end with 'itemType'|must not end with 'valueType'/,
    );
  });

  it('applies drop pointers with escaped segments', () => {
    const repositoryVersions = ['R0', 'R1'] as const;

    const textId = TEXT_TYPE_BLUE_ID;

    const escapedBase = new BlueNode('Escaped').setProperties({
      field: new BlueNode().setProperties({
        keep: new BlueNode().setType(new BlueNode().setBlueId(textId)),
      }),
    });
    const escapedHistoricId = BlueIdCalculator.calculateBlueIdSync(escapedBase);

    const escapedCurrent = escapedBase.clone().setProperties({
      field: new BlueNode().setProperties({
        'a/b': new BlueNode().setType(new BlueNode().setBlueId(textId)),
        'tilda~x': new BlueNode().setType(new BlueNode().setBlueId(textId)),
        keep: new BlueNode().setType(new BlueNode().setBlueId(textId)),
      }),
    });
    const escapedCurrentId =
      BlueIdCalculator.calculateBlueIdSync(escapedCurrent);

    const repository: BlueRepository = {
      name: 'repo.blue',
      repositoryVersions,
      packages: {
        core: {
          name: 'core',
          aliases: { 'core/Escaped': escapedCurrentId },
          typesMeta: {
            [escapedCurrentId]: {
              status: 'stable' as const,
              name: 'Escaped',
              versions: [
                {
                  repositoryVersionIndex: 0,
                  typeBlueId: escapedHistoricId,
                  attributesAdded: [],
                },
                {
                  repositoryVersionIndex: 1,
                  typeBlueId: escapedCurrentId,
                  attributesAdded: ['/field/a~1b', '/field/tilda~0x'],
                },
              ],
            },
          },
          contents: {
            [escapedCurrentId]: NodeToMapListOrValue.get(escapedCurrent),
          },
          schemas: {},
        },
      },
    };

    const blue = new Blue({ repositories: [repository] });
    const node = blue.jsonValueToNode({
      type: { blueId: escapedCurrentId },
      field: {
        'a/b': { type: { blueId: textId }, value: 'drop' },
        'tilda~x': { type: { blueId: textId }, value: 'drop2' },
        keep: { type: { blueId: textId }, value: 'keep' },
      },
    });

    const json = blue.nodeToJson(node, {
      blueContext: { repositories: { 'repo.blue': repositoryVersions[0] } },
    }) as any;

    expect(json.field['a/b']).toBeUndefined();
    expect(json.field['tilda~x']).toBeUndefined();
    expect(json.field.keep.value).toEqual('keep');
  });
});

describe('Repository versioning: blueContext.repositories string parsing', () => {
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
