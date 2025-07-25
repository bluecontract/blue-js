import { describe, it, expect } from 'vitest';
import { BlueNode } from '../index';
import { ResolvedNode } from '../ResolvedNode';
import { BlueIdCalculator } from '../../utils/BlueIdCalculator';

describe('ResolvedNode', () => {
  it('should extend BlueNode and mark as resolved', () => {
    // Create a node
    const originalNode = new BlueNode('TestNode');
    originalNode.setValue('test value');
    originalNode.setDescription('test description');
    originalNode.addProperty('prop', new BlueNode().setValue('value'));

    // Create ResolvedNode
    const resolvedNode = new ResolvedNode(originalNode);

    // Verify it's a resolved node
    expect(resolvedNode.isResolved()).toBe(true);
    expect(resolvedNode).toBeInstanceOf(BlueNode);
    expect(resolvedNode).toBeInstanceOf(ResolvedNode);

    // Verify state is copied
    expect(resolvedNode.getName()).toBe('TestNode');
    expect(resolvedNode.getValue()).toBe('test value');
    expect(resolvedNode.getDescription()).toBe('test description');
    expect(resolvedNode.getProperties()?.['prop']?.getValue()).toBe('value');

    // Regular BlueNode should not be resolved
    expect(originalNode.isResolved()).toBe(false);
  });

  it('should properly clone', () => {
    const originalNode = new BlueNode('TestNode');
    originalNode.setValue('test');

    const resolvedNode = new ResolvedNode(originalNode);
    const cloned = resolvedNode.clone();

    expect(cloned).toBeInstanceOf(ResolvedNode);
    expect(cloned.isResolved()).toBe(true);
    expect(cloned.getValue()).toBe('test');
    expect(cloned).not.toBe(resolvedNode); // Different instances
  });

  it('should get minimal node using MergeReverser', () => {
    // Create a node that simulates having inherited properties from type
    const resolvedContent = new BlueNode('TestNode');
    resolvedContent.setValue('modified value');

    // Type reference
    const typeNode = new BlueNode('TestType');
    resolvedContent.setType(typeNode);

    // Properties that would come from type resolution
    resolvedContent.addProperty(
      'fromType',
      new BlueNode().setValue('inherited')
    );
    resolvedContent.addProperty(
      'userAdded',
      new BlueNode().setValue('user property')
    );

    const resolvedNode = new ResolvedNode(resolvedContent);

    // Get the minimal node
    const minimalNode = resolvedNode.getMinimalNode();

    // The minimal node should have the user properties but not type
    expect(minimalNode.getValue()).toBe('modified value');
    expect(minimalNode.getProperties()?.['userAdded']?.getValue()).toBe(
      'user property'
    );

    // MergeReverser removes the type reference since it's been fully resolved
    expect(minimalNode.getType()).toBeUndefined();

    // The minimal node should not be marked as resolved
    expect(minimalNode.isResolved()).toBe(false);
  });

  it('should calculate minimal blueId', () => {
    // Create a node that simulates resolution with type
    const node = new BlueNode('TestNode');
    node.setValue('test');

    // Add a type reference
    const typeNode = new BlueNode('TestType');
    node.setType(typeNode);

    // Add properties (some would come from type, some from user)
    node.addProperty('fromType', new BlueNode().setValue('inherited'));
    node.addProperty('userProp', new BlueNode().setValue('user value'));

    const resolvedNode = new ResolvedNode(node);

    // Get minimal blueId (should be different because MergeReverser removes type)
    const minimalBlueId = resolvedNode.getMinimalBlueId();
    expect(minimalBlueId).toBeTruthy();

    // The minimal blueId should be different from the resolved node's blueId
    // because the minimal node doesn't have the type reference
    const resolvedBlueId = BlueIdCalculator.calculateBlueIdSync(resolvedNode);
    expect(minimalBlueId).not.toBe(resolvedBlueId);

    // Verify the minimal node structure
    const minimalNode = resolvedNode.getMinimalNode();
    expect(minimalNode.getType()).toBeUndefined(); // Type removed by MergeReverser
    expect(minimalNode.getValue()).toBe('test');
  });

  it('should handle fromNode static method', () => {
    const node = new BlueNode('Test');
    node.setValue('value');

    // Create from regular node
    const resolved1 = ResolvedNode.fromNode(node);
    expect(resolved1).toBeInstanceOf(ResolvedNode);
    expect(resolved1.getValue()).toBe('value');

    // Create from already resolved node (should clone)
    const resolved2 = ResolvedNode.fromNode(resolved1);
    expect(resolved2).toBeInstanceOf(ResolvedNode);
    expect(resolved2).not.toBe(resolved1); // Should be a different instance
    expect(resolved2.getValue()).toBe('value');
  });
});
