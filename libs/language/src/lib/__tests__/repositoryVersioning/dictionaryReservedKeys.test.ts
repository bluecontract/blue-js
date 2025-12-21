import { describe, expect, it } from 'vitest';
import { Blue } from '../../Blue';
import { BlueNode } from '../../model';
import { BlueIdCalculator } from '../../utils/BlueIdCalculator';
import { NodeToMapListOrValue } from '../../utils/NodeToMapListOrValue';
import type { BlueRepository } from '../../types/BlueRepository';
import { TEXT_TYPE_BLUE_ID } from '../../utils/Properties';

describe('Repository versioning: dictionary reserved keys', () => {
  it('treats dictionary key named "properties" as a normal entry', () => {
    const repositoryVersions = ['R0', 'R1'] as const;

    const textId = TEXT_TYPE_BLUE_ID;
    const ruleBase = new BlueNode('Rule').setProperties({
      keep: new BlueNode().setType(new BlueNode().setBlueId(textId)),
    });
    const ruleHistoricId = BlueIdCalculator.calculateBlueIdSync(ruleBase);
    const ruleCurrent = ruleBase
      .clone()
      .addProperty(
        'flags',
        new BlueNode().setType(new BlueNode().setBlueId(textId)),
      );
    const ruleCurrentId = BlueIdCalculator.calculateBlueIdSync(ruleCurrent);

    const repository: BlueRepository = {
      name: 'repo.blue',
      repositoryVersions,
      packages: {
        core: {
          name: 'core',
          aliases: {
            'core/Rule': ruleCurrentId,
          },
          typesMeta: {
            [ruleCurrentId]: {
              status: 'stable' as const,
              name: 'Rule',
              versions: [
                {
                  repositoryVersionIndex: 0,
                  typeBlueId: ruleHistoricId,
                  attributesAdded: [],
                },
                {
                  repositoryVersionIndex: 1,
                  typeBlueId: ruleCurrentId,
                  attributesAdded: ['/flags'],
                },
              ],
            },
          },
          contents: {
            [ruleCurrentId]: NodeToMapListOrValue.get(ruleCurrent),
          },
          schemas: {},
        },
      },
    };

    const blue = new Blue({ repositories: [repository] });
    const node = blue.jsonValueToNode({
      map: {
        valueType: { blueId: ruleCurrentId },
        properties: {
          type: { blueId: ruleCurrentId },
          flags: { type: { blueId: textId }, value: 'remove' },
          keep: { type: { blueId: textId }, value: 'keep' },
        },
        normal: {
          type: { blueId: ruleCurrentId },
          flags: { type: { blueId: textId }, value: 'remove2' },
          keep: { type: { blueId: textId }, value: 'keep2' },
        },
      },
    });

    const json = blue.nodeToJson(node, {
      blueContext: { repositories: { 'repo.blue': repositoryVersions[0] } },
    }) as any;

    expect(json.map.properties.flags).toBeUndefined();
    expect(json.map.properties.keep.value).toEqual('keep');
    expect(json.map.normal.flags).toBeUndefined();
    expect(json.map.normal.keep.value).toEqual('keep2');
  });

  it('does not apply valueType drops to reserved metadata nodes', () => {
    const repositoryVersions = ['R0', 'R1'] as const;

    const textId = TEXT_TYPE_BLUE_ID;

    const valueTypeV1 = new BlueNode('ValueType').setProperties({
      keep: new BlueNode().setType(new BlueNode().setBlueId(textId)),
    });
    const valueTypeV1Id = BlueIdCalculator.calculateBlueIdSync(valueTypeV1);

    const valueTypeV2 = valueTypeV1
      .clone()
      .addProperty(
        'minFields',
        new BlueNode().setType(new BlueNode().setBlueId(textId)),
      );
    const valueTypeV2Id = BlueIdCalculator.calculateBlueIdSync(valueTypeV2);

    const repository: BlueRepository = {
      name: 'repo.blue',
      repositoryVersions,
      packages: {
        core: {
          name: 'core',
          aliases: {
            'core/ValueType': valueTypeV2Id,
          },
          typesMeta: {
            [valueTypeV2Id]: {
              status: 'stable' as const,
              name: 'ValueType',
              versions: [
                {
                  repositoryVersionIndex: 0,
                  typeBlueId: valueTypeV1Id,
                  attributesAdded: [],
                },
                {
                  repositoryVersionIndex: 1,
                  typeBlueId: valueTypeV2Id,
                  attributesAdded: ['/minFields'],
                },
              ],
            },
          },
          contents: {
            [valueTypeV2Id]: NodeToMapListOrValue.get(valueTypeV2),
          },
          schemas: {},
        },
      },
    };

    const blue = new Blue({ repositories: [repository] });

    const node = blue.jsonValueToNode({
      map: {
        valueType: { blueId: valueTypeV2Id },
        schema: { minFields: 1 },
        a: {
          type: { blueId: valueTypeV2Id },
          minFields: { type: { blueId: textId }, value: 999 },
          keep: { type: { blueId: textId }, value: 'x' },
        },
        b: {
          type: { blueId: valueTypeV2Id },
          keep: { type: { blueId: textId }, value: 'y' },
        },
      },
    });

    const json = blue.nodeToJson(node, {
      blueContext: { repositories: { 'repo.blue': repositoryVersions[0] } },
    }) as any;

    expect(json.map.a.minFields).toBeUndefined();
    expect(json.map.a.keep.value).toEqual('x');
    expect(json.map.b.keep.value).toEqual('y');
    expect(json.map.schema.minFields.value).toEqual(1);
  });
});
