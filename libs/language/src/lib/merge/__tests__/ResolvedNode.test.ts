import { Blue } from '../../Blue';
import { BlueNode } from '../../model';
import { BasicNodeProvider } from '../../provider';

describe('ResolvedNode', () => {
  let blue: Blue;
  let provider: BasicNodeProvider;

  beforeEach(() => {
    const personType = new BlueNode()
      .setName('Person123')
      .addProperty('age', new BlueNode().setType('Integer'))
      .addProperty('extra', new BlueNode().setType('Text'));

    provider = new BasicNodeProvider();
    provider.addSingleNodes(personType);

    blue = new Blue({ nodeProvider: provider });
  });

  it('should create a ResolvedNode with original and resolved nodes', () => {
    const node = new BlueNode()
      .setType(new BlueNode().setBlueId(provider.getBlueIdByName('Person123')))
      .setName('John')
      .addProperty('age', new BlueNode().setValue(34).setType('Integer'));

    const preprocessedNode = blue.preprocess(node);
    const resolvedNode = blue.resolve(preprocessedNode);

    // Check that we have both nodes
    expect(resolvedNode.getOriginalNode()).toBeDefined();
    expect(resolvedNode.getResolvedNode()).toBeDefined();

    // Check that they are different (resolution should have added the age property from type)
    expect(resolvedNode.isResolved()).toBe(true);

    // Original should not have age property
    expect(
      resolvedNode.getOriginalNode().getProperties()?.extra
    ).toBeUndefined();

    // Resolved should have age property from type
    expect(resolvedNode.getResolvedNode().getProperties()?.extra).toBeDefined();
  });

  it('should preserve original blueId', () => {
    const node = new BlueNode()
      .setType(new BlueNode().setBlueId(provider.getBlueIdByName('Person123')))
      .addProperty('additional', new BlueNode().setValue('John'));

    const resolvedNode = blue.resolve(node);

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

    const resolvedNode = blue.resolve(node);

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

    const resolvedNode = blue.resolve(node);

    // All delegated methods should return values from resolved node
    expect(resolvedNode.getName()).toBe('TestNode');
    expect(resolvedNode.getDescription()).toBe('Test description');
    expect(resolvedNode.getValue()).toBe('test value');
  });

  it('should convert back to BlueNode', () => {
    const node = new BlueNode()
      .setType(new BlueNode().setBlueId(provider.getBlueIdByName('Person123')))
      .addProperty('name', new BlueNode().setValue('John'));

    const resolvedNode = blue.resolve(node);
    const blueNode = resolvedNode.toBlueNode();

    // Should return the resolved version
    expect(blueNode).toBeInstanceOf(BlueNode);
    expect(blueNode.getProperties()?.age).toBeDefined();
  });
});
