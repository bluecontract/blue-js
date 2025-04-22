import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateBlueId, calculateBlueIdSync } from '../calculateBlueId';
import { BlueIdCalculator, NodeDeserializer } from '../../../lib';
import { BlueNode } from '../../../lib/model/Node';
import { JsonBlueValue } from '../../../schema';

// Mock dependencies
vi.mock('../../../lib', () => ({
  BlueIdCalculator: {
    calculateBlueId: vi.fn().mockResolvedValue('mock-blue-id'),
    calculateBlueIdSync: vi.fn().mockReturnValue('mock-blue-id-sync'),
  },
  NodeDeserializer: {
    deserialize: vi.fn(() => new BlueNode()),
  },
}));

vi.mock('../../../lib/model/Node', () => ({
  BlueNode: class BlueNode {
    // Mock class without constructor
  },
}));

describe('calculateBlueId functions', () => {
  let mockNode: BlueNode;
  let mockNodeArray: BlueNode[];
  let mockJsonValue: JsonBlueValue;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup test data
    mockNode = new BlueNode();
    mockNodeArray = [new BlueNode(), new BlueNode()];
    mockJsonValue = { type: 'string' };
  });

  describe('calculateBlueId (async)', () => {
    it('should directly use BlueIdCalculator for BlueNode input', async () => {
      const result = await calculateBlueId(mockNode);

      expect(BlueIdCalculator.calculateBlueId).toHaveBeenCalledWith(mockNode);
      expect(NodeDeserializer.deserialize).not.toHaveBeenCalled();
      expect(result).toBe('mock-blue-id');
    });

    it('should directly use BlueIdCalculator for BlueNode array input', async () => {
      const result = await calculateBlueId(mockNodeArray);

      expect(BlueIdCalculator.calculateBlueId).toHaveBeenCalledWith(
        mockNodeArray
      );
      expect(NodeDeserializer.deserialize).not.toHaveBeenCalled();
      expect(result).toBe('mock-blue-id');
    });

    it('should deserialize JSON input before calculation', async () => {
      const result = await calculateBlueId(mockJsonValue);

      expect(NodeDeserializer.deserialize).toHaveBeenCalledWith(mockJsonValue);
      expect(BlueIdCalculator.calculateBlueId).toHaveBeenCalled();
      expect(result).toBe('mock-blue-id');
    });

    it('should deserialize each item in a non-BlueNode array', async () => {
      const jsonArray = [{ type: 'string' }, { type: 'number' }];
      const result = await calculateBlueId(jsonArray);

      expect(NodeDeserializer.deserialize).toHaveBeenCalledTimes(2);
      expect(BlueIdCalculator.calculateBlueId).toHaveBeenCalled();
      expect(result).toBe('mock-blue-id');
    });
  });

  describe('calculateBlueIdSync', () => {
    it('should directly use BlueIdCalculator for BlueNode input', () => {
      const result = calculateBlueIdSync(mockNode);

      expect(BlueIdCalculator.calculateBlueIdSync).toHaveBeenCalledWith(
        mockNode
      );
      expect(NodeDeserializer.deserialize).not.toHaveBeenCalled();
      expect(result).toBe('mock-blue-id-sync');
    });

    it('should directly use BlueIdCalculator for BlueNode array input', () => {
      const result = calculateBlueIdSync(mockNodeArray);

      expect(BlueIdCalculator.calculateBlueIdSync).toHaveBeenCalledWith(
        mockNodeArray
      );
      expect(NodeDeserializer.deserialize).not.toHaveBeenCalled();
      expect(result).toBe('mock-blue-id-sync');
    });

    it('should deserialize JSON input before calculation', () => {
      const result = calculateBlueIdSync(mockJsonValue);

      expect(NodeDeserializer.deserialize).toHaveBeenCalledWith(mockJsonValue);
      expect(BlueIdCalculator.calculateBlueIdSync).toHaveBeenCalled();
      expect(result).toBe('mock-blue-id-sync');
    });

    it('should deserialize each item in a non-BlueNode array', () => {
      const jsonArray = [{ type: 'string' }, { type: 'number' }];
      const result = calculateBlueIdSync(jsonArray);

      expect(NodeDeserializer.deserialize).toHaveBeenCalledTimes(2);
      expect(BlueIdCalculator.calculateBlueIdSync).toHaveBeenCalled();
      expect(result).toBe('mock-blue-id-sync');
    });
  });
});
