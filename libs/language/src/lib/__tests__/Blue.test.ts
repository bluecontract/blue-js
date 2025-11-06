import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Blue } from '../Blue';
import { NodeProvider } from '../NodeProvider';
import { TypeSchemaResolver } from '../utils/TypeSchemaResolver';

// Explicitly create NodeProvider implementation for testing
class MockNodeProvider extends NodeProvider {
  override fetchByBlueId() {
    return [];
  }
}

// Set up mocks with no reference to variables
vi.mock('../utils/NodeProviderWrapper', () => {
  return {
    NodeProviderWrapper: {
      wrap: vi.fn().mockImplementation((provider) => provider),
    },
  };
});

describe('Blue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with no arguments', () => {
      const blue = new Blue();
      expect(blue).toBeInstanceOf(Blue);
      expect(blue.getNodeProvider()).toBeDefined();
      expect(blue.getTypeSchemaResolver()).toBeInstanceOf(TypeSchemaResolver);
    });

    it('should create instance with NodeProvider only', () => {
      const nodeProvider = new MockNodeProvider();
      const blue = new Blue({ nodeProvider });

      expect(blue).toBeInstanceOf(Blue);
      expect(blue.getNodeProvider()).toBe(nodeProvider);
      expect(blue.getTypeSchemaResolver()).toBeInstanceOf(TypeSchemaResolver);
    });

    it('should create instance with TypeSchemaResolver only', () => {
      const mockTypeSchemaResolver = {
        resolveSchema: vi.fn(),
        getBlueIdMap: vi.fn().mockReturnValue(new Map()),
        setNodeProvider: vi.fn(),
      } as unknown as TypeSchemaResolver;
      const blue = new Blue({ typeSchemaResolver: mockTypeSchemaResolver });
      expect(blue).toBeInstanceOf(Blue);
      expect(blue.getNodeProvider()).toBeDefined();
      expect(blue.getTypeSchemaResolver()).toBe(mockTypeSchemaResolver);
    });

    it('should create instance with both NodeProvider and TypeSchemaResolver', () => {
      const nodeProvider = new MockNodeProvider();
      const typeResolver = {
        resolveSchema: vi.fn(),
        getBlueIdMap: vi.fn().mockReturnValue(new Map()),
        setNodeProvider: vi.fn(),
      } as unknown as TypeSchemaResolver;

      const blue = new Blue({
        nodeProvider,
        typeSchemaResolver: typeResolver,
      });

      expect(blue).toBeInstanceOf(Blue);
      expect(blue.getNodeProvider()).toBe(nodeProvider);
      expect(blue.getTypeSchemaResolver()).toBe(typeResolver);
    });
  });
});
