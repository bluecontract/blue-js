import { BasicNodeProvider } from '../../provider';
import { Blue } from '../../Blue';
import { MergeReverser } from '../MergeReverser';
import { TEXT_TYPE_BLUE_ID } from '../Properties';
import { BlueIdCalculator } from '../BlueIdCalculator';
import { BlueNode } from '../../model';
import { PathLimitsBuilder } from '../limits/PathLimits';

describe('MergeReverser', () => {
  it('testBasic1', () => {
    const nodeProvider = new BasicNodeProvider();

    const a = `
      name: A
      description: Xyz
      x: 1
      y:
        type: Integer
      z:
        type: List
    `;
    nodeProvider.addSingleDocs(a);

    const b = `
      name: B
      type:
        blueId: ${nodeProvider.getBlueIdByName('A')}
      x: 1
      y: 2
      z:
        type: List
        itemType: Text
        items:
          - A
          - B
    `;
    nodeProvider.addSingleDocs(b);

    const bNode = nodeProvider.getNodeByName('B');

    const blue = new Blue({ nodeProvider });
    const resolved = blue.resolve(bNode);

    const reverser = new MergeReverser();
    const reversed = reverser.reverse(resolved);

    expect(reversed.getProperties()?.['x']).toBeUndefined();
    expect(reversed.getAsInteger('/y/value')).toEqual(2);
    expect(reversed.get('/z/type')).toBeUndefined();
    expect(reversed.get('/z/itemType/blueId')).toEqual(TEXT_TYPE_BLUE_ID);
  });

  it('testNestedTypes', () => {
    const nodeProvider = new BasicNodeProvider();

    const a = `
      name: A
      x: 5
      y: 10
    `;
    nodeProvider.addSingleDocs(a);

    const b = `
      name: B
      type:
        blueId: ${nodeProvider.getBlueIdByName('A')}
      z: 15
    `;
    nodeProvider.addSingleDocs(b);

    const c = `
      name: C
      type:
        blueId: ${nodeProvider.getBlueIdByName('B')}
      w: 20
    `;
    nodeProvider.addSingleDocs(c);

    const cNode = nodeProvider.getNodeByName('C');
    const blue = new Blue({ nodeProvider });
    const resolved = blue.resolve(cNode);

    const reverser = new MergeReverser();
    const reversed = reverser.reverse(resolved);

    expect(reversed.getName()).toEqual('C');
    expect(reversed.getType()?.getBlueId()).toEqual(
      nodeProvider.getBlueIdByName('B'),
    );
    expect(reversed.getAsInteger('/w')).toEqual(20);
    expect(reversed.getProperties()?.['x']).toBeUndefined();
    expect(reversed.getProperties()?.['y']).toBeUndefined();
    expect(reversed.getProperties()?.['z']).toBeUndefined();
  });

  it('testComplexNestedProperties', () => {
    const nodeProvider = new BasicNodeProvider();

    const m = `
      name: M
      a:
        b:
          c:
            d1: 1
    `;
    nodeProvider.addSingleDocs(m);

    const n = `
      name: N
      c:
        d2: 1
    `;
    nodeProvider.addSingleDocs(n);

    const p = `
      name: P
      type:
        blueId: ${nodeProvider.getBlueIdByName('M')}
      a:
        b:
          type:
            blueId: ${nodeProvider.getBlueIdByName('N')}
          c:
            d3: 3
    `;
    nodeProvider.addSingleDocs(p);

    const blue = new Blue({ nodeProvider });
    const nodeP = blue.yamlToNode(p);
    const blueIdP = blue.calculateBlueIdSync(nodeP);

    const resolved = blue.resolve(nodeP);

    const reverser = new MergeReverser();
    const reversed = reverser.reverse(resolved);

    expect(blue.calculateBlueIdSync(reversed)).toEqual(blueIdP);

    expect(reversed.getName()).toEqual('P');
    expect(reversed.getType()?.getBlueId()).toEqual(
      nodeProvider.getBlueIdByName('M'),
    );
    expect((reversed.get('/a/b/type') as BlueNode)?.getBlueId()).toEqual(
      nodeProvider.getBlueIdByName('N'),
    );
    expect(reversed.getAsInteger('/a/b/c/d3/value')).toEqual(3);
    const cNode = reversed.getAsNode('/a/b/c');
    expect(cNode?.getProperties()?.['d2']).toBeUndefined();
    expect(cNode?.getProperties()?.['d1']).toBeUndefined();
  });

  it('testInheritedListAndMap', () => {
    const nodeProvider = new BasicNodeProvider();
    const blue = new Blue({ nodeProvider });

    const base = `
      name: Base
      list:
        - A
        - B
      map:
        key1: value1
        key2: value2
    `;
    nodeProvider.addSingleDocs(base);

    const derived = `
      name: Derived
      type:
        blueId: ${nodeProvider.getBlueIdByName('Base')}
      list:
        - A
        - B
        - C
      map:
        key3: value3
    `;
    nodeProvider.addSingleDocs(derived);

    const derivedNode = nodeProvider.getNodeByName('Derived');
    const resolved = blue.resolve(derivedNode);

    const reverser = new MergeReverser();
    const reversed = reverser.reverse(resolved);

    expect(reversed.getName()).toEqual('Derived');
    expect(reversed.getType()?.getBlueId()).toEqual(
      nodeProvider.getBlueIdByName('Base'),
    );
    expect(reversed.getAsNode('/list')?.getItems()?.length).toEqual(2);

    const listBlueId = BlueIdCalculator.calculateBlueIdSync([
      blue.yamlToNode('value: A\ntype: Text'),
      blue.yamlToNode('value: B\ntype: Text'),
    ]);
    expect(reversed.getAsNode('/list')?.getItems()?.[0].getBlueId()).toEqual(
      listBlueId,
    );
    expect(reversed.getAsNode('/list')?.getItems()?.[1].getValue()).toEqual(
      'C',
    );
    expect(
      Object.keys(reversed.getAsNode('/map')?.getProperties() || {}).length,
    ).toEqual(1);
    expect(reversed.get('/map/key3/value')).toEqual('value3');
  });

  it('resolves reversed inherited list after official roundtrip', () => {
    const nodeProvider = new BasicNodeProvider();
    const blue = new Blue({ nodeProvider });

    const base = `
      name: Base
      list:
        - A
        - B
      map:
        key1: value1
        key2: value2
    `;
    nodeProvider.addSingleDocs(base);

    const derived = `
      name: Derived
      type:
        blueId: ${nodeProvider.getBlueIdByName('Base')}
      list:
        - A
        - B
        - C
        - D
      map:
        key3: value3
        key4: value4
    `;
    nodeProvider.addSingleDocs(derived);

    const derivedNode = nodeProvider.getNodeByName('Derived');
    const resolved = blue.resolve(derivedNode);
    const official = blue.nodeToJson(resolved, 'official');
    const loaded = blue.jsonValueToNode(official);

    const reverser = new MergeReverser();
    const reversed = reverser.reverse(loaded);
    expect(reversed.getProperties()?.list).toBeDefined();
    expect(reversed.getProperties()?.list.getItems()).toHaveLength(3);

    const resolvedAgain = blue.resolve(reversed);

    expect(blue.nodeToJson(resolvedAgain, 'official')).toEqual(official);
  });

  it('resolves reversed marker-only inherited list after official roundtrip', () => {
    const nodeProvider = new BasicNodeProvider();
    const blue = new Blue({ nodeProvider });

    const base = `
      name: Base
      list:
        - A
        - B
      map:
        key1: value1
        key2: value2
    `;
    nodeProvider.addSingleDocs(base);

    const derived = `
      name: Derived
      type:
        blueId: ${nodeProvider.getBlueIdByName('Base')}
      map:
        key3: value3
    `;
    nodeProvider.addSingleDocs(derived);

    const derivedNode = nodeProvider.getNodeByName('Derived');
    const resolved = blue.resolve(derivedNode);
    const official = blue.nodeToJson(resolved, 'official');
    const loaded = blue.jsonValueToNode(official);

    const reverser = new MergeReverser();
    const reversed = reverser.reverse(loaded);
    expect(reversed.getProperties()?.list).toBeUndefined();

    const resolvedAgain = blue.resolve(reversed);

    expect(blue.nodeToJson(resolvedAgain, 'official')).toEqual(official);
  });

  it('resolves marker-only inherited list shape', () => {
    const nodeProvider = new BasicNodeProvider();
    const blue = new Blue({ nodeProvider });

    const base = `
      name: Base
      list:
        - A
        - B
      map:
        key1: value1
        key2: value2
    `;
    nodeProvider.addSingleDocs(base);

    const baseNode = nodeProvider.getNodeByName('Base');
    const resolvedBase = blue.resolve(baseNode);
    const inheritedItemsBlueId = BlueIdCalculator.calculateBlueIdSync(
      resolvedBase.getAsNode('/list')?.getItems() || [],
    );

    const markerOnlyDerived = blue.yamlToNode(`
      name: LegacyDerived
      type:
        blueId: ${nodeProvider.getBlueIdByName('Base')}
      list:
        - blueId: ${inheritedItemsBlueId}
    `);

    const resolvedMarkerOnly = blue.resolve(markerOnlyDerived);
    expect(resolvedMarkerOnly.getAsNode('/list')?.getItems()).toHaveLength(2);
    expect(resolvedMarkerOnly.get('/list/0/value')).toEqual('A');
    expect(resolvedMarkerOnly.get('/list/1/value')).toEqual('B');
  });

  it('throws when marker-shaped inherited list item contains extra fields', () => {
    const nodeProvider = new BasicNodeProvider();
    const blue = new Blue({ nodeProvider });

    const base = `
      name: Base
      list:
        - A
        - B
    `;
    nodeProvider.addSingleDocs(base);

    const baseNode = nodeProvider.getNodeByName('Base');
    const resolvedBase = blue.resolve(baseNode);
    const inheritedItemsBlueId = BlueIdCalculator.calculateBlueIdSync(
      resolvedBase.getAsNode('/list')?.getItems() || [],
    );

    const invalidMarkerDerived = blue.yamlToNode(`
      name: Derived
      type:
        blueId: ${nodeProvider.getBlueIdByName('Base')}
      list:
        - blueId: ${inheritedItemsBlueId}
          value: should-fail
        - C
    `);

    expect(() => blue.resolve(invalidMarkerDerived)).toThrow(
      'Invalid inherited-list marker: first list item must contain only blueId.',
    );
  });

  it('keeps reverse->resolve stable with marker list under PathLimits', () => {
    const nodeProvider = new BasicNodeProvider();
    const blue = new Blue({ nodeProvider });

    const base = `
      name: Base
      list:
        - A
        - B
    `;
    nodeProvider.addSingleDocs(base);

    const derived = `
      name: Derived
      type:
        blueId: ${nodeProvider.getBlueIdByName('Base')}
      list:
        - A
        - B
        - C
        - D
    `;
    nodeProvider.addSingleDocs(derived);

    const derivedNode = nodeProvider.getNodeByName('Derived');
    const resolved = blue.resolve(derivedNode);
    const official = blue.nodeToJson(resolved, 'official');
    const loaded = blue.jsonValueToNode(official);
    const reversed = new MergeReverser().reverse(loaded);

    const limits = new PathLimitsBuilder()
      .addPath('/list/2')
      .addPath('/list/3')
      .build();

    const limitedOriginal = blue.resolve(derivedNode, limits);
    const limitedReversed = blue.resolve(reversed, limits);

    expect(blue.nodeToJson(limitedReversed, 'official')).toEqual(
      blue.nodeToJson(limitedOriginal, 'official'),
    );
  });

  it('applies PathLimits to marker-appended items using merged index', () => {
    const nodeProvider = new BasicNodeProvider();
    const blue = new Blue({ nodeProvider });

    const base = `
      name: Base
      list:
        - A
        - B
    `;
    nodeProvider.addSingleDocs(base);

    const derived = `
      name: Derived
      type:
        blueId: ${nodeProvider.getBlueIdByName('Base')}
      list:
        - A
        - B
        - C
        - D
    `;
    nodeProvider.addSingleDocs(derived);

    const derivedNode = nodeProvider.getNodeByName('Derived');
    const resolved = blue.resolve(derivedNode);
    const official = blue.nodeToJson(resolved, 'official');
    const loaded = blue.jsonValueToNode(official);
    const reversed = new MergeReverser().reverse(loaded);

    const limits = new PathLimitsBuilder()
      .addPath('/list/0')
      .addPath('/list/1')
      .addPath('/list/2')
      .build();

    const limitedOriginal = blue.resolve(derivedNode, limits);
    const limitedReversed = blue.resolve(reversed, limits);

    const limitedOriginalSimple = blue.nodeToJson(
      limitedOriginal,
      'simple',
    ) as {
      list?: unknown[];
    };
    expect(limitedOriginalSimple.list).toEqual(['A', 'B', 'C']);
    expect(blue.nodeToJson(limitedReversed, 'official')).toEqual(
      blue.nodeToJson(limitedOriginal, 'official'),
    );
  });

  it('keeps marker classification for mixed PathLimits with inherited and appended indexes', () => {
    const nodeProvider = new BasicNodeProvider();
    const blue = new Blue({ nodeProvider });

    const base = `
      name: Base
      list:
        - A
        - B
    `;
    nodeProvider.addSingleDocs(base);

    const derived = `
      name: Derived
      type:
        blueId: ${nodeProvider.getBlueIdByName('Base')}
      list:
        - A
        - B
        - C
        - D
    `;
    nodeProvider.addSingleDocs(derived);

    const derivedNode = nodeProvider.getNodeByName('Derived');
    const resolved = blue.resolve(derivedNode);
    const official = blue.nodeToJson(resolved, 'official');
    const loaded = blue.jsonValueToNode(official);
    const reversed = new MergeReverser().reverse(loaded);

    const limits = new PathLimitsBuilder()
      .addPath('/list/0')
      .addPath('/list/2')
      .build();

    const limitedOriginal = blue.resolve(derivedNode, limits);
    const limitedReversed = blue.resolve(reversed, limits);

    console.log(
      JSON.stringify(blue.nodeToJson(limitedReversed, 'official'), null, 2),
    );

    expect(blue.nodeToJson(limitedReversed, 'official')).toEqual(
      blue.nodeToJson(limitedOriginal, 'official'),
    );
  });

  it('resolves marker-appended item types before applying nested PathLimits', () => {
    const nodeProvider = new BasicNodeProvider();
    const blue = new Blue({ nodeProvider });

    const memberTemplate = `
      name: MemberTemplate
      role: member
      hidden: hidden-from-type
    `;
    nodeProvider.addSingleDocs(memberTemplate);

    const base = `
      name: Base
      list:
        - id: A
        - id: B
    `;
    nodeProvider.addSingleDocs(base);

    const derived = `
      name: Derived
      type:
        blueId: ${nodeProvider.getBlueIdByName('Base')}
      list:
        - id: A
        - id: B
        - type:
            blueId: ${nodeProvider.getBlueIdByName('MemberTemplate')}
          id: C
          localOnly: should-be-pruned
    `;
    nodeProvider.addSingleDocs(derived);

    const derivedNode = nodeProvider.getNodeByName('Derived');
    const resolved = blue.resolve(derivedNode);
    const official = blue.nodeToJson(resolved, 'official');
    const loaded = blue.jsonValueToNode(official);
    const reversed = new MergeReverser().reverse(loaded);

    const limits = new PathLimitsBuilder()
      .addPath('/list/0/id')
      .addPath('/list/1/id')
      .addPath('/list/2/role')
      .build();

    const limitedOriginal = blue.resolve(derivedNode, limits);
    const limitedReversed = blue.resolve(reversed, limits);

    expect(blue.nodeToJson(limitedReversed, 'official')).toEqual(
      blue.nodeToJson(limitedOriginal, 'official'),
    );

    const limitedReversedSimple = blue.nodeToJson(
      limitedReversed,
      'simple',
    ) as { list?: Array<Record<string, unknown>> };
    expect(limitedReversedSimple.list?.[0]).toMatchObject({ id: 'A' });
    expect(limitedReversedSimple.list?.[1]).toMatchObject({ id: 'B' });
    expect(limitedReversedSimple.list?.[2]).toMatchObject({ role: 'member' });
    expect(limitedReversedSimple.list?.[2]?.id).toBeUndefined();
    expect(limitedReversedSimple.list?.[2]?.localOnly).toBeUndefined();
  });

  it('keeps reverse->resolve stable for root items marker with appended-only PathLimits', () => {
    const nodeProvider = new BasicNodeProvider();
    const blue = new Blue({ nodeProvider });

    const base = `
      name: Base
      items:
        - A
        - B
    `;
    nodeProvider.addSingleDocs(base);

    const derived = `
      name: Derived
      type:
        blueId: ${nodeProvider.getBlueIdByName('Base')}
      items:
        - A
        - B
        - C
        - D
    `;
    nodeProvider.addSingleDocs(derived);

    const derivedNode = nodeProvider.getNodeByName('Derived');
    const resolved = blue.resolve(derivedNode);
    const official = blue.nodeToJson(resolved, 'official');
    const loaded = blue.jsonValueToNode(official);
    const reversed = new MergeReverser().reverse(loaded);

    const reversedItems = reversed.getItems() || [];
    expect(reversedItems).toHaveLength(3);
    expect(reversedItems[0].getBlueId()).toBeDefined();

    const limits = new PathLimitsBuilder().addPath('/2').addPath('/3').build();

    const limitedOriginal = blue.resolve(derivedNode, limits);
    const limitedReversed = blue.resolve(reversed, limits);

    const limitedOriginalItems = limitedOriginal.getItems() || [];
    expect(limitedOriginalItems).toHaveLength(2);
    expect(limitedOriginalItems[0].getValue()).toEqual('C');
    expect(limitedOriginalItems[1].getValue()).toEqual('D');

    expect(blue.nodeToJson(limitedReversed, 'official')).toEqual(
      blue.nodeToJson(limitedOriginal, 'official'),
    );
  });

  it('roundtrips when base list is empty and derived adds first items', () => {
    const nodeProvider = new BasicNodeProvider();
    const blue = new Blue({ nodeProvider });

    const base = `
      name: Base
      list: []
    `;
    nodeProvider.addSingleDocs(base);

    const derived = `
      name: Derived
      type:
        blueId: ${nodeProvider.getBlueIdByName('Base')}
      list:
        - C
        - D
    `;
    nodeProvider.addSingleDocs(derived);

    const derivedNode = nodeProvider.getNodeByName('Derived');
    const resolved = blue.resolve(derivedNode);
    const official = blue.nodeToJson(resolved, 'official');
    const loaded = blue.jsonValueToNode(official);
    const reversed = new MergeReverser().reverse(loaded);

    const reversedItems = reversed.getAsNode('/list')?.getItems() || [];
    expect(reversedItems).toHaveLength(2);
    expect(reversedItems[0].getBlueId()).toBeUndefined();

    const resolvedAgain = blue.resolve(reversed);
    expect(blue.nodeToJson(resolvedAgain, 'official')).toEqual(official);
  });

  it('omits explicit list override when derived list is identical to inherited', () => {
    const nodeProvider = new BasicNodeProvider();
    const blue = new Blue({ nodeProvider });

    const base = `
      name: Base
      list:
        - A
        - B
    `;
    nodeProvider.addSingleDocs(base);

    const derived = `
      name: Derived
      type:
        blueId: ${nodeProvider.getBlueIdByName('Base')}
      list:
        - A
        - B
    `;
    nodeProvider.addSingleDocs(derived);

    const derivedNode = nodeProvider.getNodeByName('Derived');
    const resolved = blue.resolve(derivedNode);
    const official = blue.nodeToJson(resolved, 'official');
    const loaded = blue.jsonValueToNode(official);
    const reversed = new MergeReverser().reverse(loaded);

    expect(reversed.getProperties()?.list).toBeUndefined();

    const resolvedAgain = blue.resolve(reversed);
    expect(blue.nodeToJson(resolvedAgain, 'official')).toEqual(official);
  });
});
