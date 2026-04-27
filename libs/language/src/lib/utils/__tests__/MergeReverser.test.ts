import { BasicNodeProvider } from '../../provider';
import { Blue } from '../../Blue';
import { MergeReverser } from '../MergeReverser';
import { TEXT_TYPE_BLUE_ID } from '../Properties';
import { BlueNode } from '../../model';
import { PathLimitsBuilder } from '../limits/PathLimits';
import { BlueIdCalculator } from '../BlueIdCalculator';

describe('MergeReverser', () => {
  const expectPreviousAnchor = (item: BlueNode): string => {
    expect(item.getReferenceBlueId()).toBeUndefined();
    expect(item.getValue()).toBeUndefined();
    expect(item.getItems()).toBeUndefined();

    const properties = item.getProperties();
    expect(Object.keys(properties ?? {})).toEqual(['$previous']);

    const previous = properties?.['$previous'];
    expect(previous).toBeDefined();
    if (previous === undefined) {
      throw new Error('Expected $previous anchor');
    }

    const previousBlueId = previous.getBlueId();
    expect(previousBlueId).toEqual(expect.any(String));
    expect(previous.getValue()).toBeUndefined();
    expect(previous.getItems()).toBeUndefined();
    expect(previous.getProperties()).toBeUndefined();
    if (previousBlueId === undefined) {
      throw new Error('Expected $previous blueId');
    }
    return previousBlueId;
  };

  const expectPreviousAnchorWithStringDeltas = (
    items: BlueNode[] | undefined,
    deltaValues: string[],
  ): void => {
    expect(items).toHaveLength(deltaValues.length + 1);
    if (items === undefined) {
      throw new Error('Expected list-control items');
    }

    expectPreviousAnchor(items[0]);
    deltaValues.forEach((value, index) => {
      expect(items[index + 1].getValue()).toBe(value);
    });
  };

  const calculateResolvedItemsBlueId = (
    blue: Blue,
    nodeProvider: BasicNodeProvider,
    nodeName: string,
    path = '/list',
  ): string =>
    blue.calculateBlueIdSync(
      blue
        .resolve(nodeProvider.getNodeByName(nodeName))
        .getAsNode(path)
        ?.getItems() ?? [],
    );

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
    const reversedItems = reversed.getAsNode('/list')?.getItems() ?? [];
    expectPreviousAnchorWithStringDeltas(reversedItems, ['C']);
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
    expectPreviousAnchorWithStringDeltas(
      reversed.getProperties()?.list.getItems(),
      ['C', 'D'],
    );

    const resolvedAgain = blue.resolve(reversed);

    expect(blue.nodeToJson(resolvedAgain, 'official')).toEqual(official);
  });

  it('resolves reversed inherited-only list after official roundtrip', () => {
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

  describe('spec-native list controls', () => {
    it('keeps low-level trusted $previous hashing equivalent to full materialized lists', () => {
      const blue = new Blue({ nodeProvider: new BasicNodeProvider() });
      const full = blue.yamlToNode(`
type: List
mergePolicy: append-only
items:
  - A
  - B
  - C
`);
      const previousItems = blue
        .yamlToNode(
          `
items:
  - A
  - B
`,
        )
        .getItems();
      const previousBlueId = BlueIdCalculator.calculateBlueIdSync(
        previousItems ?? [],
      );
      const delta = blue.yamlToNode(`
type: List
mergePolicy: append-only
items:
  - $previous:
      blueId: ${previousBlueId}
  - C
`);

      expect(BlueIdCalculator.calculateBlueIdSync(delta)).toBe(
        BlueIdCalculator.calculateBlueIdSync(full),
      );
    });

    it('ignores stale $previous anchors instead of throwing or trusting them blindly', () => {
      const nodeProvider = new BasicNodeProvider();
      const blue = new Blue({ nodeProvider });

      nodeProvider.addSingleDocs(`
name: Base
list:
  type: List
  mergePolicy: positional
  items:
    - A
    - B
`);

      const stalePrefixId = BlueIdCalculator.calculateBlueIdSync(
        blue
          .yamlToNode(
            `
items:
  - X
  - Y
`,
          )
          .getItems() ?? [],
      );

      const withStalePrevious = blue.yamlToNode(`
name: Derived
type:
  blueId: ${nodeProvider.getBlueIdByName('Base')}
list:
  type: List
  mergePolicy: positional
  items:
    - $previous:
        blueId: ${stalePrefixId}
    - C
`);

      const full = blue.yamlToNode(`
name: Derived
type:
  blueId: ${nodeProvider.getBlueIdByName('Base')}
list:
  type: List
  mergePolicy: positional
  items:
    - A
    - B
    - C
`);

      expect(() => blue.resolve(withStalePrevious)).not.toThrow();
      expect(blue.calculateBlueIdSync(withStalePrevious)).toBe(
        blue.calculateBlueIdSync(full),
      );
    });

    it('does not blindly trust unverified $previous anchors in public semantic identity', () => {
      const blue = new Blue({ nodeProvider: new BasicNodeProvider() });
      const stalePrefixId = BlueIdCalculator.calculateBlueIdSync(
        blue
          .yamlToNode(
            `
items:
  - X
  - Y
`,
          )
          .getItems() ?? [],
      );
      const untrusted = blue.yamlToNode(`
type: List
mergePolicy: append-only
items:
  - $previous:
      blueId: ${stalePrefixId}
  - C
`);
      const noAnchor = blue.yamlToNode(`
type: List
mergePolicy: append-only
items:
  - C
`);

      expect(blue.calculateBlueIdSync(untrusted)).toBe(
        blue.calculateBlueIdSync(noAnchor),
      );
      expect(blue.calculateBlueIdSync(untrusted)).not.toBe(
        BlueIdCalculator.calculateBlueIdSync(untrusted),
      );
    });

    it('resolves positional $pos overlays and appends in final order', () => {
      const nodeProvider = new BasicNodeProvider();
      const blue = new Blue({ nodeProvider });

      nodeProvider.addSingleDocs(`
name: Base
list:
  type: List
  mergePolicy: positional
  items:
    - A
    - $empty: true
    - C
`);

      const derived = blue.yamlToNode(`
name: Derived
type:
  blueId: ${nodeProvider.getBlueIdByName('Base')}
list:
  type: List
  mergePolicy: positional
  items:
    - $previous:
        blueId: ${calculateResolvedItemsBlueId(blue, nodeProvider, 'Base')}
    - $pos: 1
      value: B
    - D
`);

      const resolved = blue.resolve(derived);
      expect(blue.nodeToJson(resolved.getAsNode('/list')!, 'simple')).toEqual([
        'A',
        'B',
        'C',
        'D',
      ]);
    });

    it('rejects malformed list controls', () => {
      const blue = new Blue({ nodeProvider: new BasicNodeProvider() });
      const misplacedPrevious = blue.yamlToNode(`
items:
  - A
  - $previous:
      blueId: Prev
`);
      const outOfRangePosition = blue.yamlToNode(`
type: List
items:
  - $pos: 0
    value: A
`);
      const nonIntegerPosition = blue.yamlToNode(`
type: List
items:
  - $pos: 0.5
    value: A
`);

      expect(() => blue.calculateBlueIdSync(misplacedPrevious)).toThrow(
        '$previous list control is allowed only as the first item.',
      );
      expect(() => blue.resolve(outOfRangePosition)).toThrow(
        '$pos 0 is out of range',
      );
      expect(() => blue.resolve(nonIntegerPosition)).toThrow(
        '$pos must be a non-negative integer value.',
      );
    });

    it('rejects duplicate positional list overlays', () => {
      const nodeProvider = new BasicNodeProvider();
      const blue = new Blue({ nodeProvider });

      nodeProvider.addSingleDocs(`
name: Base
list:
  type: List
  items:
    - A
`);

      const derived = blue.yamlToNode(`
name: Derived
type:
  blueId: ${nodeProvider.getBlueIdByName('Base')}
list:
  type: List
  items:
    - $previous:
        blueId: ${calculateResolvedItemsBlueId(blue, nodeProvider, 'Base')}
    - $pos: 0
      value: B
    - $pos: 0
      value: C
`);

      expect(() => blue.resolve(derived)).toThrow(
        'Duplicate $pos list overlay for index 0.',
      );
    });

    it('rejects $pos for append-only lists', () => {
      const nodeProvider = new BasicNodeProvider();
      const blue = new Blue({ nodeProvider });

      nodeProvider.addSingleDocs(`
name: Base
list:
  type: List
  mergePolicy: append-only
  items:
    - A
`);

      const derived = blue.yamlToNode(`
name: Derived
type:
  blueId: ${nodeProvider.getBlueIdByName('Base')}
list:
  type: List
  mergePolicy: append-only
  items:
    - $previous:
        blueId: ${calculateResolvedItemsBlueId(blue, nodeProvider, 'Base')}
    - $pos: 0
      value: B
`);

      expect(() => blue.resolve(derived)).toThrow(
        '$pos is not allowed in append-only lists.',
      );
    });

    it('$empty remains identity content', () => {
      const blue = new Blue({ nodeProvider: new BasicNodeProvider() });

      expect(
        blue.calculateBlueIdSync(
          blue.yamlToNode(`
items:
  - A
  - $empty: true
  - B
`),
        ),
      ).not.toBe(
        blue.calculateBlueIdSync(
          blue.yamlToNode(`
items:
  - A
  - B
`),
        ),
      );
    });

    it('rejects malformed $empty list content', () => {
      const blue = new Blue({ nodeProvider: new BasicNodeProvider() });

      expect(() =>
        blue.calculateBlueIdSync(
          blue.yamlToNode(`
type: List
items:
  - $empty: false
`),
        ),
      ).toThrow(/\$empty/i);

      expect(() =>
        blue.calculateBlueIdSync(
          blue.yamlToNode(`
type: List
items:
  - $empty: true
    x: 1
`),
        ),
      ).toThrow(/\$empty/i);
    });

    it('emits semantic $previous id for inherited lists with typed items', () => {
      const nodeProvider = new BasicNodeProvider();
      const blue = new Blue({ nodeProvider });

      nodeProvider.addSingleDocs(`
name: RowType
kind: default
`);

      const rowTypeId = nodeProvider.getBlueIdByName('RowType');

      nodeProvider.addSingleDocs(`
name: Base
rows:
  type: List
  mergePolicy: append-only
  items:
    - type:
        blueId: ${rowTypeId}
      id: A
`);

      const derived = blue.yamlToNode(`
name: Derived
type:
  blueId: ${nodeProvider.getBlueIdByName('Base')}
rows:
  type: List
  mergePolicy: append-only
  items:
    - type:
        blueId: ${rowTypeId}
      id: A
    - type:
        blueId: ${rowTypeId}
      id: B
`);

      const resolved = blue.resolve(derived);
      const minimal = blue.minimize(resolved);
      const previousBlueId = minimal
        .getAsNode('/rows')
        ?.getItems()?.[0]
        ?.getProperties()
        ?.['$previous']?.getBlueId();
      const baseRowsItems = blue
        .resolve(nodeProvider.getNodeByName('Base'))
        .getAsNode('/rows')
        ?.getItems();

      expect(blue.calculateBlueIdSync(minimal)).toBe(
        blue.calculateBlueIdSync(resolved),
      );
      expect(previousBlueId).toBe(
        blue.calculateBlueIdSync(baseRowsItems ?? []),
      );
      expect(previousBlueId).not.toBe(
        BlueIdCalculator.calculateBlueIdSync(baseRowsItems ?? []),
      );
    });
  });

  it('keeps $previous append overlay stable under PathLimits', () => {
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

  it('applies $pos overlays under PathLimits using final merged indexes', () => {
    const nodeProvider = new BasicNodeProvider();
    const blue = new Blue({ nodeProvider });

    nodeProvider.addSingleDocs(`
name: Base
list:
  type: List
  mergePolicy: positional
  items:
    - A
    - B
    - C
`);

    const derived = blue.yamlToNode(`
name: Derived
type:
  blueId: ${nodeProvider.getBlueIdByName('Base')}
list:
  type: List
  mergePolicy: positional
  items:
    - $pos: 1
      value: B2
    - D
`);

    const full = blue.resolve(derived);
    const sourceSemanticBlueId = blue.calculateBlueIdSync(derived);
    const limits = new PathLimitsBuilder().addPath('/list/1').build();
    const limited = blue.resolve(derived, limits, { sourceSemanticBlueId });
    const reLimited = blue.resolve(blue.minimize(full), limits, {
      sourceSemanticBlueId,
    });

    expect(blue.nodeToJson(limited.getAsNode('/list')!, 'simple')).toEqual([
      'B2',
    ]);
    expect(blue.nodeToJson(limited, 'official')).toEqual(
      blue.nodeToJson(reLimited, 'official'),
    );
  });

  it('keeps multi-level $previous append overlay stable under appended-only PathLimits', () => {
    const nodeProvider = new BasicNodeProvider();
    const blue = new Blue({ nodeProvider });

    const base = `
      name: Base
      list:
        - A
        - B
    `;
    nodeProvider.addSingleDocs(base);

    const mid = `
      name: Mid
      type:
        blueId: ${nodeProvider.getBlueIdByName('Base')}
      list:
        - A
        - B
        - C
    `;
    nodeProvider.addSingleDocs(mid);

    const derived = `
      name: Derived
      type:
        blueId: ${nodeProvider.getBlueIdByName('Mid')}
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

    const limits = new PathLimitsBuilder().addPath('/list/3').build();

    const limitedOriginal = blue.resolve(derivedNode, limits);
    const limitedReversed = blue.resolve(reversed, limits);

    expect(blue.nodeToJson(limitedReversed, 'official')).toEqual(
      blue.nodeToJson(limitedOriginal, 'official'),
    );

    const limitedSimple = blue.nodeToJson(limitedReversed, 'simple') as {
      list?: unknown[];
    };
    expect(limitedSimple.list).toEqual(['D']);
  });

  it('applies PathLimits to appended items using merged index', () => {
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

  it('keeps $previous append overlay stable for mixed PathLimits with inherited and appended indexes', () => {
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

    expect(blue.nodeToJson(limitedReversed, 'official')).toEqual(
      blue.nodeToJson(limitedOriginal, 'official'),
    );
  });

  it('resolves appended item types before applying nested PathLimits', () => {
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

  it('keeps root $previous append overlay stable with appended-only PathLimits', () => {
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
    expectPreviousAnchorWithStringDeltas(reversedItems, ['C', 'D']);

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
