import { Blue, BlueNode } from '../src';
import { createNodeProvider } from '../src/lib/NodeProvider';

// Example demonstrating ResolvedNode functionality
async function demonstrateResolvedNode() {
  // Create a simple type definition
  const personType = new BlueNode()
    .setBlueId('Person123')
    .addProperty('name', new BlueNode().setType('Text'))
    .addProperty('age', new BlueNode().setType('Integer'))
    .addProperty('email', new BlueNode().setType('Text'));

  // Create a node provider that can resolve the Person type
  const provider = createNodeProvider((blueId: string) => {
    if (blueId === 'Person123') {
      return [personType];
    }
    return [];
  });

  // Create Blue instance with the provider
  const blue = new Blue({ nodeProvider: provider });

  // Create an instance of Person with only some properties
  const johnNode = new BlueNode()
    .setType('Person123')
    .addProperty('name', new BlueNode().setValue('John Doe'))
    .addProperty('age', new BlueNode().setValue(30));

  console.log(
    'Original node properties:',
    Object.keys(johnNode.getProperties() || {})
  );
  // Output: ['name', 'age']

  // Resolve the node - this will merge in the email property from the type
  const resolvedNode = blue.resolveToResolvedNode(johnNode);

  console.log('Is resolved?', resolvedNode.isResolved());
  // Output: true

  console.log('Original BlueId:', resolvedNode.getOriginalBlueId());
  console.log('Resolved BlueId:', resolvedNode.getResolvedBlueId());
  // These will be different because resolution added the email property

  console.log(
    'Original node properties:',
    Object.keys(resolvedNode.getOriginalNode().getProperties() || {})
  );
  // Output: ['name', 'age']

  console.log(
    'Resolved node properties:',
    Object.keys(resolvedNode.getResolvedNode().getProperties() || {})
  );
  // Output: ['name', 'age', 'email']

  // You can still use it like a normal BlueNode
  console.log('Name:', resolvedNode.getProperties()?.name?.getValue());
  // Output: 'John Doe'

  // Convert back to BlueNode if needed
  const blueNode = resolvedNode.toBlueNode();
  console.log('Converted back to BlueNode:', blueNode instanceof BlueNode);
  // Output: true
}

// Another example: nodes without types remain unchanged
async function demonstrateUnresolvedNode() {
  const blue = new Blue();

  const simpleNode = new BlueNode()
    .setName('SimpleNode')
    .setValue('Some value');

  const resolvedNode = blue.resolveToResolvedNode(simpleNode);

  console.log('Is resolved?', resolvedNode.isResolved());
  // Output: false (no changes were made)

  console.log(
    'Original BlueId === Resolved BlueId?',
    resolvedNode.getOriginalBlueId() === resolvedNode.getResolvedBlueId()
  );
  // Output: true (node didn't change)
}

// Run examples
console.log('=== ResolvedNode Example 1: Type Resolution ===');
demonstrateResolvedNode();

console.log('\n=== ResolvedNode Example 2: No Resolution ===');
demonstrateUnresolvedNode();
