import { Merger } from '../../Merger';
import { SequentialMergingProcessor } from '../SequentialMergingProcessor';
import { ValuePropagator } from '../ValuePropagator';
import { TypeAssigner } from '../TypeAssigner';
import { BasicNodeProvider } from '../../../provider/BasicNodeProvider';
import { yamlBlueParse } from '../../../../utils';
import { NodeDeserializer } from '../../../model';
import { NO_LIMITS } from '../../../utils/limits';
import { ExpressionPreserver } from '../ExpressionPreserver';

describe('ExpressionPreserver', () => {
  let nodeProvider: BasicNodeProvider;
  let merger: Merger;

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
    const mergingProcessor = new SequentialMergingProcessor([
      new ValuePropagator(),
      new ExpressionPreserver(),
      new TypeAssigner(),
    ]);
    merger = new Merger(mergingProcessor, nodeProvider);
  });

  test('preserves expression values when type resolution would override them', () => {
    const yaml = `
type:
  blueId: ${nodeProvider.getBlueIdByName('Update Document')}
changeset: "\${steps.CreateSubscriptions.changes}"`;

    const source = NodeDeserializer.deserialize(yamlBlueParse(yaml)!);
    const result = merger.resolve(source, NO_LIMITS);

    // Expression should be preserved despite type saying changeset is a List
    expect(result.getProperties()?.['changeset']?.getValue()).toBe(
      '${steps.CreateSubscriptions.changes}'
    );
  });

  test.skip('preserves nested property expressions', () => {
    nodeProvider.addSingleDocs(`
name: Complex Type
config:
  database:
    host: 
      type: Text
      value: localhost
    port:
      type: Integer
      value: 5432`);

    const yaml = `
type:
  blueId: ${nodeProvider.getBlueIdByName('Complex Type')}
config:
  database:
    host: "\${env.DB_HOST}"
    port: "\${env.DB_PORT}"`;

    const source = NodeDeserializer.deserialize(yamlBlueParse(yaml)!);
    const result = merger.resolve(source, NO_LIMITS);

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

    const source = NodeDeserializer.deserialize(yamlBlueParse(yaml)!);
    const result = merger.resolve(source, NO_LIMITS);

    // Regular values should be processed normally
    const changeset = result.getProperties()?.['changeset'];
    expect(changeset?.getItems()).toBeDefined();
    expect(
      changeset?.getItems()?.[0]?.getProperties()?.['val']?.getValue()
    ).toBe('regular value');
  });
});
