import { describe, expect, it } from 'vitest';
import { createBlueInstance, ids } from './fixtures';

describe('Repository versioning: alias resolution', () => {
  it('resolves <package>/<Type> aliases during preprocessing', () => {
    const blue = createBlueInstance();
    const yaml = `
type: myos/Policy
owner:
  type: Text
  value: owner-1
rules:
  - type: myos/Rule
    when: { value: 'when-1' }
    then: { value: 'then-1' }
`;
    const node = blue.yamlToNode(yaml);
    const rule = node.getProperties()?.rules?.getItems()?.[0];

    expect(node.getType()?.getBlueId()).toEqual(ids.policyCurrent);
    expect(rule?.getType()?.getBlueId()).toEqual(ids.ruleCurrent);
  });

  it('resolves aliases in itemType/valueType/keyType references', () => {
    const blue = createBlueInstance();
    const yaml = `
type: myos/Policy
owner:
  type: Text
  value: owner-1
valueDict:
  keyType: Text
  valueType: myos/Rule
  first:
    type: myos/Rule
    when: { value: 'when-1' }
    then: { value: 'then-1' }
listRules:
  itemType:
    type: myos/Rule
  items:
    - type: myos/Rule
      when: { value: 'lw' }
      then: { value: 'lt' }
`;
    const node = blue.yamlToNode(yaml);
    const valueDict = node.getProperties()?.valueDict;
    const listRules = node.getProperties()?.listRules;

    expect(valueDict?.getValueType()?.getBlueId()).toEqual(ids.ruleCurrent);
    expect(valueDict?.getKeyType()?.getBlueId()).toEqual(ids.text);
    expect(valueDict?.getProperties()?.first?.getType()?.getBlueId()).toEqual(
      ids.ruleCurrent,
    );
    expect(listRules?.getItemType()?.getType()?.getBlueId()).toEqual(
      ids.ruleCurrent,
    );
    expect(listRules?.getItems()?.[0]?.getType()?.getBlueId()).toEqual(
      ids.ruleCurrent,
    );
  });
});
