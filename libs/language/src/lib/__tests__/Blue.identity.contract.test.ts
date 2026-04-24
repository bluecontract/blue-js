import { describe, expect, it } from 'vitest';
import { Blue } from '../Blue';
import { BasicNodeProvider } from '../provider';
import { PathLimits } from '../utils/limits';
import {
  getIdentityFixture,
  IdentityFixture,
  identityFixtures,
} from '../__fixtures__/identity/identityFixtures';

const describeContract =
  process.env.BLUE_SPEC_CONTRACT_RED === '1' ? describe : describe.skip;

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

    expect(blueIdForFixture(blue, 'pureRef')).toBe(referenceId);
    expect(blueIdForFixture(blue, 'mixedBlueIdPayload')).not.toBe(referenceId);
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
    const limitedResolved = blue.resolve(
      source,
      PathLimits.withSinglePath('/instanceOnly'),
    );

    expect(blue.calculateBlueIdSync(limitedResolved)).toBe(
      blue.calculateBlueIdSync(fullResolved),
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
});

describe('Future identity API placeholders', () => {
  it.todo('phase 1 exposes Blue.minimize() without changing phase 0 runtime');
  it.todo('phase 2 exposes resolveToSnapshot() on Blue');
  it.todo('phase 2 exposes immutable snapshot patch/update APIs');
  it.todo('phase 3 implements full this#k cyclic-set BlueIds');
});
