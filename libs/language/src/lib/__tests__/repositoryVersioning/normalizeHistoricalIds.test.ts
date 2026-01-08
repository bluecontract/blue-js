import { describe, expect, it } from 'vitest';
import { BlueNode } from '../../model';
import { RepositoryRegistry } from '../../repository/RepositoryRuntime';
import { normalizeNodeBlueIds } from '../../utils/repositoryVersioning/normalizeNodeBlueIds';
import {
  createBlueInstance,
  fixtureSchemas,
  ids,
  otherRepository,
  repoBlue,
} from './fixtures';

describe('Repository versioning: historical id normalization', () => {
  it('normalizes historical BlueIds in jsonValueToNode', () => {
    const blue = createBlueInstance();
    const node = blue.jsonValueToNode({
      type: { blueId: ids.ruleHistoric },
      when: { value: 'a' },
      then: { value: 'b' },
    });

    expect(node.getType()?.getBlueId()).toEqual(ids.ruleCurrent);
  });

  it('normalizes historical BlueIds in itemType and valueType', () => {
    const blue = createBlueInstance();
    const node = blue.jsonValueToNode({
      type: { blueId: ids.policyCurrent },
      untypedRules: {
        itemType: { blueId: ids.ruleHistoric },
        items: [
          {
            when: { value: 'w1' },
            then: { value: 't1' },
          },
        ],
      },
      untypedMap: {
        valueType: { blueId: ids.ruleHistoric },
        first: {
          when: { value: 'wf' },
          then: { value: 'tf' },
        },
      },
    });

    expect(
      node.getProperties()?.untypedRules?.getItemType()?.getBlueId(),
    ).toEqual(ids.ruleCurrent);
    expect(
      node.getProperties()?.untypedMap?.getValueType()?.getBlueId(),
    ).toEqual(ids.ruleCurrent);
  });

  it('resolves schema after normalizing historical BlueId', () => {
    const blue = createBlueInstance();
    const ruleNode = new BlueNode()
      .setType(new BlueNode().setBlueId(ids.ruleHistoric))
      .setProperties({
        when: new BlueNode().setValue('when'),
        then: new BlueNode().setValue('then'),
      });

    const registry = new RepositoryRegistry([repoBlue, otherRepository]);
    const normalizedRuleNode = normalizeNodeBlueIds(ruleNode, registry);
    const output = blue.nodeToSchemaOutput(
      normalizedRuleNode,
      fixtureSchemas.ruleSchemaCurrent,
    );

    expect(output.when).toEqual('when');
    expect(output.then).toEqual('then');
  });
});
