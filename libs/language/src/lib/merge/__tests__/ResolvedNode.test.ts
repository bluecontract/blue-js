import { Blue } from '../../Blue';
import { BlueNode } from '../../model';
import { createNodeProvider } from '../../NodeProvider';

describe('ResolvedNode', () => {
  let blue: Blue;

  beforeEach(() => {
    const personType = new BlueNode()
      .setBlueId('Person123')
      .addProperty('name', new BlueNode().setType('Text'))
      .addProperty('age', new BlueNode().setType('Integer'));

    const provider = createNodeProvider((blueId: string) => {
      if (blueId === 'Person123') {
        return [personType];
      }
      return [];
    });

    blue = new Blue({ nodeProvider: provider });
  });

  it('should create a ResolvedNode with original and resolved nodes', () => {
    const node = new BlueNode()
      .setType('Person123')
      .addProperty('name', new BlueNode().setValue('John'));

    const resolvedNode = blue.resolveToResolvedNode(node);

    // Check that we have both nodes
    expect(resolvedNode.getOriginalNode()).toBeDefined();
    expect(resolvedNode.getResolvedNode()).toBeDefined();

    // Check that they are different (resolution should have added the age property from type)
    expect(resolvedNode.isResolved()).toBe(true);

    // Original should not have age property
    expect(resolvedNode.getOriginalNode().getProperties()?.age).toBeUndefined();

    // Resolved should have age property from type
    expect(resolvedNode.getResolvedNode().getProperties()?.age).toBeDefined();
  });

  it('should preserve original blueId', () => {
    const node = new BlueNode()
      .setType('Person123')
      .addProperty('name', new BlueNode().setValue('John'));

    const resolvedNode = blue.resolveToResolvedNode(node);

    const originalBlueId = resolvedNode.getOriginalBlueId();
    const resolvedBlueId = resolvedNode.getResolvedBlueId();

    // BlueIds should be different because resolution adds properties
    expect(originalBlueId).toBeDefined();
    expect(resolvedBlueId).toBeDefined();
    expect(originalBlueId).not.toBe(resolvedBlueId);
  });

  it('should handle unresolved nodes', () => {
    const node = new BlueNode().addProperty(
      'name',
      new BlueNode().setValue('John')
    );

    const resolvedNode = blue.resolveToResolvedNode(node);

    // Without a type, the node shouldn't change during resolution
    expect(resolvedNode.isResolved()).toBe(false);
    expect(resolvedNode.getOriginalBlueId()).toBe(
      resolvedNode.getResolvedBlueId()
    );
  });

  it('should delegate methods to resolved node', () => {
    const node = new BlueNode()
      .setName('TestNode')
      .setDescription('Test description')
      .setValue('test value');

    const resolvedNode = blue.resolveToResolvedNode(node);

    // All delegated methods should return values from resolved node
    expect(resolvedNode.getName()).toBe('TestNode');
    expect(resolvedNode.getDescription()).toBe('Test description');
    expect(resolvedNode.getValue()).toBe('test value');
  });

  it('should convert back to BlueNode', () => {
    const node = new BlueNode()
      .setType('Person123')
      .addProperty('name', new BlueNode().setValue('John'));

    const resolvedNode = blue.resolveToResolvedNode(node);
    const blueNode = resolvedNode.toBlueNode();

    // Should return the resolved version
    expect(blueNode).toBeInstanceOf(BlueNode);
    expect(blueNode.getProperties()?.age).toBeDefined();
  });
});
