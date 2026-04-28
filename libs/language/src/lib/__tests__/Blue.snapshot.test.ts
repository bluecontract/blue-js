import { describe, expect, it } from 'vitest';
import { Blue } from '../Blue';
import { BlueNode } from '../model';
import { ResolvedBlueNode } from '../model/ResolvedNode';
import { BasicNodeProvider } from '../provider/BasicNodeProvider';
import { FrozenNode } from '../snapshot';

function asJson(blue: Blue, node: BlueNode): unknown {
  return blue.nodeToJson(node, 'official');
}

describe('Blue.resolveToSnapshot', () => {
  it('returns an immutable resolved root matching resolve()', () => {
    const provider = new BasicNodeProvider();
    provider.addSingleDocs(`
name: SnapshotBase
inherited: base
`);
    const baseId = provider.getBlueIdByName('SnapshotBase');
    const blue = new Blue({ nodeProvider: provider });
    const input = blue.yamlToNode(`
name: SnapshotChild
type:
  blueId: ${baseId}
local: child
`);

    const resolved = blue.resolve(input);
    const snapshot = blue.resolveToSnapshot(input);

    expect(snapshot.resolvedRoot).toBeInstanceOf(FrozenNode);
    expect(snapshot.toResolvedNode()).toBeInstanceOf(ResolvedBlueNode);
    expect(asJson(blue, snapshot.toResolvedNode())).toEqual(
      asJson(blue, resolved),
    );
  });

  it('is isolated from later mutations of source and resolved nodes', () => {
    const blue = new Blue({ nodeProvider: new BasicNodeProvider() });
    const source = blue.yamlToNode(`
order:
  status: created
`);
    const resolved = blue.resolve(source);
    const snapshot = blue.resolveToSnapshot(resolved);
    const originalBlueId = snapshot.blueId;

    source.addProperty('sourceMutation', new BlueNode().setValue('changed'));
    const order = resolved.get('/order');
    if (!(order instanceof BlueNode)) {
      throw new Error('Expected /order to resolve to a BlueNode.');
    }
    order.getProperties()?.status?.setValue('updated');

    expect(snapshot.toResolvedNode().get('/order/status')).toBe('created');
    expect(snapshot.toResolvedNode().get('/sourceMutation')).toBeUndefined();
    expect(snapshot.blueId).toBe(originalBlueId);
  });

  it('caches minimal overlay and exposes the same semantic BlueId', () => {
    const provider = new BasicNodeProvider();
    provider.addSingleDocs(`
name: SnapshotBase
inherited: base
`);
    const baseId = provider.getBlueIdByName('SnapshotBase');
    const blue = new Blue({ nodeProvider: provider });
    const input = blue.yamlToNode(`
name: SnapshotChild
type:
  blueId: ${baseId}
local: child
`);
    const resolved = blue.resolve(input);
    const snapshot = blue.resolveToSnapshot(input);
    const minimalFromSnapshot = snapshot.toMinimal();

    expect(snapshot.toMinimal()).toBe(minimalFromSnapshot);
    expect(asJson(blue, minimalFromSnapshot.toMutableNode())).toEqual(
      asJson(blue, blue.minimize(resolved)),
    );
    expect(asJson(blue, blue.minimize(snapshot))).toEqual(
      asJson(blue, minimalFromSnapshot.toMutableNode()),
    );
    expect(snapshot.blueId).toBe(blue.calculateBlueIdSync(input));
    expect(snapshot.blueId).toBe(blue.calculateBlueIdSync(resolved));
  });

  it('freezes exposed node arrays and property maps', () => {
    const blue = new Blue({ nodeProvider: new BasicNodeProvider() });
    const snapshot = blue.resolveToSnapshot(
      blue.yamlToNode(`
entries:
  - one
details:
  status: open
`),
    );

    const rootProperties = snapshot.resolvedRoot.getProperties();
    const entries = rootProperties?.entries;
    const entriesItems = entries?.getItems();

    expect(Object.isFrozen(snapshot.resolvedRoot)).toBe(true);
    expect(rootProperties).toBeDefined();
    expect(Object.isFrozen(rootProperties)).toBe(true);
    expect(entriesItems).toBeDefined();
    expect(Object.isFrozen(entriesItems)).toBe(true);
  });
});
