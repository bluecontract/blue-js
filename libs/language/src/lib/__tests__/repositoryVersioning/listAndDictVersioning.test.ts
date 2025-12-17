import { describe, expect, it } from 'vitest';
import { Blue } from '../../Blue';
import { BlueNode } from '../../model';
import { BlueIdCalculator } from '../../utils/BlueIdCalculator';
import { NodeToMapListOrValue } from '../../utils/NodeToMapListOrValue';
import type { VersionedBlueRepository } from '../../types/BlueRepository';
import {
  DICTIONARY_TYPE_BLUE_ID,
  LIST_TYPE_BLUE_ID,
  TEXT_TYPE_BLUE_ID,
} from '../../utils/Properties';
import {
  buildInlineRepository,
  buildTypedRepository,
  textValue,
} from './fixtures';

describe('Repository versioning: list and dictionary semantics', () => {
  it('drops valueType fields only from dictionary values and preserves siblings', () => {
    const repositoryVersions = ['R0', 'R1'] as const;

    const ruleBase = new BlueNode('Rule').setProperties({
      when: new BlueNode().setType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID)),
    });
    const ruleHistoricId = BlueIdCalculator.calculateBlueIdSync(ruleBase);

    const ruleCurrent = ruleBase
      .clone()
      .addProperty(
        'flags',
        new BlueNode().setType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID)),
      );
    const ruleCurrentId = BlueIdCalculator.calculateBlueIdSync(ruleCurrent);

    const repository: VersionedBlueRepository = {
      name: 'repo.blue',
      repositoryVersions,
      packages: {
        core: {
          name: 'core',
          aliases: { 'core/Rule': ruleCurrentId },
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
        first: {
          type: { blueId: ruleCurrentId },
          when: { type: { blueId: TEXT_TYPE_BLUE_ID }, value: 'when' },
          flags: { type: { blueId: TEXT_TYPE_BLUE_ID }, value: 'drop-me' },
          keep: { type: { blueId: TEXT_TYPE_BLUE_ID }, value: 'keep-me' },
        },
        second: {
          type: { blueId: ruleCurrentId },
          when: { type: { blueId: TEXT_TYPE_BLUE_ID }, value: 'when2' },
          flags: { type: { blueId: TEXT_TYPE_BLUE_ID }, value: 'drop-me-too' },
          keep: { type: { blueId: TEXT_TYPE_BLUE_ID }, value: 'keep-me-too' },
        },
      },
    });

    const json = blue.nodeToJson(node, {
      blueContext: { repositories: { 'repo.blue': repositoryVersions[0] } },
    }) as any;

    expect(json.map.first.flags).toBeUndefined();
    expect(json.map.second.flags).toBeUndefined();
    expect(json.map.first.keep.value).toEqual('keep-me');
    expect(json.map.second.keep.value).toEqual('keep-me-too');
  });

  describe('inline list/dictionary versioning', () => {
    it('drops fields added inside inline itemType definitions', () => {
      const repository = buildInlineRepository({
        pointer: '/listProp/itemType/prop2',
        buildContainer: (itemType) =>
          new BlueNode('InlineList').setProperties({
            listProp: new BlueNode()
              .setType(new BlueNode().setBlueId(LIST_TYPE_BLUE_ID))
              .setItemType(itemType)
              .setItems([
                new BlueNode().setProperties({
                  prop1: textValue('v1'),
                  prop2: textValue('v2'),
                }),
              ]),
          }),
      });

      const blue = new Blue({ repositories: [repository] });
      const json = blue.nodeToJson(
        blue.jsonValueToNode({
          type: { blueId: repository.packages.core.aliases['core/InlineList'] },
          listProp: {
            itemType: {},
            items: [{ prop1: { value: 'v1' }, prop2: { value: 'v2' } }],
          },
        }),
        {
          blueContext: {
            repositories: { 'repo.blue': repository.repositoryVersions[0] },
          },
        },
      ) as any;

      expect(json.listProp.itemType.prop2).toBeUndefined();
      expect(json.listProp.items[0].prop2).toBeUndefined();
      expect(json.listProp.items[0].prop1.value).toEqual('v1');
    });

    it('drops fields added inside inline valueType definitions', () => {
      const repository = buildInlineRepository({
        pointer: '/dictProp/valueType/prop2',
        buildContainer: (valueType) =>
          new BlueNode('InlineDict').setProperties({
            dictProp: new BlueNode()
              .setType(new BlueNode().setBlueId(DICTIONARY_TYPE_BLUE_ID))
              .setKeyType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID))
              .setValueType(valueType)
              .setProperties({
                first: new BlueNode().setProperties({
                  prop1: textValue('v1'),
                  prop2: textValue('v2'),
                }),
              }),
          }),
      });

      const blue = new Blue({ repositories: [repository] });
      const json = blue.nodeToJson(
        blue.jsonValueToNode({
          type: { blueId: repository.packages.core.aliases['core/InlineDict'] },
          dictProp: {
            keyType: {},
            valueType: {},
            first: { prop1: { value: 'v1' }, prop2: { value: 'v2' } },
          },
        }),
        {
          blueContext: {
            repositories: { 'repo.blue': repository.repositoryVersions[0] },
          },
        },
      ) as any;

      expect(json.dictProp.valueType.prop2).toBeUndefined();
      expect(json.dictProp.first.prop2).toBeUndefined();
      expect(json.dictProp.first.prop1.value).toEqual('v1');
    });

    it('handles nested pointers for typed list of dictionaries', () => {
      const fixture = buildTypedRepository();
      const blue = new Blue({ repositories: [fixture.repository] });

      const json = blue.nodeToJson(blue.jsonValueToNode(fixture.document), {
        blueContext: {
          repositories: {
            'repo.blue': fixture.repository.repositoryVersions[0],
          },
        },
      }) as any;

      const dict = json.listOfDicts.items[0] as any;
      expect(dict.first.metadata.flags).toBeUndefined();
      expect(dict.first.field.nested2).toBeUndefined();
      expect(dict.first.metadata.notes.value).toEqual('note');
      expect(dict.first.field.nested.value).toEqual('keep');

      expect((json.listOfDicts.itemType.valueType as any).blueId).toEqual(
        fixture.ids.ruleHistoric,
      );
      expect((json.listOfDicts.items[0].first.type as any).blueId).toEqual(
        fixture.ids.ruleHistoric,
      );
    });
  });
});
