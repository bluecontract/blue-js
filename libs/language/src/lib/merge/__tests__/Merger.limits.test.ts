import { Merger } from '../Merger';
import { MergingProcessor } from '../MergingProcessor';
import { BlueNode, NodeDeserializer, BigIntegerNumber } from '../../model';
import { PathLimitsBuilder } from '../../utils/limits/PathLimits';
import { yamlBlueParse } from '../../../utils';
import { BasicNodeProvider } from '../../provider';

describe('Merger with Limits', () => {
  let nodeProvider: BasicNodeProvider;
  let merger: Merger;
  let mergingProcessor: MergingProcessor;

  beforeEach(() => {
    // Simple merging processor that just copies values
    mergingProcessor = {
      process: (target: BlueNode, source: BlueNode) => {
        let newTarget = target;
        const value = source.getValue();
        if (value !== undefined) {
          newTarget = newTarget.clone().setValue(value);
        }
        return newTarget;
      },
    };

    nodeProvider = new BasicNodeProvider();

    nodeProvider.addSingleDocs(`
name: BaseType
x: 1
y:
  z: 2
  nested:
    baseExtra: baseAdditional
    value: base`);

    nodeProvider.addSingleDocs(`
name: DerivedType
type:
  blueId: ${nodeProvider.getBlueIdByName('BaseType')}
x: 10
y:
  z: 20
  nested:
    value: derived
    extra: additional`);

    nodeProvider.addSingleDocs(`
name: ComplexType
items:
  - name: Item1
    value: 1
  - name: Item2
    value: 2
properties:
  a:
    type:
      blueId: ${nodeProvider.getBlueIdByName('BaseType')}
    x: 100
  b:
    name: PropB
    data: test`);

    merger = new Merger(mergingProcessor, nodeProvider);
  });

  test('should handle type extension with limits', async () => {
    const derivedNode = nodeProvider.findNodeByName('DerivedType');

    if (!derivedNode) {
      throw new Error('Derived node not found');
    }

    // Only allow merging specific paths from the type
    const limits = new PathLimitsBuilder()
      .addPath('/x')
      .addPath('/y/nested')
      .build();

    const result = merger.resolve(derivedNode, limits);

    // Should have the derived value for x
    expect(await result.get('/x')).toStrictEqual(new BigIntegerNumber(10));

    // Should have the nested structure but only what's allowed
    expect(await result.get('/y/nested/value')).toBe('derived');
    expect(await result.get('/y/nested/extra')).toBeUndefined();
    expect(await result.get('/y/nested/baseExtra')).toBeUndefined();

    // Should NOT have y/z even though it's in both base and derived
    expect(await result.get('/y/z')).toBeUndefined();
  });

  test('should respect path limits when merging properties', async () => {
    const source = yamlBlueParse(`
name: TestNode
a:
  value: 1
b:
  value: 2
c:
  value: 3`);

    const sourceNode = NodeDeserializer.deserialize(source!);

    // Only allow merging of properties 'a' and 'c'
    const limits = new PathLimitsBuilder().addPath('/a').addPath('/c').build();

    const result = merger.resolve(sourceNode, limits);

    expect(result.getName()).toBe('TestNode');
    expect(await result.get('/a/value')).toStrictEqual(new BigIntegerNumber(1));
    expect(await result.get('/b')).toBeUndefined(); // Should not be merged
    expect(await result.get('/c/value')).toStrictEqual(new BigIntegerNumber(3));
  });

  test('should respect nested path limits', async () => {
    const source = yamlBlueParse(`
name: NestedTest
level1:
  level2a:
    value: a
  level2b:
    value: b
    level3:
      deep: deepLevel3`);

    const sourceNode = NodeDeserializer.deserialize(source!);

    // Only allow merging specific nested paths
    const limits = new PathLimitsBuilder().addPath('/level1/level2b').build();

    const result = merger.resolve(sourceNode, limits);

    expect(await result.get('/level1')).toBeDefined();
    expect(await result.get('/level1/level2a')).toBeUndefined();
    expect(await result.get('/level1/level2b')).toBeDefined();
    // Note: When we allow a deep path, all properties along that path are merged
    expect(await result.get('/level1/level2b/value')).toBe('b');
    expect(await result.get('/level1/level2b/level3/deep')).toBeUndefined();
  });

  test('should respect limits when merging arrays', async () => {
    const source = yamlBlueParse(`
name: ArrayTest
items:
  - name: Item0
    value: 0
  - name: Item1
    value: 1
  - name: Item2
    value: 2`);

    const sourceNode = NodeDeserializer.deserialize(source!);

    // Only allow merging of specific array indices
    const limits = new PathLimitsBuilder().addPath('/0').addPath('/2').build();

    const result = merger.resolve(sourceNode, limits);

    const items = result.getItems();
    expect(items).toBeDefined();
    expect(items?.length).toBe(2); // Only items at indices 0 and 2
    expect(items?.[0].getName()).toBe('Item0');
    expect(items?.[1].getName()).toBe('Item2'); // Item2 shifted to index 1
  });

  test('should handle wildcard paths in limits', async () => {
    const source = yamlBlueParse(`
name: WildcardTest
prop1:
  nested:
    value: 1
prop2:
  nested:
    value: 2
prop3:
  other:
    value: 3`);

    const sourceNode = NodeDeserializer.deserialize(source!);

    // Use wildcard to allow all properties but only specific nested paths
    const limits = new PathLimitsBuilder().addPath('/*/nested').build();

    const result = merger.resolve(sourceNode, limits);

    expect(await result.get('/prop1/nested/value')).toStrictEqual(
      new BigIntegerNumber(1)
    );
    expect(await result.get('/prop2/nested/value')).toStrictEqual(
      new BigIntegerNumber(2)
    );
    expect(await result.get('/prop3')).toBeDefined(); // prop3 exists but is empty
    expect(await result.get('/prop3/other')).toBeUndefined(); // 'other' was not merged
  });

  // TODO: Probably we have to discuss about max depth limits
  test.skip('should respect max depth limits', async () => {
    const source = yamlBlueParse(`
name: DeepStructure
level1:
  level2:
    level3:
      level4:
        level5:
          value: deep`);

    const sourceNode = NodeDeserializer.deserialize(source!);

    // Set max depth to 3
    const limits = new PathLimitsBuilder()
      .setMaxDepth(3)
      .addPath('/*/*')
      .build();

    const result = merger.resolve(sourceNode, limits);

    expect(await result.get('/level1')).toBeDefined();
    expect(await result.get('/level1/level2')).toBeDefined();
    expect(await result.get('/level1/level2/level3')).toBeUndefined();
    // level4 and deeper should not be merged due to max depth
    expect(await result.get('/level1/level2/level3/level4')).toBeUndefined();
  });
});
