import { describe, expect, it, vi } from 'vitest';
import { Blue } from '../Blue';
import { BlueNode } from '../model';
import { ResolvedBlueNode } from '../model/ResolvedNode';
import { BasicNodeProvider } from '../provider/BasicNodeProvider';
import { FrozenNode, ResolvedSnapshot } from '../snapshot';
import { SnapshotPathIndex } from '../snapshot/SnapshotPathIndex';

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

  it('looks up immutable nodes by JSON pointer', () => {
    const blue = new Blue({ nodeProvider: new BasicNodeProvider() });
    const snapshot = blue.resolveToSnapshot(
      blue.yamlToNode(`
name: SnapshotLookupRoot
entries:
  - one
  - two
details:
  status: open
`),
    );
    const entries = snapshot.resolvedRoot.getProperties()?.entries;
    const firstEntry = entries?.getItems()?.[0];

    expect(snapshot.getNode('')).toBe(snapshot.resolvedRoot);
    expect(snapshot.getNode('/')).toBe(snapshot.resolvedRoot);
    expect(snapshot.getNode('/entries')).toBe(entries);
    expect(snapshot.getNode('/entries/0')).toBe(firstEntry);
    expect(snapshot.hasNode('/entries/0')).toBe(true);
    expect(snapshot.getPointer(firstEntry as FrozenNode)).toBe('/entries/0');
    expect(snapshot.getNode('/entries/0')).toBe(snapshot.getNode('/entries/0'));
  });

  it('resolves escaped property names in snapshot pointers', () => {
    const blue = new Blue({ nodeProvider: new BasicNodeProvider() });
    const snapshot = blue.resolveToSnapshot(
      blue.yamlToNode(`
"a/b": slash
"tilde~x": tilde
`),
    );

    expect(snapshot.getNode('/a~1b')?.getValue()).toBe('slash');
    expect(snapshot.getNode('/tilde~0x')?.getValue()).toBe('tilde');
    expect(snapshot.getPointer(snapshot.getNode('/a~1b') as FrozenNode)).toBe(
      '/a~1b',
    );
  });

  it('returns undefined for missing paths and scalar virtual fields', () => {
    const blue = new Blue({ nodeProvider: new BasicNodeProvider() });
    const snapshot = blue.resolveToSnapshot(
      blue.yamlToNode(`
name: SnapshotLookupRoot
entries:
  - one
`),
    );

    expect(snapshot.getNode('entries')).toBeUndefined();
    expect(snapshot.getNode('/missing')).toBeUndefined();
    expect(snapshot.getNode('/entries/-')).toBeUndefined();
    expect(snapshot.getNode('/entries/999')).toBeUndefined();
    expect(snapshot.getNode('/entries/not-an-index')).toBeUndefined();
    expect(snapshot.getNode('/tilde~x')).toBeUndefined();
    expect(snapshot.getNode('/name')).toBeUndefined();
    expect(snapshot.getNode('/description')).toBeUndefined();
    expect(snapshot.getNode('/blueId')).toBeUndefined();
    expect(snapshot.getNode('/entries/0/value')).toBeUndefined();
    expect(snapshot.hasNode('/missing')).toBe(false);
  });

  it('indexes structural node fields without exposing scalar fields', () => {
    const blue = new Blue({ nodeProvider: new BasicNodeProvider() });
    const snapshot = blue.resolveToSnapshot(
      blue.yamlToNode(`
typed:
  type: Text
  value: hello
entries:
  itemType: Text
  items:
    - one
`),
    );

    expect(snapshot.getNode('/typed/type')).toBeDefined();
    expect(snapshot.getNode('/typed/value')).toBeUndefined();
    expect(snapshot.getNode('/entries/itemType')).toBeDefined();
  });

  it('indexes all structural node fields and lets user properties own colliding segments', () => {
    const snapshot = ResolvedSnapshot.fromResolvedNode(
      new ResolvedBlueNode(
        new BlueNode()
          .setType(new BlueNode().setValue('StructuralType'))
          .setItemType(new BlueNode().setValue('StructuralItemType'))
          .setKeyType(new BlueNode().setValue('StructuralKeyType'))
          .setValueType(new BlueNode().setValue('StructuralValueType'))
          .setBlue(
            new BlueNode().setProperties({
              marker: new BlueNode().setValue('blue metadata'),
            }),
          )
          .setProperties({
            type: new BlueNode().setValue('user type property'),
            value: new BlueNode().setValue('user value property'),
          }),
      ),
    );

    expect(snapshot.getNode('/type')?.getValue()).toBe('user type property');
    expect(snapshot.getNode('/value')?.getValue()).toBe('user value property');
    expect(snapshot.getNode('/itemType')).toBeDefined();
    expect(snapshot.getNode('/keyType')).toBeDefined();
    expect(snapshot.getNode('/valueType')).toBeDefined();
    expect(snapshot.getNode('/blue/marker')?.getValue()).toBe('blue metadata');
  });

  it('builds the path index lazily once without mutating the snapshot', () => {
    const fromRootSpy = vi.spyOn(SnapshotPathIndex, 'fromRoot');

    try {
      const blue = new Blue({ nodeProvider: new BasicNodeProvider() });
      const snapshot = blue.resolveToSnapshot(
        blue.yamlToNode(`
entries:
  - one
`),
      );
      const propertiesBefore = snapshot.resolvedRoot.getProperties();
      const entriesItemsBefore = propertiesBefore?.entries?.getItems();

      expect(fromRootSpy).not.toHaveBeenCalled();

      expect(snapshot.getNode('/entries')).toBeDefined();
      expect(snapshot.hasNode('/entries/0')).toBe(true);
      expect(
        snapshot.getPointer(snapshot.getNode('/entries/0') as FrozenNode),
      ).toBe('/entries/0');

      expect(fromRootSpy).toHaveBeenCalledTimes(1);
      expect(snapshot.resolvedRoot.getProperties()).toBe(propertiesBefore);
      expect(snapshot.resolvedRoot.getProperties()?.entries?.getItems()).toBe(
        entriesItemsBefore,
      );
    } finally {
      fromRootSpy.mockRestore();
    }
  });
});
