import { describe, expect, it } from 'vitest';
import { Blue } from '../../Blue';
import { BlueNode } from '../../model';
import { BlueIdCalculator } from '../../utils/BlueIdCalculator';
import { NodeToMapListOrValue } from '../../utils/NodeToMapListOrValue';
import type { VersionedBlueRepository } from '../../types/BlueRepository';
import { TEXT_TYPE_BLUE_ID } from '../../utils/Properties';
import { parsePointer as parseRepositoryPointer } from '@blue-labs/repository-contract';

describe('Repository versioning: pointer parsing and validation', () => {
  it('parses escaped segments (~0, ~1)', () => {
    expect(parseRepositoryPointer('/field/a~1b')).toEqual(['field', 'a/b']);
    expect(parseRepositoryPointer('/field/tilda~0x')).toEqual([
      'field',
      'tilda~x',
    ]);
  });

  it('rejects empty segments', () => {
    expect(() => parseRepositoryPointer('/a//b')).toThrow();
  });

  it('rejects invalid escape sequences', () => {
    expect(() => parseRepositoryPointer('/a~2b')).toThrow();
    expect(() => parseRepositoryPointer('/a~')).toThrow();
    expect(() => parseRepositoryPointer('/a~x')).toThrow();
  });

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

    const repository: VersionedBlueRepository = {
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

    const repository: VersionedBlueRepository = {
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

    const repository: VersionedBlueRepository = {
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

    const repository: VersionedBlueRepository = {
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

    const repository: VersionedBlueRepository = {
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

    const repository: VersionedBlueRepository = {
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
