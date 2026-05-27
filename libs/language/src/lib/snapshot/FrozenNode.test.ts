import { describe, expect, it } from 'vitest';

import { yamlBlueParse } from '../../utils/yamlBlue';
import { Blue } from '../Blue';
import { BlueNode } from '../model/Node';
import { NodeDeserializer } from '../model/NodeDeserializer';
import { BlueIdCalculator } from '../utils/BlueIdCalculator';
import { NodeToBlueIdInput } from '../utils/NodeToBlueIdInput';
import { DOUBLE_TYPE_BLUE_ID } from '../utils/Properties';
import { FrozenNode } from './FrozenNode';
import { FrozenNodeToBlueIdInput } from './FrozenNodeToBlueIdInput';

const blue = new Blue();

describe('FrozenNode', () => {
  it('matches mutable BlueId calculation for objects, scalars, and references', () => {
    const referenceBlueId = BlueIdCalculator.calculateBlueIdSync(
      new BlueNode().setValue('reference'),
    );
    const node = rawYaml(`
name: Product
count: 1
nested:
  label: abc
ref:
  blueId: ${referenceBlueId}
`);

    const frozen = FrozenNode.fromNode(node);

    expect(frozen.blueId()).toBe(BlueIdCalculator.calculateBlueIdSync(node));
    expect(
      FrozenNode.fromNode(new BlueNode().setBlueId(referenceBlueId)).blueId(),
    ).toBe(referenceBlueId);
  });

  it('produces the same BlueId input as mutable nodes for canonical shapes', () => {
    const previousBlueId = BlueIdCalculator.calculateBlueIdSync(
      new BlueNode().setItems([]),
    );
    const referenceBlueId = BlueIdCalculator.calculateBlueIdSync(
      new BlueNode().setValue('reference'),
    );

    const nodes = [
      new BlueNode().setValue('text'),
      rawYaml(`
items:
  - value: A
  - $empty: true
  - value: B
`),
      rawYaml(`
items:
  - $previous:
      blueId: ${previousBlueId}
  - value: A
`),
      new BlueNode().setBlueId(referenceBlueId),
      rawYaml(`
value: abc
contracts:
  audit:
    value: true
`),
    ];

    for (const node of nodes) {
      expect(
        FrozenNodeToBlueIdInput.toBlueIdInput(FrozenNode.fromNode(node)),
      ).toEqual(NodeToBlueIdInput.get(node));
    }
  });

  it('caches repeated BlueId reads', () => {
    const frozen = FrozenNode.fromNode(rawYaml('a: b'));
    const first = frozen.blueId();

    for (let index = 0; index < 10; index += 1) {
      expect(frozen.blueId()).toBe(first);
    }
  });

  it('drops empty object properties in strict canonical mode', () => {
    const node = rawYaml(`
a: 1
empty: {}
nested:
  empty: {}
  label: ok
`);

    const frozen = FrozenNode.fromNode(node);

    expect(frozen.blueId()).toBe(BlueIdCalculator.calculateBlueIdSync(node));
    expect(frozen.property('empty')).toBeUndefined();
    expect(frozen.property('nested')?.property('empty')).toBeUndefined();
    expect(BlueIdCalculator.calculateBlueIdSync(frozen.toNode())).toBe(
      frozen.blueId(),
    );
  });

  it('rejects direct empty objects inside lists but accepts normalized source lists', () => {
    expect(() =>
      FrozenNode.fromNode(
        rawYaml(`
items:
  - {}
`),
      ),
    ).toThrow();

    const normalized = blue.yamlToNode(`
items:
  - {}
`);
    expect(FrozenNode.fromNode(normalized).blueId()).toBe(
      BlueIdCalculator.calculateBlueIdSync(normalized),
    );
  });

  it('validates list control nodes like the Java snapshot implementation', () => {
    const previousBlueId = BlueIdCalculator.calculateBlueIdSync(
      new BlueNode().setItems([]),
    );
    const previous = rawYaml(`
items:
  - $previous:
      blueId: ${previousBlueId}
  - value: A
`);
    const positioned = rawYaml(`
items:
  - $pos: 0
    value: A
`);
    const previousNotFirst = rawYaml(`
items:
  - value: A
  - $previous:
      blueId: ${previousBlueId}
`);

    expect(FrozenNode.fromNode(previous).blueId()).toBe(
      BlueIdCalculator.calculateBlueIdSync(previous),
    );
    expect(() => FrozenNode.fromNode(positioned)).toThrow();
    expect(() => FrozenNode.fromNode(previousNotFirst)).toThrow();
    expect(() =>
      FrozenNode.fromNode(new BlueNode().setPreviousBlueId(previousBlueId)),
    ).toThrow();
  });

  it('allows contracts alongside scalar and list payloads', () => {
    const scalar = rawYaml(`
value: abc
contracts:
  audit:
    value: enabled
`);
    const list = rawYaml(`
items:
  - abc
contracts:
  audit:
    value: enabled
`);

    expect(FrozenNode.fromNode(scalar).blueId()).toBe(
      BlueIdCalculator.calculateBlueIdSync(scalar),
    );
    expect(FrozenNode.fromNode(list).blueId()).toBe(
      BlueIdCalculator.calculateBlueIdSync(list),
    );
    expect(() =>
      FrozenNode.fromNode(
        new BlueNode().setValue('abc').setProperties({
          contracts: new BlueNode().setProperties({
            audit: new BlueNode().setValue('enabled'),
          }),
          child: new BlueNode().setValue('not allowed'),
        }),
      ),
    ).toThrow();
  });

  it('exposes immutable child views and returns fresh mutable node copies', () => {
    const frozen = FrozenNode.fromNode(
      rawYaml(`
a: 1
list:
  items:
    - x
`),
    );

    expect(() => {
      (frozen.getProperties() as Record<string, FrozenNode>).b =
        FrozenNode.empty();
    }).toThrow(TypeError);
    expect(() => {
      (frozen.property('list')?.getItems() as FrozenNode[]).push(
        FrozenNode.empty(),
      );
    }).toThrow(TypeError);

    const first = frozen.toNode();
    const second = frozen.toNode();
    first.addProperty('mutated', new BlueNode().setValue(true));

    expect(first).not.toBe(second);
    expect(BlueIdCalculator.calculateBlueIdSync(second)).toBe(frozen.blueId());
  });

  it('resolves object and list JSON pointers without materializing the tree', () => {
    const frozen = FrozenNode.fromNode(
      rawYaml(`
profile:
  label: Ana
rows:
  - id: a
  - id: b
`),
    );

    expect(frozen.at('/profile/label')).toBe(
      frozen.property('profile')?.property('label'),
    );
    expect(frozen.at('/rows/1/id')).toBe(
      frozen.property('rows')?.item(1)?.property('id'),
    );
    expect(frozen.pathIndex().get('/rows/1/id')).toBe(frozen.at('/rows/1/id'));
    expect(frozen.at('/rows/nope')).toBeUndefined();
    expect(frozen.at('/rows/9')).toBeUndefined();
  });

  it('uses JSON pointer escaping in path indexes', () => {
    const frozen = FrozenNode.fromNode(
      rawYaml(`
"a/b": slash
"a~b": tilde
nested:
  "x/y": value
`),
    );

    expect(frozen.at('/a~1b')?.getValue()).toBe('slash');
    expect(frozen.at('/a~0b')?.getValue()).toBe('tilde');
    expect(frozen.at('/nested/x~1y')?.getValue()).toBe('value');
    expect(frozen.pathIndex().get('/a~1b')).toBe(frozen.property('a/b'));
    expect(frozen.pathIndex().get('/a~0b')).toBe(frozen.property('a~b'));
    expect(frozen.pathIndex().get('/nested/x~1y')).toBe(
      frozen.property('nested')?.property('x/y'),
    );
  });

  it('calculates list BlueIds from frozen nodes', () => {
    const one = FrozenNode.fromNode(new BlueNode().setValue('one'));
    const two = FrozenNode.fromNode(new BlueNode().setValue('two'));

    expect(FrozenNode.calculateBlueId([one, two])).toBe(
      BlueIdCalculator.calculateBlueIdSync([one.toNode(), two.toNode()]),
    );
    expect(FrozenNode.calculateBlueId([])).toBe(
      BlueIdCalculator.calculateBlueIdSync([]),
    );
  });

  it('rejects invalid canonical payload shapes', () => {
    expect(() =>
      FrozenNode.fromNode(
        new BlueNode().setValue('x').setProperties({
          y: new BlueNode().setValue(1),
        }),
      ),
    ).toThrow();
    expect(() =>
      FrozenNode.fromNode(
        new BlueNode().setBlueId('ref').setProperties({
          y: new BlueNode().setValue(1),
        }),
      ),
    ).toThrow();
    expect(() => FrozenNode.fromNode(new BlueNode().setPosition(1))).toThrow();
  });

  it('rejects blue directives in strict canonical mode', () => {
    expect(() =>
      FrozenNode.fromNode(
        rawYaml(`
blue:
  items: []
value: hello
`),
      ),
    ).toThrow();
  });

  it('allows resolved BlueId metadata in resolved mode', () => {
    const resolvedLike = new BlueNode()
      .setBlueId('ReferenceMetadata')
      .setName('Expanded node');

    const resolved = FrozenNode.fromResolvedNode(resolvedLike);

    expect(resolved.blueId()).toBe(
      BlueIdCalculator.calculateBlueIdWithResolvedBlueIdMetadataSync(
        resolvedLike,
      ),
    );
    expect(() =>
      BlueIdCalculator.calculateBlueIdSync(resolved.toNode()),
    ).toThrow();
    expect(() => FrozenNode.fromNode(resolvedLike)).toThrow();
  });

  it('matches mutable BlueId calculation for typed double canonicalization', () => {
    const node = rawYaml(`
type:
  blueId: ${DOUBLE_TYPE_BLUE_ID}
value: 0.33333333333333333333333333333333333333
`);

    expect(FrozenNode.fromNode(node).blueId()).toBe(
      BlueIdCalculator.calculateBlueIdSync(node),
    );
  });
});

function rawYaml(source: string): BlueNode {
  const parsed = yamlBlueParse(source);
  if (parsed === undefined) {
    throw new Error('Failed to parse test YAML');
  }
  return NodeDeserializer.deserialize(parsed);
}
