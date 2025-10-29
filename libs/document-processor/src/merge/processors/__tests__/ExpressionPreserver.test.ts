import { ExpressionPreserver } from '../ExpressionPreserver';
import {
  Blue,
  BasicNodeProvider,
  MergingProcessors,
} from '@blue-labs/language';

describe('ExpressionPreserver', () => {
  let nodeProvider: BasicNodeProvider;
  let blue: Blue;

  beforeEach(() => {
    nodeProvider = new BasicNodeProvider();

    // Set up test types
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

    // Create merger with ExpressionPreserver
    const mergingProcessor = new MergingProcessors.SequentialMergingProcessor([
      new MergingProcessors.ValuePropagator(),
      new ExpressionPreserver(),
      new MergingProcessors.TypeAssigner(),
    ]);

    blue = new Blue({ nodeProvider, mergingProcessor });
  });

  test('preserves expression values when type resolution would override them', () => {
    const yaml = `
type:
  blueId: ${nodeProvider.getBlueIdByName('Update Document')}
changeset: "\${steps.CreateSubscriptions.changes}"`;

    const source = blue.yamlToNode(yaml);
    const result = blue.resolve(source);

    // Expression should be preserved despite type saying changeset is a List
    expect(result.getProperties()?.['changeset']?.getValue()).toBe(
      '${steps.CreateSubscriptions.changes}',
    );
  });

  test('preserves nested property expressions', () => {
    nodeProvider.addSingleDocs(`
name: Complex Type
config:
  database:
    host:
      type: Text
    port:
      type: Integer`);

    const yaml = `
type:
  blueId: ${nodeProvider.getBlueIdByName('Complex Type')}
config:
  database:
    host: "\${env.DB_HOST}"
    port: "\${env.DB_PORT}"`;

    const source = blue.yamlToNode(yaml);
    const result = blue.resolve(source);

    // Both expressions should be preserved
    const db = result.getProperties()?.['config']?.getProperties()?.[
      'database'
    ];
    expect(db?.getProperties()?.['host']?.getValue()).toBe('${env.DB_HOST}');
    expect(db?.getProperties()?.['port']?.getValue()).toBe('${env.DB_PORT}');
  });

  test('does not affect properties without expressions', () => {
    const yaml = `
type:
  blueId: ${nodeProvider.getBlueIdByName('Update Document')}
changeset:
  - val: "regular value"`;

    const source = blue.yamlToNode(yaml);
    const result = blue.resolve(source);

    // Regular values should be processed normally
    const changeset = result.getProperties()?.['changeset'];
    expect(changeset?.getItems()).toBeDefined();
    expect(
      changeset?.getItems()?.[0]?.getProperties()?.['val']?.getValue(),
    ).toBe('regular value');
  });
});
