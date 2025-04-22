import { describe, it, expect, vi } from 'vitest';
import { NodeProvider, createNodeProvider } from '../NodeProvider';
import { BlueNode } from '../model/Node';

// Concrete implementation for testing abstract class
class TestNodeProvider extends NodeProvider {
  constructor(private mockFetchByBlueId: (blueId: string) => BlueNode[]) {
    super();
  }

  override fetchByBlueId(blueId: string): BlueNode[] {
    return this.mockFetchByBlueId(blueId);
  }
}

describe('NodeProvider', () => {
  describe('default implementation', () => {
    it('should return null from fetchFirstByBlueId when no nodes are found', () => {
      // Setup
      const mockFetchByBlueId = vi.fn().mockReturnValue([]);
      const provider = new TestNodeProvider(mockFetchByBlueId);

      // Test
      const result = provider.fetchFirstByBlueId('test-id');

      // Verify
      expect(result).toBeNull();
      expect(mockFetchByBlueId).toHaveBeenCalledWith('test-id');
    });

    it('should return first node from fetchFirstByBlueId when nodes are found', () => {
      // Setup
      const node1 = new BlueNode();
      const node2 = new BlueNode();
      const mockFetchByBlueId = vi.fn().mockReturnValue([node1, node2]);
      const provider = new TestNodeProvider(mockFetchByBlueId);

      // Test
      const result = provider.fetchFirstByBlueId('test-id');

      // Verify
      expect(result).toBe(node1);
      expect(mockFetchByBlueId).toHaveBeenCalledWith('test-id');
    });
  });

  describe('createNodeProvider', () => {
    it('should create a NodeProvider with the provided fetchByBlueId implementation', () => {
      // Setup
      const node = new BlueNode();
      const mockFetchByBlueId = vi.fn().mockReturnValue([node]);

      // Test
      const provider = createNodeProvider(mockFetchByBlueId);
      const result = provider.fetchByBlueId('test-id');

      // Verify
      expect(result).toEqual([node]);
      expect(mockFetchByBlueId).toHaveBeenCalledWith('test-id');
    });

    it('should use the default implementation for fetchFirstByBlueId', () => {
      // Setup
      const node = new BlueNode();
      const mockFetchByBlueId = vi.fn().mockReturnValue([node]);

      // Test
      const provider = createNodeProvider(mockFetchByBlueId);
      const result = provider.fetchFirstByBlueId('test-id');

      // Verify
      expect(result).toBe(node);
      expect(mockFetchByBlueId).toHaveBeenCalledWith('test-id');
    });
  });
});
