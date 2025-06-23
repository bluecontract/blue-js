import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { BlueNode } from '../../model';
import { BlueNodeTypeSchema } from '../TypeSchema';
import { BlueIdResolver } from '../BlueIdResolver';
import { withTypeBlueId } from '../../../schema/annotations';
import { TypeSchemaResolver } from '../TypeSchemaResolver';

// Mock BlueIdResolver to control the blueId resolution
vi.mock('../BlueIdResolver', () => ({
  BlueIdResolver: {
    resolveBlueId: vi.fn(),
  },
}));

describe('BlueNodeTypeSchema', () => {
  const mockBlueIdResolver = BlueIdResolver as unknown as {
    resolveBlueId: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isTypeOf', () => {
    it('should return true when schema and node have matching blueIds', () => {
      // Arrange
      const testBlueId = 'test-blue-id-123';
      const schema = withTypeBlueId(testBlueId)(
        z.object({
          name: z.string(),
          age: z.number(),
        })
      );

      const nodeType = new BlueNode().setBlueId(testBlueId);
      const node = new BlueNode().setType(nodeType);

      mockBlueIdResolver.resolveBlueId.mockReturnValue(testBlueId);

      // Act
      const result = BlueNodeTypeSchema.isTypeOf(node, schema);

      // Assert
      expect(result).toBe(true);
      expect(mockBlueIdResolver.resolveBlueId).toHaveBeenCalledWith(schema);
    });

    it('should return false when schema and node have different blueIds', () => {
      // Arrange
      const schemaBlueId = 'schema-blue-id-123';
      const nodeBlueId = 'node-blue-id-456';
      const schema = withTypeBlueId(schemaBlueId)(
        z.object({
          name: z.string(),
        })
      );

      const nodeType = new BlueNode().setBlueId(nodeBlueId);
      const node = new BlueNode().setType(nodeType);

      mockBlueIdResolver.resolveBlueId.mockReturnValue(schemaBlueId);

      // Act
      const result = BlueNodeTypeSchema.isTypeOf(node, schema);

      // Assert
      expect(result).toBe(false);
      expect(mockBlueIdResolver.resolveBlueId).toHaveBeenCalledWith(schema);
    });

    it('should return false when node has no type', () => {
      // Arrange
      const schemaBlueId = 'schema-blue-id-123';
      const schema = withTypeBlueId(schemaBlueId)(
        z.object({
          name: z.string(),
        })
      );

      const node = new BlueNode(); // No type set

      mockBlueIdResolver.resolveBlueId.mockReturnValue(schemaBlueId);

      // Act
      const result = BlueNodeTypeSchema.isTypeOf(node, schema);

      // Assert
      expect(result).toBe(false);
      expect(mockBlueIdResolver.resolveBlueId).toHaveBeenCalledWith(schema);
    });

    it('should return true when schema extends another schema', () => {
      // Arrange
      const schema = withTypeBlueId('schema-blue-id-123')(
        z.object({
          name: z.string(),
        })
      );

      const extendedSchema = withTypeBlueId('extended-schema-blue-id-123')(
        schema.extend({
          age: z.number(),
        })
      );

      const node = new BlueNode().setType(
        new BlueNode().setBlueId('extended-schema-blue-id-123')
      );

      const typeSchemaResolver = new TypeSchemaResolver([schema]);
      mockBlueIdResolver.resolveBlueId.mockReturnValue(
        'extended-schema-blue-id-123'
      );

      // Act
      const result = BlueNodeTypeSchema.isTypeOf(node, extendedSchema, {
        typeSchemaResolver,
        checkSchemaExtensions: true,
      });

      // Assert
      expect(result).toBe(true);
    });
  });
});
