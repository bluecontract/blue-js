import { describe, it, expect, vi } from 'vitest';
import { Merger } from '../Merger';
import { MergingProcessor } from '../MergingProcessor';
import { BlueNode } from '../../model';
import { createNodeProvider } from '../../NodeProvider';
import { NO_LIMITS } from '../../utils/limits';
import { BasicNodeProvider } from '../../provider';
import { createDefaultMergingProcessor } from '../utils/default';
import { Blue } from '../../Blue';

describe('Merger', () => {
  const basicMergingProcessor = (target: BlueNode, source: BlueNode) => {
    if (source.getValue() !== undefined) {
      return target.clone().setValue(source.getValue()!);
    }
    return target;
  };

  it('should create a Merger instance', () => {
    const mockProcessor: MergingProcessor = {
      process: vi.fn(),
    };
    const mockProvider = createNodeProvider(() => []);

    const merger = new Merger(mockProcessor, mockProvider);
    expect(merger).toBeInstanceOf(Merger);
  });

  it('should resolve a simple node', () => {
    const processFn = vi.fn(basicMergingProcessor);
    const mockProcessor: MergingProcessor = {
      process: processFn,
    };
    const mockProvider = createNodeProvider(() => []);

    const merger = new Merger(mockProcessor, mockProvider);
    const sourceNode = new BlueNode('TestNode')
      .setDescription('A test node')
      .setValue('test value');

    const resolved = merger.resolve(sourceNode, NO_LIMITS);

    expect(resolved.getName()).toBe('TestNode');
    expect(resolved.getDescription()).toBe('A test node');
    expect(resolved.getValue()).toBe('test value');
    expect(processFn).toHaveBeenCalled();
  });

  it('should throw error if source has blue attribute', () => {
    const mockProcessor: MergingProcessor = {
      process: vi.fn(),
    };
    const mockProvider = createNodeProvider(() => []);

    const merger = new Merger(mockProcessor, mockProvider);
    const target = new BlueNode();
    const source = new BlueNode().setBlue(new BlueNode());

    expect(() => merger.merge(target, source, NO_LIMITS)).toThrow(
      'Document contains "blue" attribute. Preprocess document before merging.'
    );
  });

  it('should merge properties', () => {
    const mockProcessor: MergingProcessor = {
      process: vi.fn(basicMergingProcessor),
    };
    const mockProvider = createNodeProvider(() => []);

    const merger = new Merger(mockProcessor, mockProvider);
    const sourceNode = new BlueNode('TestNode').setProperties({
      prop1: new BlueNode().setValue('value1'),
      prop2: new BlueNode().setValue('value2'),
    });

    const resolved = merger.resolve(sourceNode, NO_LIMITS);

    expect(resolved.getProperties()).toBeDefined();
    expect(resolved.getProperties()?.prop1?.getValue()).toBe('value1');
    expect(resolved.getProperties()?.prop2?.getValue()).toBe('value2');
  });

  it('should merge contracts', () => {
    const mockProcessor: MergingProcessor = {
      process: vi.fn(basicMergingProcessor),
    };
    const mockProvider = createNodeProvider(() => []);

    const merger = new Merger(mockProcessor, mockProvider);
    const sourceNode = new BlueNode('TestNode').setContracts({
      contract1: new BlueNode().setValue('c-value1'),
      contract2: new BlueNode().setValue('c-value2'),
    });

    const resolved = merger.resolve(sourceNode, NO_LIMITS);

    expect(resolved.getContracts()).toBeDefined();
    expect(resolved.getContracts()?.contract1?.getValue()).toBe('c-value1');
    expect(resolved.getContracts()?.contract2?.getValue()).toBe('c-value2');
  });

  it('should call postProcess if defined', () => {
    const postProcessFn = vi.fn((target: BlueNode) => target);
    const mockProcessor: MergingProcessor = {
      process: vi.fn((target: BlueNode) => target),
      postProcess: postProcessFn,
    };
    const mockProvider = createNodeProvider(() => []);

    const merger = new Merger(mockProcessor, mockProvider);
    const sourceNode = new BlueNode('TestNode');

    merger.resolve(sourceNode, NO_LIMITS);

    expect(postProcessFn).toHaveBeenCalled();
  });

  it('should work with defaultMergingProcessor', () => {
    const mockProvider = createNodeProvider(() => []);

    /**
     * Default MergingProcessor that copies basic node properties
     */
    const defaultMergingProcessor: MergingProcessor = {
      process(target: BlueNode, source: BlueNode): BlueNode {
        // Copy basic properties from source to target
        if (source.getValue() !== undefined) {
          target.setValue(source.getValue()!);
        }
        if (source.getType() !== undefined) {
          target.setType(source.getType());
        }
        if (source.getItemType() !== undefined) {
          target.setItemType(source.getItemType());
        }
        if (source.getKeyType() !== undefined) {
          target.setKeyType(source.getKeyType());
        }
        if (source.getValueType() !== undefined) {
          target.setValueType(source.getValueType());
        }
        return target;
      },
    };
    const merger = new Merger(defaultMergingProcessor, mockProvider);

    const sourceNode = new BlueNode('TestNode')
      .setValue('test value')
      .setType(new BlueNode().setValue('String'));

    const resolved = merger.resolve(sourceNode, NO_LIMITS);

    expect(resolved.getValue()).toBe('test value');
    expect(resolved.getType()?.getValue()).toBe('String');
  });

  describe('integration test', () => {
    let nodeProvider: BasicNodeProvider;
    const defaultMergingProcessor = createDefaultMergingProcessor();

    beforeEach(() => {
      nodeProvider = new BasicNodeProvider();
    });

    it('should propagate metadata from source to target', () => {
      nodeProvider.addSingleDocs(`
name: Timeline Entry
message:
  description: This is a message of Timeline Entry
`);

      nodeProvider.addSingleDocs(`
name: My Entry
type:
  blueId: ${nodeProvider.getBlueIdByName('Timeline Entry')}
message:
  name: Start
`);

      const merger = new Merger(defaultMergingProcessor, nodeProvider);
      const myEntry = nodeProvider.findNodeByName('My Entry');

      if (!myEntry) {
        throw new Error('My Entry not found');
      }

      const resolved = merger.resolve(myEntry, NO_LIMITS);

      expect(resolved.getProperties()?.message?.getName()).toBe('Start');
    });

    it('should prefer type message name over source message name', () => {
      nodeProvider.addSingleDocs(`
name: Timeline Entry
message:
  name: Type Start
  description: This is a message of Timeline Entry
`);

      nodeProvider.addSingleDocs(`
name: My Entry
type:
  blueId: ${nodeProvider.getBlueIdByName('Timeline Entry')}
message:
  name: Start
`);

      const merger = new Merger(defaultMergingProcessor, nodeProvider);
      const myEntry = nodeProvider.findNodeByName('My Entry');

      if (!myEntry) {
        throw new Error('My Entry not found');
      }

      const resolved = merger.resolve(myEntry, NO_LIMITS);

      expect(resolved.getProperties()?.message?.getName()).toBe('Type Start');
    });

    it('should be idempotent when resolving the same node twice', () => {
      nodeProvider.addSingleDocs(`
name: Document Anchor
template:
  description: Optional Blue document template.
      `);

      nodeProvider.addSingleDocs(`
name: Document Anchors
type: Dictionary
keyType: Text
valueType:
  blueId: ${nodeProvider.getBlueIdByName('Document Anchor')}
      `);

      nodeProvider.addSingleDocs(`
name: My Entry
type:
  blueId: ${nodeProvider.getBlueIdByName('Document Anchors')}
anchor1:
  type:
    blueId: ${nodeProvider.getBlueIdByName('Document Anchor')}
anchor2:
  type:
    blueId: ${nodeProvider.getBlueIdByName('Document Anchor')}
      `);

      const blue = new Blue({ nodeProvider });

      const myEntry = nodeProvider.findNodeByName('My Entry');

      if (!myEntry) {
        throw new Error('My Entry not found');
      }

      const resolvedNode = blue.resolve(myEntry);
      const resolvedNode2 = blue.resolve(resolvedNode);

      expect(blue.nodeToJson(resolvedNode)).toEqual(
        blue.nodeToJson(resolvedNode2)
      );
    });
  });
});
