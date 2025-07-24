import { Blue, BasicNodeProvider } from '@blue-labs/language';
// import { ExpressionLimits } from '../ExpressionLimits';

describe('ExpressionLimits debug', () => {
  test('understand expression handling without custom processor', () => {
    const nodeProvider = new BasicNodeProvider();
    nodeProvider.addSingleDocs(`
name: Json Patch Entry
description: >
  Represents a single operation in a Json Patch, defining a specific change to be applied to a JSON document.
val:
  description: The value to be used in the operation
op:
  description: The operation to be performed on the target JSON document.
  type:
    blueId: F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP
path:
  description: >
    A JSON Pointer string indicating the location in the document where the operation should be applied. Must start with a forward slash (/).
  type:
    blueId: F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP
      `);
    nodeProvider.addSingleDocs(`
  name: Update Document
  changeset:
    type: List
    itemType:
      blueId: ${nodeProvider.getBlueIdByName('Json Patch Entry')}
      `);
    const blue = new Blue({ nodeProvider });
    // blue.setGlobalLimits(new ExpressionLimits());

    // Use a simpler test case without type conflict
    const yaml = `
type:
  blueId: ${nodeProvider.getBlueIdByName('Update Document')}
changeset: "\${steps.CreateSubscriptions.changes}"`;

    const node = blue.yamlToNode(yaml);
    console.log('\n=== Without custom processor ===');
    console.log(
      'Before resolve - changeset value:',
      blue.nodeToJson(node.getProperties()!['changeset']!, 'original')
    );

    console.log('Node before resolve:', blue.nodeToJson(node, 'original'));
    console.log(
      'Changeset before resolve:',
      node.getProperties()?.['changeset']
    );

    const resolved = blue.resolve(node);
    console.log('Node after resolve:', blue.nodeToJson(resolved, 'original'));
    console.log(
      'After resolve - changeset value:',
      blue.nodeToJson(resolved.getProperties()!['changeset']!, 'original')
    );
    console.log(
      'Changeset node after resolve:',
      resolved.getProperties()?.['changeset']
    );

    // EXPLANATION: The ExpressionLimits doesn't work as expected because:
    // 1. When Merger processes a node with a type, it resolves the type FIRST
    // 2. The type definition (Update Document) specifies changeset as a List with itemType
    // 3. By the time limits are checked, the expression value has already been replaced
    //
    // SOLUTION: Use a custom MergingProcessor like ExpressionPreserver that runs
    // early in the chain and preserves expression values. See the ExpressionPreserver.ts
    // file for implementation.

    // UPDATE: With the new PropertyExpressionPreserver added to the default processor chain,
    // expressions are now preserved! The test above shows that changeset keeps its
    // expression value even after type resolution.
  });
});
