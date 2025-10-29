import { describe, it, expect } from 'vitest';
import { BlueNode } from '../index';
import { ResolvedBlueNode } from '../ResolvedNode';
import { BlueIdCalculator } from '../../utils/BlueIdCalculator';
import { BasicNodeProvider } from '../../provider';
import { Merger } from '../../merge/Merger';
import { createDefaultMergingProcessor } from '../../merge';
import { NO_LIMITS } from '../../utils/limits';

describe('ResolvedBlueNode Integration Tests', () => {
  it('should create ResolvedBlueNode through Merger and verify resolved state', () => {
    // Setup provider with test data
    const nodeProvider = new BasicNodeProvider();

    nodeProvider.addSingleDocs(`
name: TestNode
value: test value
description: test description
`);

    // Create merger with default processor
    const merger = new Merger(createDefaultMergingProcessor(), nodeProvider);

    // Get and resolve the node
    const originalNode = nodeProvider.getNodeByName('TestNode');
    const resolvedNode = merger.resolve(originalNode, NO_LIMITS);

    // Verify it's a resolved node
    expect(resolvedNode).toBeInstanceOf(ResolvedBlueNode);
    expect(resolvedNode.isResolved()).toBe(true);

    // Verify state is preserved
    expect(resolvedNode.getName()).toBe('TestNode');
    expect(resolvedNode.getValue()).toBe('test value');
    expect(resolvedNode.getDescription()).toBe('test description');

    // Original node should not be resolved
    expect(originalNode.isResolved()).toBe(false);
  });

  it('should properly clone resolved nodes', () => {
    const nodeProvider = new BasicNodeProvider();

    nodeProvider.addSingleDocs(`
name: TestNode
value: test
`);

    const merger = new Merger(createDefaultMergingProcessor(), nodeProvider);
    const originalNode = nodeProvider.getNodeByName('TestNode');
    const resolvedNode = merger.resolve(originalNode, NO_LIMITS);

    const cloned = resolvedNode.clone();

    expect(cloned).toBeInstanceOf(ResolvedBlueNode);
    expect(cloned.isResolved()).toBe(true);
    expect(cloned.getValue()).toBe('test');
    expect(cloned).not.toBe(resolvedNode); // Different instances
  });

  it('should get minimal node after type resolution using MergeReverser', () => {
    const nodeProvider = new BasicNodeProvider();

    // Define a base type with a property
    nodeProvider.addSingleDocs(`
name: BaseType
x: 10
`);

    // Get the base type's blueId
    const baseTypeBlueId = nodeProvider.getBlueIdByName('BaseType');

    // Define a node that extends the base type
    nodeProvider.addSingleDocs(`
name: ExtendedNode
type:
  blueId: ${baseTypeBlueId}
value: extended value
y: 20
`);

    const merger = new Merger(createDefaultMergingProcessor(), nodeProvider);
    const extendedNode = nodeProvider.getNodeByName('ExtendedNode');
    const resolvedNode = merger.resolve(extendedNode, NO_LIMITS);

    // Verify the resolved node has properties from both base and extended
    expect(resolvedNode.get('/x')).toBeTruthy(); // Has x from base
    expect(resolvedNode.get('/y')).toBeTruthy(); // Has y from extended
    expect(resolvedNode.getValue()).toBe('extended value');

    // Get the minimal node
    const minimalNode = resolvedNode.getMinimalNode();

    // The minimal node should only have what was defined on ExtendedNode
    expect(minimalNode.getValue()).toBe('extended value');
    expect(minimalNode.get('/y')).toBeTruthy();
    expect(minimalNode.get('/x')).toBeUndefined(); // x came from base type

    // MergeReverser keeps the type reference but just as a blueId
    expect(minimalNode.getType()).toBeDefined();
    expect(minimalNode.getType()?.getBlueId()).toBe(baseTypeBlueId);
    // Type should not have the full resolved content
    expect(minimalNode.getType()?.getName()).toBeUndefined();

    // The minimal node should not be marked as resolved
    expect(minimalNode.isResolved()).toBe(false);
  });

  it('should have different blueIds when resolved node has inherited properties', () => {
    const nodeProvider = new BasicNodeProvider();

    // Define a base type with multiple properties
    nodeProvider.addSingleDocs(`
name: BaseType
baseA: 1
baseB: 2
`);

    const baseTypeBlueId = nodeProvider.getBlueIdByName('BaseType');

    // Define a simple node with just the type reference
    nodeProvider.addSingleDocs(`
name: TestNode
type:
  blueId: ${baseTypeBlueId}
`);

    const merger = new Merger(createDefaultMergingProcessor(), nodeProvider);
    const node = nodeProvider.getNodeByName('TestNode');
    const resolvedNode = merger.resolve(node, NO_LIMITS);

    // The resolved node should have inherited properties
    expect(resolvedNode.get('/baseA')).toBeTruthy();
    expect(resolvedNode.get('/baseB')).toBeTruthy();

    // The minimal node should not have inherited properties
    const minimalNode = resolvedNode.getMinimalNode();
    expect(minimalNode.get('/baseA')).toBeUndefined();
    expect(minimalNode.get('/baseB')).toBeUndefined();

    // BlueIds should be different because:
    // - Resolved has baseA and baseB properties
    // - Minimal only has the type reference
    const resolvedBlueId = BlueIdCalculator.calculateBlueIdSync(
      resolvedNode.setBlueId(undefined),
    );
    const minimalBlueId = resolvedNode.getMinimalBlueId();

    // They should be different
    expect(minimalBlueId).not.toBe(resolvedBlueId);
  });

  it('should handle modifications to resolved node and reflect in minimal', () => {
    const nodeProvider = new BasicNodeProvider();

    // Simple node without type to avoid conflicts
    nodeProvider.addSingleDocs(`
name: TestNode
value: original
`);

    const merger = new Merger(createDefaultMergingProcessor(), nodeProvider);
    const node = nodeProvider.getNodeByName('TestNode');
    const resolvedNode = merger.resolve(node, NO_LIMITS);

    // Modify the resolved node
    resolvedNode.setValue('modified');
    const newProp = new BlueNode();
    newProp.setValue('added after resolve');
    resolvedNode.addProperty('newProp', newProp);

    // Get minimal representation
    const minimalNode = resolvedNode.getMinimalNode();

    // Should reflect the modifications
    expect(minimalNode.getValue()).toBe('modified');
    expect(minimalNode.getProperties()?.['newProp']?.getValue()).toBe(
      'added after resolve',
    );
  });

  it('should handle type inheritance without value conflicts', () => {
    const nodeProvider = new BasicNodeProvider();

    // Base type with simple properties
    nodeProvider.addSingleDocs(`
name: BaseType
prop1: base1
prop2: base2
`);

    const baseTypeBlueId = nodeProvider.getBlueIdByName('BaseType');

    // Extended type that adds new properties (no overrides to avoid conflicts)
    nodeProvider.addSingleDocs(`
name: FinalType
type:
  blueId: ${baseTypeBlueId}
value: final value
prop3: final3
`);

    const merger = new Merger(createDefaultMergingProcessor(), nodeProvider);
    const finalNode = nodeProvider.getNodeByName('FinalType');
    const resolvedNode = merger.resolve(finalNode, NO_LIMITS);

    // Verify full resolution includes inherited properties
    expect(resolvedNode.get('/prop1')).toBeTruthy();
    expect(resolvedNode.get('/prop2')).toBeTruthy();
    expect(resolvedNode.get('/prop3')).toBeTruthy();
    expect(resolvedNode.getValue()).toBe('final value');

    // Get minimal - should only have what's defined at the final level
    const minimalNode = resolvedNode.getMinimalNode();

    expect(minimalNode.getValue()).toBe('final value');
    expect(minimalNode.get('/prop3')).toBeTruthy();

    // Should not have inherited properties
    expect(minimalNode.get('/prop1')).toBeUndefined();
    expect(minimalNode.get('/prop2')).toBeUndefined();

    // Type reference is kept but just as blueId
    expect(minimalNode.getType()?.getBlueId()).toBe(baseTypeBlueId);
  });
});
