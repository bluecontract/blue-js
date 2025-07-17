import { describe, it, expect } from 'vitest';
import { ValuePropagator } from '../processors/ValuePropagator';
import { SequentialMergingProcessor } from '../processors/SequentialMergingProcessor';
import { Merger } from '../Merger';
import { InMemoryNodeProvider } from '../../provider/InMemoryNodeProvider';
import { NodeDeserializer } from '../../model';
import { yamlBlueParse } from '../../../utils/yamlBlue';
import { BlueIdCalculator } from '../../utils/BlueIdCalculator';
import { NO_LIMITS } from '../../utils/limits';
import { JsonBlueValue } from '../../../schema';

describe('ValuePropagator', () => {
  it('should propagate value from source to target when target has no value', () => {
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

    // Create node provider and add nodes
    const nodeProvider = new InMemoryNodeProvider();
    nodeProvider.addSingleNodes(nodeA, nodeB);

    // Create merging processor with ValuePropagator
    const mergingProcessor = new SequentialMergingProcessor([
      new ValuePropagator(),
    ]);

    // Create merger and resolve
    const merger = new Merger(mergingProcessor, nodeProvider);
    const blueIdB = BlueIdCalculator.calculateBlueIdSync(nodeB);
    const fetchedNodeB = nodeProvider.fetchByBlueId(blueIdB)[0];
    const resolvedNode = merger.resolve(fetchedNodeB, NO_LIMITS);

    // Assert that value was propagated
    expect(resolvedNode.getValue()).toBe('xyz');
  });

  it('should throw error when source and target values conflict', () => {
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

    // Create node provider and add nodes
    const nodeProvider = new InMemoryNodeProvider();
    nodeProvider.addSingleNodes(nodeA, nodeB);

    // Create merging processor with ValuePropagator
    const mergingProcessor = new SequentialMergingProcessor([
      new ValuePropagator(),
    ]);

    // Create merger
    const merger = new Merger(mergingProcessor, nodeProvider);
    const blueIdB = BlueIdCalculator.calculateBlueIdSync(nodeB);
    const fetchedNodeB = nodeProvider.fetchByBlueId(blueIdB)[0];

    // Assert that error is thrown for conflicting values
    expect(() => merger.resolve(fetchedNodeB, NO_LIMITS)).toThrow(
      'Node values conflict. Source node value: abc, target node value: xyz'
    );
  });
});
