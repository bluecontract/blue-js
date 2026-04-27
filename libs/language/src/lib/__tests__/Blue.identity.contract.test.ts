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

  it('keeps semantic BlueId stable across full and path-limited resolution', () => {
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
    const sourceBlueId = blue.calculateBlueIdSync(source);
    const limitedResolved = blue.resolve(
      source,
      PathLimits.withSinglePath('/instanceOnly'),
      { sourceSemanticBlueId: sourceBlueId },
    );

    expect(blue.calculateBlueIdSync(limitedResolved)).toBe(
      blue.calculateBlueIdSync(fullResolved),
    );
    const limitedResolvedMetadata = limitedResolved as unknown as {
      getCompleteness(): string;
      getSourceSemanticBlueId(): string | undefined;
    };
    expect(limitedResolvedMetadata.getCompleteness()).toBe('path-limited');
    expect(limitedResolvedMetadata.getSourceSemanticBlueId()).toBe(
      sourceBlueId,
    );
  });

  it('does not calculate full semantic identity during path-limited resolution', () => {
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
});

describe('Future identity API placeholders', () => {
  it.todo('phase 1 exposes Blue.minimize() without changing phase 0 runtime');
  it.todo('phase 2 exposes resolveToSnapshot() on Blue');
  it.todo('phase 2 exposes immutable snapshot patch/update APIs');
  it.todo('phase 3 implements full this#k cyclic-set BlueIds');
});
