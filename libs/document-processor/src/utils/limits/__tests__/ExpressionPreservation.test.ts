import { Blue, BasicNodeProvider } from '@blue-labs/language';

describe('Expression preservation during type resolution', () => {
  test('expressions are preserved when document type would override property structure', () => {
    const nodeProvider = new BasicNodeProvider();

    // Define a type that expects a List structure
    nodeProvider.addSingleDocs(`
name: Json Patch Entry
val:
  description: The value to be used in the operation`);

    nodeProvider.addSingleDocs(`
name: Update Document
changeset:
  type: List
  itemType:
    blueId: ${nodeProvider.getBlueIdByName('Json Patch Entry')}`);

    const blue = new Blue({ nodeProvider });

    // Create a document with an expression that conflicts with the type definition
    const yaml = `
type:
  blueId: ${nodeProvider.getBlueIdByName('Update Document')}
changeset: "\${steps.CreateSubscriptions.changes}"`;

    const node = blue.yamlToNode(yaml);

    // Before resolve: changeset is a simple string expression
    expect(node.getProperties()?.['changeset']?.getValue()).toBe(
      '${steps.CreateSubscriptions.changes}'
    );

    // Resolve the node (which applies type definitions)
    const resolved = blue.resolve(node);

    // After resolve: expression is preserved!
    // Even though the type says changeset should be a List,
    // the expression value takes precedence
    expect(resolved.getProperties()?.['changeset']?.getValue()).toBe(
      '${steps.CreateSubscriptions.changes}'
    );

    // The PropertyExpressionPreserver ensures expressions aren't lost
    // during type resolution, which is critical for dynamic configuration
  });

  test('expressions work with multiple properties', () => {
    const nodeProvider = new BasicNodeProvider();

    nodeProvider.addSingleDocs(`
name: Config
database:
  host: 
    type: Text
    value: localhost
  port:
    type: Integer
    value: 5432
apiKey:
  type: Text
  value: default-key`);

    const blue = new Blue({ nodeProvider });

    const yaml = `
type:
  blueId: ${nodeProvider.getBlueIdByName('Config')}
database:
  host: "\${env.DB_HOST}"
apiKey: "\${secrets.API_KEY}"`;

    const node = blue.yamlToNode(yaml);
    const resolved = blue.resolve(node);

    // Expression in database.host is preserved
    expect(
      resolved
        .getProperties()
        ?.['database']?.getProperties()
        ?.['host']?.getValue()
    ).toBe('${env.DB_HOST}');

    // Expression in apiKey is preserved
    expect(resolved.getProperties()?.['apiKey']?.getValue()).toBe(
      '${secrets.API_KEY}'
    );
  });
});
