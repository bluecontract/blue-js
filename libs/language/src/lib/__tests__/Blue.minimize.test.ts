import { describe, expect, it } from 'vitest';
import { Blue } from '../Blue';
import { BasicNodeProvider } from '../provider';
import { BlueIdCalculator } from '../utils';
import { UnsupportedFeatureError } from '../utils/blueId';

describe('Blue.minimize APIs', () => {
  it('resolves -> minimizes -> resolves with equivalent snapshot', () => {
    const provider = new BasicNodeProvider();
    const blue = new Blue({ nodeProvider: provider });

    provider.addSingleDocs(`
name: BaseType
x: 10
y:
  value: inherited
`);

    const baseBlueId = provider.getBlueIdByName('BaseType');
    const authoring = blue.yamlToNode(`
name: Instance
type:
  blueId: ${baseBlueId}
y: inherited
z: 20
`);

    const resolved = blue.resolve(authoring);
    const minimized = blue.minimizeResolved(resolved);
    const resolvedFromMinimized = blue.resolve(minimized);

    expect(blue.nodeToJson(resolvedFromMinimized, 'official')).toEqual(
      blue.nodeToJson(resolved, 'official'),
    );
  });

  it('keeps BlueId stable between authoring/resolved/minimized forms', () => {
    const provider = new BasicNodeProvider();
    const blue = new Blue({ nodeProvider: provider });

    provider.addSingleDocs(`
name: Base
items:
  - A
  - B
`);

    const baseBlueId = provider.getBlueIdByName('Base');
    const authoring = blue.yamlToNode(`
name: Derived
type:
  blueId: ${baseBlueId}
items:
  - A
  - B
  - C
`);

    const resolved = blue.resolve(authoring);
    const minimized = blue.minimize(resolved);

    const authoringBlueId = BlueIdCalculator.calculateBlueIdSync(authoring);
    const resolvedBlueId = BlueIdCalculator.calculateBlueIdSync(
      resolved.clone().setBlueId(undefined),
    );
    const minimizedBlueId = BlueIdCalculator.calculateBlueIdSync(minimized);

    expect(minimizedBlueId).toEqual(authoringBlueId);
    expect(resolvedBlueId).toEqual(authoringBlueId);
  });

  it('supports resolveAndMinimize helper and reverse alias compatibility', () => {
    const provider = new BasicNodeProvider();
    const blue = new Blue({ nodeProvider: provider });

    provider.addSingleDocs(`
name: Base
value: root
`);
    const baseBlueId = provider.getBlueIdByName('Base');

    const authoring = blue.yamlToNode(`
name: Doc
type:
  blueId: ${baseBlueId}
extra: 1
`);

    const minimizedViaHelper = blue.resolveAndMinimize(authoring);
    const minimizedViaReverse = blue.reverse(blue.resolve(authoring));

    expect(blue.nodeToJson(minimizedViaHelper, 'official')).toEqual(
      blue.nodeToJson(minimizedViaReverse, 'official'),
    );
  });

  it('throws unsupported feature errors when minimizing deferred forms', () => {
    const blue = new Blue();
    const unsupported = blue.yamlToNode(`
list:
  ref:
    blueId: this#1
`);

    expect(() => blue.minimize(unsupported)).toThrow(UnsupportedFeatureError);
  });
});
