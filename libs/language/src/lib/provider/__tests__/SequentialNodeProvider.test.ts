import { describe, it, expect, vi } from 'vitest';
import { NodeProvider } from '../../NodeProvider';
import { SequentialNodeProvider } from '../SequentialNodeProvider';
import { BlueNode } from '../../model/Node';

describe('SequentialNodeProvider', () => {
  describe('fetchByBlueId', () => {
    it('should return empty array when no providers return results', () => {
      // Setup
      const provider1 = {
        fetchByBlueId: vi.fn().mockReturnValue([]),
      } as unknown as NodeProvider;
      const provider2 = {
        fetchByBlueId: vi.fn().mockReturnValue([]),
      } as unknown as NodeProvider;
      const sequentialProvider = new SequentialNodeProvider([
        provider1,
        provider2,
      ]);

      // Test
      const result = sequentialProvider.fetchByBlueId('test-id');

      // Verify
      expect(result).toEqual([]);
      expect(provider1.fetchByBlueId).toHaveBeenCalledWith('test-id');
      expect(provider2.fetchByBlueId).toHaveBeenCalledWith('test-id');
    });

    it('should return results from first provider that has results', () => {
      // Setup
      const node = new BlueNode();
      const provider1 = {
        fetchByBlueId: vi.fn().mockReturnValue([]),
      } as unknown as NodeProvider;
      const provider2 = {
        fetchByBlueId: vi.fn().mockReturnValue([node]),
      } as unknown as NodeProvider;
      const provider3 = { fetchByBlueId: vi.fn() } as unknown as NodeProvider;
      const sequentialProvider = new SequentialNodeProvider([
        provider1,
        provider2,
        provider3,
      ]);

      // Test
      const result = sequentialProvider.fetchByBlueId('test-id');

      // Verify
      expect(result).toEqual([node]);
      expect(provider1.fetchByBlueId).toHaveBeenCalledWith('test-id');
      expect(provider2.fetchByBlueId).toHaveBeenCalledWith('test-id');
      expect(provider3.fetchByBlueId).not.toHaveBeenCalled();
    });
  });

  describe('fetchFirstByBlueId', () => {
    it('should return null when no providers return results', () => {
      // Setup
      const provider1 = {
        fetchFirstByBlueId: vi.fn().mockReturnValue(null),
      } as unknown as NodeProvider;

      const provider2 = {
        fetchFirstByBlueId: vi.fn().mockReturnValue(null),
      } as unknown as NodeProvider;

      const sequentialProvider = new SequentialNodeProvider([
        provider1,
        provider2,
      ]);

      // Test
      const result = sequentialProvider.fetchFirstByBlueId('test-id');

      // Verify
      expect(result).toBeNull();
      expect(provider1.fetchFirstByBlueId).toHaveBeenCalledWith('test-id');
      expect(provider2.fetchFirstByBlueId).toHaveBeenCalledWith('test-id');
    });

    it('should return result from first provider that has a result', () => {
      // Setup
      const node = new BlueNode();
      const provider1 = {
        fetchFirstByBlueId: vi.fn().mockReturnValue(null),
      } as unknown as NodeProvider;

      const provider2 = {
        fetchFirstByBlueId: vi.fn().mockReturnValue(node),
      } as unknown as NodeProvider;

      const provider3 = {
        fetchFirstByBlueId: vi.fn(),
      } as unknown as NodeProvider;

      const sequentialProvider = new SequentialNodeProvider([
        provider1,
        provider2,
        provider3,
      ]);

      // Test
      const result = sequentialProvider.fetchFirstByBlueId('test-id');

      // Verify
      expect(result).toBe(node);
      expect(provider1.fetchFirstByBlueId).toHaveBeenCalledWith('test-id');
      expect(provider2.fetchFirstByBlueId).toHaveBeenCalledWith('test-id');
      expect(provider3.fetchFirstByBlueId).not.toHaveBeenCalled();
    });
  });

  describe('getNodeProviders', () => {
    it('should return the list of providers', () => {
      // Setup
      const provider1 = {} as unknown as NodeProvider;
      const provider2 = {} as unknown as NodeProvider;
      const sequentialProvider = new SequentialNodeProvider([
        provider1,
        provider2,
      ]);

      // Test
      const result = sequentialProvider.getNodeProviders();

      // Verify
      expect(result).toEqual([provider1, provider2]);
    });
  });
});
