import { describe, expect, it } from 'vitest';
import { Blue } from '../Blue';
import { BlueNode, NodeDeserializer } from '../model';
import { BasicNodeProvider } from '../provider';
import { BlueIdCalculator } from '../utils';
import { NO_LIMITS, PathLimits } from '../utils/limits';
import { yamlBlueParse } from '../../utils/yamlBlue';
import {
  getIdentityFixture,
  IdentityFixture,
  identityFixtures,
} from '../__fixtures__/identity/identityFixtures';

const describeContract = describe;

const nodeFromFixture = (blue: Blue, fixture: IdentityFixture) => {
  if (fixture.input.kind === 'yaml') {
    return blue.yamlToNode(fixture.input.value);
  }

  return blue.jsonValueToNode(fixture.input.value);
};

const blueIdForFixture = (blue: Blue, name: keyof typeof identityFixtures) =>
  blue.calculateBlueIdSync(nodeFromFixture(blue, getIdentityFixture(name)));

describeContract('Blue identity specification contracts', () => {
  it('treats scalar authoring sugar and wrapped scalar form as one semantic BlueId', () => {
    const blue = new Blue();

    expect(blueIdForFixture(blue, 'scalarSugar')).toBe(
      blueIdForFixture(blue, 'scalarWrapped'),
    );
  });

  it('treats list authoring sugar and wrapped list form as one semantic BlueId', () => {
    const blue = new Blue();

    expect(blueIdForFixture(blue, 'listSugar')).toBe(
      blueIdForFixture(blue, 'listWrapped'),
    );
  });

  it('short-circuits only exact pure references', () => {
    const blue = new Blue();
    const referenceId = 'IdentityFixtureReferenceBlueId';
    const mixedFixture = getIdentityFixture('mixedBlueIdPayload');
    if (mixedFixture.input.kind !== 'yaml') {
      throw new Error('mixedBlueIdPayload fixture must be YAML');
    }
    const mixedNode = NodeDeserializer.deserialize(
      yamlBlueParse(mixedFixture.input.value),
    );

    expect(blueIdForFixture(blue, 'pureRef')).toBe(referenceId);
    expect(BlueIdCalculator.calculateBlueIdSync(mixedNode)).not.toBe(
      referenceId,
    );
  });

  it('preserves a present-empty list as identity content distinct from absent', () => {
    const blue = new Blue();

    expect(blueIdForFixture(blue, 'presentEmptyList')).not.toBe(
      blueIdForFixture(blue, 'absentList'),
    );
  });

  it('keeps singleton lists distinct from their only element', () => {
    const blue = new Blue();

    expect(blue.calculateBlueIdSync(['A'])).not.toBe(
      blue.calculateBlueIdSync('A'),
    );
  });

  it('does not flatten nested list identity', () => {
    const blue = new Blue();

    expect(blue.calculateBlueIdSync([['A', 'B'], 'C'])).not.toBe(
      blue.calculateBlueIdSync(['A', 'B', 'C']),
    );
  });

  it('keeps top-level arrays and pure items wrappers equivalent', () => {
    const blue = new Blue();
    const wrapped = new BlueNode().setItems([
      blue.jsonValueToNode('A'),
      blue.jsonValueToNode('B'),
    ]);

    expect(blue.calculateBlueIdSync(['A', 'B'])).toBe(
      blue.calculateBlueIdSync(wrapped),
    );
  });

  it('anchors path-limited identity for valid root pure references', () => {
    const blue = new Blue();
    const sourceBlueId = blue.calculateBlueIdSync({
      name: 'Referenced Source',
      value: 'source',
    });
    const source = new BlueNode().setReferenceBlueId(sourceBlueId);

    const limitedResolved = blue.resolve(
      source,
      PathLimits.withSinglePath('/value'),
    );

    expect(limitedResolved.getCompleteness()).toBe('path-limited');
    expect(limitedResolved.getSourceSemanticBlueId()).toBe(sourceBlueId);
    expect(blue.calculateBlueIdSync(limitedResolved)).toBe(sourceBlueId);
  });

  it('anchors path-limited identity for final cyclic document BlueIds', () => {
    const blue = new Blue();
    const masterBlueId = blue.calculateBlueIdSync(
      yamlBlueParse(`- name: A
  peer:
    blueId: this#1
- name: B
  peer:
    blueId: this#0
`)!,
    );
    const documentBlueId = `${masterBlueId}#1`;
    const source = new BlueNode().setReferenceBlueId(documentBlueId);

    const limitedResolved = blue.resolve(
      source,
      PathLimits.withSinglePath('/peer'),
    );

    expect(limitedResolved.getSourceSemanticBlueId()).toBe(documentBlueId);
    expect(blue.calculateBlueIdSync(limitedResolved)).toBe(documentBlueId);
  });

  it('does not anchor path-limited authoring nodes', () => {
    const provider = new BasicNodeProvider();
    provider.addSingleDocs(`
name: Identity Fixture Base Type
baseOnly: base
nested:
  inherited: true
`);
    const baseTypeId = provider.getBlueIdByName('Identity Fixture Base Type');
    const blue = new Blue({ nodeProvider: provider });
    const source = blue.yamlToNode(`
name: Identity Fixture Child
type:
  blueId: ${baseTypeId}
instanceOnly: child
nested:
  local: true
`);

    const fullResolved = blue.resolve(source);
    const limitedResolved = blue.resolve(
      source,
      PathLimits.withSinglePath('/instanceOnly'),
    );

    expect(blue.calculateBlueIdSync(fullResolved)).toBe(
      blue.calculateBlueIdSync(source),
    );
    expect(limitedResolved.getCompleteness()).toBe('path-limited');
    expect(limitedResolved.getSourceSemanticBlueId()).toBeUndefined();
    expect(() => blue.calculateBlueIdSync(limitedResolved)).toThrow(
      /path-limited resolved node without a source semantic BlueId/,
    );
  });

  it('rejects path-limited identity without a source anchor', () => {
    const blue = new Blue();
    const source = blue.yamlToNode(`
allowed: ok
offPath:
  type:
    blueId: MissingOffPathTypeBlueId
`);

    const limitedResolved = blue.resolve(
      source,
      PathLimits.withSinglePath('/allowed'),
    );

    expect(limitedResolved.get('/allowed/value')).toBe('ok');
    expect(limitedResolved.getSourceSemanticBlueId()).toBeUndefined();
    expect(() => blue.calculateBlueIdSync(limitedResolved)).toThrow(
      /path-limited resolved node without a source semantic BlueId/,
    );
  });

  it('does not treat symbolic root references as source anchors', () => {
    const blue = new Blue();
    const source = new BlueNode().setReferenceBlueId('SymbolicType');

    const limitedResolved = blue.resolve(
      source,
      PathLimits.withSinglePath('/anything'),
    );

    expect(limitedResolved.getSourceSemanticBlueId()).toBeUndefined();
    expect(() => blue.calculateBlueIdSync(limitedResolved)).toThrow(
      /path-limited resolved node without a source semantic BlueId/,
    );
  });

  it('rejects mixed blueId plus payload in storage or authoring ingest', () => {
    const provider = new BasicNodeProvider();
    const fixture = getIdentityFixture('mixedBlueIdPayload');
    if (fixture.input.kind !== 'yaml') {
      throw new Error('mixedBlueIdPayload fixture must be YAML');
    }
    const yaml = fixture.input.value;

    expect(() => provider.addSingleDocs(yaml)).toThrow(/ambiguous blueId/i);
  });

  it('stores provider content under the same semantic BlueId as the public API', () => {
    const provider = new BasicNodeProvider();

    provider.addSingleDocs(`
name: Base
x: 1
y: 2
`);

    const baseId = provider.getBlueIdByName('Base');
    const blue = new Blue({ nodeProvider: provider });
    const child = blue.yamlToNode(`
name: Child
type:
  blueId: ${baseId}
x: 1
z: 3
`);

    const publicId = blue.calculateBlueIdSync(child);

    provider.addSingleNodes(child);
    const providerId = provider.getBlueIdByName('Child');
    const fetched = provider.fetchByBlueId(providerId);

    expect(providerId).toBe(publicId);
    expect(fetched).toHaveLength(1);
    expect(fetched?.[0].getProperties()?.x).toBeUndefined();
    expect(blue.calculateBlueIdSync(blue.resolve(fetched![0]))).toBe(publicId);
  });

  it('does not bypass semantic storage for ordinary lists whose first item is a pure reference', () => {
    const provider = new BasicNodeProvider();

    provider.addSingleDocs(`
name: ReferencedItem
value: item
`);

    provider.addSingleDocs(`
name: Base
x: 1
`);

    const itemId = provider.getBlueIdByName('ReferencedItem');
    const baseId = provider.getBlueIdByName('Base');
    const blue = new Blue({ nodeProvider: provider });

    const child = blue.yamlToNode(`
name: Child
type:
  blueId: ${baseId}
x: 1
list:
  items:
    - blueId: ${itemId}
    - second
`);

    const publicId = blue.calculateBlueIdSync(child);

    provider.addSingleNodes(child);
    const providerId = provider.getBlueIdByName('Child');

    expect(providerId).toBe(publicId);
  });

  it('rejects this and this#k references in provider storage ingest until phase 3', () => {
    const provider = new BasicNodeProvider();

    expect(() =>
      provider.addSingleDocs(`
name: SingleThis
self:
  blueId: this
`),
    ).toThrow(/Self-references using this or this#k are not supported/);

    expect(() =>
      provider.addSingleDocs(`
name: IndexedThis
self:
  blueId: this#1
`),
    ).toThrow(/Self-references using this or this#k are not supported/);
  });

  it('keeps semantic BlueId stable after NodeExtender expansion', () => {
    const provider = new BasicNodeProvider();

    provider.addSingleDocs(`
name: Base
x: 1
`);

    const baseId = provider.getBlueIdByName('Base');
    const blue = new Blue({ nodeProvider: provider });
    const ref = new BlueNode().setReferenceBlueId(baseId);

    expect(blue.calculateBlueIdSync(ref)).toBe(baseId);

    blue.extend(ref, NO_LIMITS);

    expect(ref.getName()).toBe('Base');
    expect(ref.getReferenceBlueId()).toBeUndefined();
    expect(blue.calculateBlueIdSync(ref)).toBe(baseId);
  });

  it('emits $previous for inherited list append without legacy pure-ref marker', () => {
    const provider = new BasicNodeProvider();
    const blue = new Blue({ nodeProvider: provider });

    provider.addSingleDocs(`
name: Base
list:
  - A
  - B
`);

    const derived = blue.yamlToNode(`
name: Derived
type:
  blueId: ${provider.getBlueIdByName('Base')}
list:
  - A
  - B
  - C
`);

    const minimal = blue.minimize(blue.resolve(derived));
    const items = minimal.getAsNode('/list')?.getItems();
    const previousAnchor = items?.[0];
    const previousAnchorProperties = previousAnchor?.getProperties();
    const previousReference = previousAnchorProperties?.['$previous'];

    expect(items).toHaveLength(2);
    expect(previousAnchor?.getReferenceBlueId()).toBeUndefined();
    expect(previousAnchor?.getValue()).toBeUndefined();
    expect(previousAnchor?.getItems()).toBeUndefined();
    expect(Object.keys(previousAnchorProperties ?? {})).toEqual(['$previous']);
    expect(previousReference?.getBlueId()).toEqual(expect.any(String));
    expect(previousReference?.getValue()).toBeUndefined();
    expect(previousReference?.getItems()).toBeUndefined();
    expect(previousReference?.getProperties()).toBeUndefined();
    expect(items?.[1].getValue()).toBe('C');
  });

  it('does not collapse untrusted blueId plus payload during minimization', () => {
    const blue = new Blue();
    const untrustedRuntimeNode = NodeDeserializer.deserialize({
      blueId: 'UntrustedReferenceBlueId',
      local: 'must-stay',
    });

    const minimal = blue.minimize(untrustedRuntimeNode);

    expect(minimal.getBlueId()).toBe('UntrustedReferenceBlueId');
    expect(minimal.get('/local/value')).toBe('must-stay');
  });

  it('preserves root name and description when they match the type', () => {
    const provider = new BasicNodeProvider();

    provider.addSingleDocs(`
name: Person
description: Shared description
age:
  type: Integer
`);

    const personTypeBlueId = provider.getBlueIdByName('Person');
    const blue = new Blue({ nodeProvider: provider });
    const instance = blue.yamlToNode(`
name: Person
description: Shared description
type:
  blueId: ${personTypeBlueId}
age: 30
`);

    const minimal = blue.minimize(blue.resolve(instance));

    expect(minimal.getName()).toBe('Person');
    expect(minimal.getDescription()).toBe('Shared description');
  });

  it('keeps async and sync semantic BlueId validation equivalent', async () => {
    const blue = new Blue();
    const mixed = blue.yamlToNode(`
blueId: SomeId
x: 1
`);

    expect(() => blue.calculateBlueIdSync(mixed)).toThrow(/ambiguous blueId/i);
    await expect(blue.calculateBlueId(mixed)).rejects.toThrow(
      /ambiguous blueId/i,
    );
  });

  it('keeps async and sync semantic BlueIds equivalent for list controls', async () => {
    const provider = new BasicNodeProvider();
    const blue = new Blue({ nodeProvider: provider });

    provider.addSingleDocs(`
name: Base
list:
  type: List
  mergePolicy: positional
  items:
    - A
    - B
`);

    const baseId = provider.getBlueIdByName('Base');
    const positional = blue.yamlToNode(`
name: Positional
type:
  blueId: ${baseId}
list:
  type: List
  mergePolicy: positional
  items:
    - $pos: 1
      value: B2
`);

    const stalePrevious = blue.yamlToNode(`
name: StalePrevious
type:
  blueId: ${baseId}
list:
  type: List
  mergePolicy: positional
  items:
    - $previous:
        blueId: StalePrefixBlueId
    - C
`);

    const inherited = blue.yamlToNode(`
name: Inherited
type:
  blueId: ${baseId}
list:
  type: List
  mergePolicy: positional
  items:
    - A
    - B
    - C
`);
    const inheritedResolved = blue.resolve(inherited);
    const inheritedMinimal = blue.minimize(inheritedResolved);

    for (const node of [
      positional,
      stalePrevious,
      inheritedResolved,
      inheritedMinimal,
    ]) {
      expect(await blue.calculateBlueId(node)).toBe(
        blue.calculateBlueIdSync(node),
      );
    }
  });

  it('does not trust top-level array $previous in public semantic identity', () => {
    const blue = new Blue({ nodeProvider: new BasicNodeProvider() });
    const fakePrefixId = blue.calculateBlueIdSync(['X', 'Y']);
    const untrusted = [{ $previous: { blueId: fakePrefixId } }, 'C'];

    expect(blue.calculateBlueIdSync(untrusted)).toBe(
      blue.calculateBlueIdSync(['C']),
    );
  });

  it('does not trust top-level BlueNode[] $previous in public semantic identity', () => {
    const blue = new Blue({ nodeProvider: new BasicNodeProvider() });
    const fakePrefixId = blue.calculateBlueIdSync(['X', 'Y']);
    const previous = blue.jsonValueToNode({
      $previous: { blueId: fakePrefixId },
    });
    const c = blue.jsonValueToNode('C');

    expect(blue.calculateBlueIdSync([previous, c])).toBe(
      blue.calculateBlueIdSync(['C']),
    );
  });

  it('rejects malformed $empty in top-level array public semantic identity', () => {
    const blue = new Blue({ nodeProvider: new BasicNodeProvider() });

    expect(() => blue.calculateBlueIdSync([{ $empty: false }])).toThrow(
      /\$empty/i,
    );

    expect(() =>
      blue.calculateBlueIdSync([{ $empty: true, value: 'extra' }]),
    ).toThrow(/\$empty/i);
  });

  it('rejects top-level array $pos before raw BlueId hashing', () => {
    const blue = new Blue({ nodeProvider: new BasicNodeProvider() });

    expect(() => blue.calculateBlueIdSync([{ $pos: 0, value: 'A' }])).toThrow(
      '$pos 0 is out of range for inherited list length 0.',
    );
  });

  it('keeps async and sync semantic BlueIds equivalent for top-level array list controls', async () => {
    const blue = new Blue({ nodeProvider: new BasicNodeProvider() });
    const fakePrefixId = blue.calculateBlueIdSync(['X', 'Y']);
    const input = [{ $previous: { blueId: fakePrefixId } }, 'C'];

    expect(await blue.calculateBlueId(input)).toBe(
      blue.calculateBlueIdSync(input),
    );
  });

  it('calculates stable MASTER for direct cyclic this#k document sets', () => {
    const blue = new Blue();
    const firstOrder = yamlBlueParse(`
- name: Person
  pet:
    type:
      blueId: this#1
- name: Dog
  owner:
    type:
      blueId: this#0
`);
    const secondOrder = yamlBlueParse(`
- name: Dog
  owner:
    type:
      blueId: this#1
- name: Person
  pet:
    type:
      blueId: this#0
`);

    const masterBlueId = blue.calculateBlueIdSync(firstOrder!);

    expect(masterBlueId).toMatch(/^[1-9A-HJ-NP-Za-km-z]{43,45}$/);
    expect(blue.calculateBlueIdSync(secondOrder!)).toBe(masterBlueId);
  });
});

describe('Future identity API placeholders', () => {
  it.todo('phase 1 exposes Blue.minimize() without changing phase 0 runtime');
  it.todo('phase 2 exposes resolveToSnapshot() on Blue');
  it.todo('phase 2 exposes immutable snapshot patch/update APIs');
});
