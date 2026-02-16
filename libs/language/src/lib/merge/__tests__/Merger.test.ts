import { describe, it, expect, vi } from 'vitest';
import { Merger } from '../Merger';
import { MergingProcessor } from '../MergingProcessor';
import { BlueNode } from '../../model';
import { ResolvedBlueNode } from '../../model/ResolvedNode';
import { createNodeProvider } from '../../NodeProvider';
import { NO_LIMITS, PathLimitsBuilder } from '../../utils/limits';
import { BasicNodeProvider } from '../../provider';
import { createDefaultMergingProcessor } from '../utils/default';
import { Blue } from '../../Blue';

describe('Merger', () => {
  const basicMergingProcessor = (target: BlueNode, source: BlueNode) => {
    if (source.getValue() !== undefined) {
      return target.clone().setValue(source.getValue()!);
    }
    return target;
  };

  it('should create a Merger instance', () => {
    const mockProcessor: MergingProcessor = {
      process: vi.fn(),
    };
    const mockProvider = createNodeProvider(() => []);

    const merger = new Merger(mockProcessor, mockProvider);
    expect(merger).toBeInstanceOf(Merger);
  });

  it('should resolve a simple node', () => {
    const processFn = vi.fn(basicMergingProcessor);
    const mockProcessor: MergingProcessor = {
      process: processFn,
    };
    const mockProvider = createNodeProvider(() => []);

    const merger = new Merger(mockProcessor, mockProvider);
    const sourceNode = new BlueNode('TestNode')
      .setDescription('A test node')
      .setValue('test value');

    const resolved = merger.resolve(sourceNode, NO_LIMITS);

    expect(resolved.getName()).toBe('TestNode');
    expect(resolved.getDescription()).toBe('A test node');
    expect(resolved.getValue()).toBe('test value');
    expect(processFn).toHaveBeenCalled();
  });

  it('should throw error if source has blue attribute', () => {
    const mockProcessor: MergingProcessor = {
      process: vi.fn(),
    };
    const mockProvider = createNodeProvider(() => []);

    const merger = new Merger(mockProcessor, mockProvider);
    const target = new BlueNode();
    const source = new BlueNode().setBlue(new BlueNode());

    expect(() => merger.merge(target, source, NO_LIMITS)).toThrow(
      'Document contains "blue" attribute. Preprocess document before merging.',
    );
  });

  it('should not mutate merge target when processor mutates target in place', () => {
    const mutatingProcessor: MergingProcessor = {
      process: vi.fn((target: BlueNode, source: BlueNode) => {
        const sourceValue = source.getValue();
        if (sourceValue !== undefined) {
          target.setValue(sourceValue);
        }
        return target;
      }),
    };
    const mockProvider = createNodeProvider(() => []);
    const merger = new Merger(mutatingProcessor, mockProvider);

    const target = new BlueNode().setValue('target-value');
    const source = new BlueNode().setValue('source-value');

    const merged = merger.merge(target, source, NO_LIMITS);

    expect(target.getValue()).toBe('target-value');
    expect(merged.getValue()).toBe('source-value');
    expect(merged).not.toBe(target);
  });

  it('should merge properties', () => {
    const mockProcessor: MergingProcessor = {
      process: vi.fn(basicMergingProcessor),
    };
    const mockProvider = createNodeProvider(() => []);

    const merger = new Merger(mockProcessor, mockProvider);
    const sourceNode = new BlueNode('TestNode').setProperties({
      prop1: new BlueNode().setValue('value1'),
      prop2: new BlueNode().setValue('value2'),
    });

    const resolved = merger.resolve(sourceNode, NO_LIMITS);

    expect(resolved.getProperties()).toBeDefined();
    expect(resolved.getProperties()?.prop1?.getValue()).toBe('value1');
    expect(resolved.getProperties()?.prop2?.getValue()).toBe('value2');
  });

  it('should clone already resolved children when limits are not restrictive', () => {
    const mockProcessor: MergingProcessor = {
      process: vi.fn(basicMergingProcessor),
    };
    const mockProvider = createNodeProvider(() => []);
    const merger = new Merger(mockProcessor, mockProvider);

    const resolvedChild = new ResolvedBlueNode(
      new BlueNode().setValue('resolved-child'),
    );
    const source = new BlueNode().setItems([resolvedChild]);

    const merged = merger.merge(new BlueNode(), source, NO_LIMITS);
    const mergedChild = merged.getItems()?.[0];

    expect(mergedChild).not.toBe(resolvedChild);
    expect(mergedChild?.isResolved()).toBe(true);
    expect(mergedChild?.getValue()).toBe('resolved-child');

    mergedChild?.setValue('changed');
    expect(resolvedChild.getValue()).toBe('resolved-child');
  });

  it('should re-resolve already resolved children when path limits are used', () => {
    const mockProcessor: MergingProcessor = {
      process: vi.fn(basicMergingProcessor),
    };
    const mockProvider = createNodeProvider(() => []);
    const merger = new Merger(mockProcessor, mockProvider);

    const resolvedChild = new ResolvedBlueNode(
      new BlueNode().setProperties({
        allowed: new BlueNode().setValue('allowed'),
        blocked: new BlueNode().setValue('blocked'),
      }),
    );
    const source = new BlueNode().setItems([resolvedChild]);
    const limits = new PathLimitsBuilder().addPath('/0/allowed').build();

    const merged = merger.merge(new BlueNode(), source, limits);
    const mergedChild = merged.getItems()?.[0];

    expect(mergedChild).not.toBe(resolvedChild);
    expect(mergedChild?.getProperties()?.allowed?.getValue()).toBe('allowed');
    expect(mergedChild?.getProperties()?.blocked).toBeUndefined();
  });

  it('should clone already resolved properties for NoLimits and re-resolve for PathLimits', () => {
    const mockProcessor: MergingProcessor = {
      process: vi.fn(basicMergingProcessor),
    };
    const mockProvider = createNodeProvider(() => []);
    const merger = new Merger(mockProcessor, mockProvider);

    const resolvedProperty = new ResolvedBlueNode(
      new BlueNode().setProperties({
        allowed: new BlueNode().setValue('allowed'),
        blocked: new BlueNode().setValue('blocked'),
      }),
    );
    const source = new BlueNode().setProperties({
      resolved: resolvedProperty,
    });

    const noLimitsMerged = merger.merge(new BlueNode(), source, NO_LIMITS);
    const clonedProperty = noLimitsMerged.getProperties()?.resolved;

    expect(clonedProperty).not.toBe(resolvedProperty);
    expect(clonedProperty?.isResolved()).toBe(true);
    expect(clonedProperty?.getProperties()?.allowed?.getValue()).toBe(
      'allowed',
    );
    clonedProperty?.getProperties()?.allowed?.setValue('changed');
    expect(resolvedProperty.getProperties()?.allowed?.getValue()).toBe(
      'allowed',
    );

    const pathLimitsMerged = merger.merge(
      new BlueNode(),
      source,
      new PathLimitsBuilder().addPath('/resolved/allowed').build(),
    );
    const limitedProperty = pathLimitsMerged.getProperties()?.resolved;

    expect(limitedProperty).not.toBe(resolvedProperty);
    expect(limitedProperty?.getProperties()?.allowed?.getValue()).toBe(
      'allowed',
    );
    expect(limitedProperty?.getProperties()?.blocked).toBeUndefined();
  });

  it('should not share merged inherited node with merged type subtree', () => {
    const typeBlueId = 'no-alias-typed-node';
    const sharedType = new BlueNode('SharedType').setProperties({
      inherited: new BlueNode().setValue('initial'),
    });
    const mockProvider = createNodeProvider((blueId) =>
      blueId === typeBlueId ? [sharedType] : [],
    );
    const merger = new Merger(
      {
        process: vi.fn((target: BlueNode, source: BlueNode) => {
          let newTarget = target;
          if (source.getType() !== undefined) {
            newTarget = newTarget.cloneShallow().setType(source.getType());
          }
          if (source.getValue() !== undefined) {
            newTarget = newTarget.cloneShallow().setValue(source.getValue()!);
          }
          return newTarget;
        }),
      },
      mockProvider,
    );

    const merged = merger.merge(
      new BlueNode(),
      new BlueNode().setType(new BlueNode().setBlueId(typeBlueId)),
      NO_LIMITS,
    );
    const mergedInherited = merged.getProperties()?.inherited;
    const mergedTypeInherited = merged.getType()?.getProperties()?.inherited;

    expect(mergedInherited?.getValue()).toBe('initial');
    expect(mergedTypeInherited?.getValue()).toBe('initial');
    expect(mergedInherited).not.toBe(mergedTypeInherited);

    mergedInherited?.setValue('changed');
    expect(mergedTypeInherited?.getValue()).toBe('initial');
  });

  it('should merge source properties without mutating target properties map', () => {
    const mockProcessor: MergingProcessor = {
      process: vi.fn(basicMergingProcessor),
    };
    const mockProvider = createNodeProvider(() => []);
    const merger = new Merger(mockProcessor, mockProvider);

    const targetProperties = {
      existing: new BlueNode().setValue('existing-value'),
    };
    const target = new BlueNode().setProperties(targetProperties);
    const source = new BlueNode().setProperties({
      added: new BlueNode().setValue('added-value'),
    });

    const merged = merger.merge(target, source, NO_LIMITS);

    expect(target.getProperties()).toBe(targetProperties);
    expect(target.getProperties()?.added).toBeUndefined();
    expect(merged.getProperties()?.existing?.getValue()).toBe('existing-value');
    expect(merged.getProperties()?.added?.getValue()).toBe('added-value');
  });

  it('should cache resolved type by blueId for repeated typed nodes in one resolve', () => {
    const typeBlueId = 'shared-type-blue-id';
    const sharedType = new BlueNode('SharedType').setProperties({
      fromType: new BlueNode().setValue('from-type'),
    });
    const fetchByBlueId = vi.fn((blueId: string) =>
      blueId === typeBlueId ? [sharedType] : [],
    );
    const mockProvider = createNodeProvider(fetchByBlueId);
    const merger = new Merger(
      {
        process: vi.fn(basicMergingProcessor),
      },
      mockProvider,
    );

    const source = new BlueNode().setProperties({
      first: new BlueNode().setType(new BlueNode().setBlueId(typeBlueId)),
      second: new BlueNode().setType(new BlueNode().setBlueId(typeBlueId)),
    });

    const resolved = merger.resolve(source, NO_LIMITS);

    expect(fetchByBlueId).toHaveBeenCalledTimes(1);
    expect(
      resolved.getProperties()?.first?.getProperties()?.fromType?.getValue(),
    ).toBe('from-type');
    expect(
      resolved.getProperties()?.second?.getProperties()?.fromType?.getValue(),
    ).toBe('from-type');
  });

  it('should keep type cache path-sensitive when using path limits', () => {
    const typeBlueId = 'path-sensitive-type-blue-id';
    const sharedType = new BlueNode('SharedType').setProperties({
      firstOnly: new BlueNode().setValue('first-only-value'),
      secondOnly: new BlueNode().setValue('second-only-value'),
    });
    const fetchByBlueId = vi.fn((blueId: string) =>
      blueId === typeBlueId ? [sharedType] : [],
    );
    const mockProvider = createNodeProvider(fetchByBlueId);
    const merger = new Merger(
      {
        process: vi.fn(basicMergingProcessor),
      },
      mockProvider,
    );

    const source = new BlueNode().setProperties({
      first: new BlueNode().setType(new BlueNode().setBlueId(typeBlueId)),
      second: new BlueNode().setType(new BlueNode().setBlueId(typeBlueId)),
    });
    const limits = new PathLimitsBuilder()
      .addPath('/first/firstOnly')
      .addPath('/second/secondOnly')
      .build();

    const resolved = merger.resolve(source, limits);

    expect(fetchByBlueId).toHaveBeenCalledTimes(2);
    expect(
      resolved.getProperties()?.first?.getProperties()?.firstOnly?.getValue(),
    ).toBe('first-only-value');
    expect(
      resolved.getProperties()?.first?.getProperties()?.secondOnly,
    ).toBeUndefined();
    expect(
      resolved.getProperties()?.second?.getProperties()?.secondOnly?.getValue(),
    ).toBe('second-only-value');
    expect(
      resolved.getProperties()?.second?.getProperties()?.firstOnly,
    ).toBeUndefined();
  });

  it('should merge contracts', () => {
    const mockProcessor: MergingProcessor = {
      process: vi.fn(basicMergingProcessor),
    };
    const mockProvider = createNodeProvider(() => []);

    const merger = new Merger(mockProcessor, mockProvider);
    const sourceNode = new BlueNode('TestNode').setContracts({
      contract1: new BlueNode().setValue('c-value1'),
      contract2: new BlueNode().setValue('c-value2'),
    });

    const resolved = merger.resolve(sourceNode, NO_LIMITS);

    expect(resolved.getContracts()).toBeDefined();
    expect(resolved.getContracts()?.contract1?.getValue()).toBe('c-value1');
    expect(resolved.getContracts()?.contract2?.getValue()).toBe('c-value2');
  });

  it('should call postProcess if defined', () => {
    const postProcessFn = vi.fn((target: BlueNode) => target);
    const mockProcessor: MergingProcessor = {
      process: vi.fn((target: BlueNode) => target),
      postProcess: postProcessFn,
    };
    const mockProvider = createNodeProvider(() => []);

    const merger = new Merger(mockProcessor, mockProvider);
    const sourceNode = new BlueNode('TestNode');

    merger.resolve(sourceNode, NO_LIMITS);

    expect(postProcessFn).toHaveBeenCalled();
  });

  it('should work with defaultMergingProcessor', () => {
    const mockProvider = createNodeProvider(() => []);

    /**
     * Default MergingProcessor that copies basic node properties
     */
    const defaultMergingProcessor: MergingProcessor = {
      process(target: BlueNode, source: BlueNode): BlueNode {
        // Copy basic properties from source to target
        if (source.getValue() !== undefined) {
          target.setValue(source.getValue()!);
        }
        if (source.getType() !== undefined) {
          target.setType(source.getType());
        }
        if (source.getItemType() !== undefined) {
          target.setItemType(source.getItemType());
        }
        if (source.getKeyType() !== undefined) {
          target.setKeyType(source.getKeyType());
        }
        if (source.getValueType() !== undefined) {
          target.setValueType(source.getValueType());
        }
        return target;
      },
    };
    const merger = new Merger(defaultMergingProcessor, mockProvider);

    const sourceNode = new BlueNode('TestNode')
      .setValue('test value')
      .setType(new BlueNode().setValue('String'));

    const resolved = merger.resolve(sourceNode, NO_LIMITS);

    expect(resolved.getValue()).toBe('test value');
    expect(resolved.getType()?.getValue()).toBe('String');
  });

  describe('integration test', () => {
    let nodeProvider: BasicNodeProvider;
    const defaultMergingProcessor = createDefaultMergingProcessor();

    beforeEach(() => {
      nodeProvider = new BasicNodeProvider();
    });

    it('should propagate metadata from source to target', () => {
      nodeProvider.addSingleDocs(`
name: Timeline Entry
message:
  description: This is a message of Timeline Entry
`);

      nodeProvider.addSingleDocs(`
name: My Entry
type:
  blueId: ${nodeProvider.getBlueIdByName('Timeline Entry')}
message:
  name: Start
`);

      const merger = new Merger(defaultMergingProcessor, nodeProvider);
      const myEntry = nodeProvider.findNodeByName('My Entry');

      if (!myEntry) {
        throw new Error('My Entry not found');
      }

      const resolved = merger.resolve(myEntry, NO_LIMITS);

      expect(resolved.getProperties()?.message?.getName()).toBe('Start');
    });

    it('should prefer type message name over source message name', () => {
      nodeProvider.addSingleDocs(`
name: Timeline Entry
message:
  name: Type Start
  description: This is a message of Timeline Entry
`);

      nodeProvider.addSingleDocs(`
name: My Entry
type:
  blueId: ${nodeProvider.getBlueIdByName('Timeline Entry')}
message:
  name: Start
`);

      const merger = new Merger(defaultMergingProcessor, nodeProvider);
      const myEntry = nodeProvider.findNodeByName('My Entry');

      if (!myEntry) {
        throw new Error('My Entry not found');
      }

      const resolved = merger.resolve(myEntry, NO_LIMITS);

      expect(resolved.getProperties()?.message?.getName()).toBe('Type Start');
    });

    it('should be idempotent when resolving the same node twice', () => {
      nodeProvider.addSingleDocs(`
name: Document Anchor
template:
  description: Optional Blue document template.
      `);

      nodeProvider.addSingleDocs(`
name: Document Anchors
type: Dictionary
keyType: Text
valueType:
  blueId: ${nodeProvider.getBlueIdByName('Document Anchor')}
      `);

      nodeProvider.addSingleDocs(`
name: My Entry
type:
  blueId: ${nodeProvider.getBlueIdByName('Document Anchors')}
anchor1:
  type:
    blueId: ${nodeProvider.getBlueIdByName('Document Anchor')}
anchor2:
  type:
    blueId: ${nodeProvider.getBlueIdByName('Document Anchor')}
      `);

      const blue = new Blue({ nodeProvider });

      const myEntry = nodeProvider.findNodeByName('My Entry');

      if (!myEntry) {
        throw new Error('My Entry not found');
      }

      const resolvedNode = blue.resolve(myEntry);
      const resolvedNode2 = blue.resolve(resolvedNode);

      expect(blue.nodeToJson(resolvedNode)).toEqual(
        blue.nodeToJson(resolvedNode2),
      );
    });
  });
});
