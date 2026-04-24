import { describe, it, expect } from 'vitest';
import { ValuePropagator } from '../processors/ValuePropagator';
import { SequentialMergingProcessor } from '../processors/SequentialMergingProcessor';
import { Merger } from '../Merger';
import { NodeDeserializer } from '../../model';
import { yamlBlueParse } from '../../../utils/yamlBlue';
import { NO_LIMITS } from '../../utils/limits';
import { JsonBlueValue } from '../../../schema';
import { BasicNodeProvider } from '../../provider/BasicNodeProvider';

describe('ValuePropagator', () => {
  it('testValueShouldPropagate - should propagate value from source to target when target has no value', () => {
    const aYaml = `name: A
value: xyz`;

    const bYaml = `name: B
type:
  name: A
  value: xyz`;

    // Parse YAML documents
    const aDoc = yamlBlueParse(aYaml) as JsonBlueValue;
    const bDoc = yamlBlueParse(bYaml) as JsonBlueValue;

    // Convert to BlueNode objects
    const nodeA = NodeDeserializer.deserialize(aDoc);
    const nodeB = NodeDeserializer.deserialize(bDoc);

    // Store only the referenced type. The source under test is resolved
    // directly so provider ingest does not reject resolver-invalid content.
    const nodeProvider = new BasicNodeProvider([nodeA]);

    // Create merging processor with ValuePropagator
    const mergingProcessor = new SequentialMergingProcessor([
      new ValuePropagator(),
    ]);

    // Create merger and resolve
    const merger = new Merger(mergingProcessor, nodeProvider);
    const resolvedNode = merger.resolve(nodeB, NO_LIMITS);

    // Assert that value was propagated
    expect(resolvedNode.getValue()).toBe('xyz');
  });

  it('testValuesMustNotConflict - should throw error when source and target values conflict', () => {
    const aYaml = `name: A
value: xyz`;

    const bYaml = `name: B
value: abc
type:
  name: A
  value: xyz`;

    // Parse YAML documents
    const aDoc = yamlBlueParse(aYaml) as JsonBlueValue;
    const bDoc = yamlBlueParse(bYaml) as JsonBlueValue;

    // Convert to BlueNode objects
    const nodeA = NodeDeserializer.deserialize(aDoc);
    const nodeB = NodeDeserializer.deserialize(bDoc);

    // Store only the referenced type. The source under test is resolved
    // directly so provider ingest does not reject resolver-invalid content.
    const nodeProvider = new BasicNodeProvider([nodeA]);

    // Create merging processor with ValuePropagator
    const mergingProcessor = new SequentialMergingProcessor([
      new ValuePropagator(),
    ]);

    // Create merger
    const merger = new Merger(mergingProcessor, nodeProvider);

    // Assert that error is thrown for conflicting values
    expect(() => merger.resolve(nodeB, NO_LIMITS)).toThrow(
      'Node values conflict. Source node value: abc, target node value: xyz',
    );
  });
});
