import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { BlueNode } from '../../model';
import { BlueNodeTypeSchema } from '../TypeSchema';
import { BlueIdResolver } from '../BlueIdResolver';
import { withTypeBlueId } from '../../../schema/annotations';
import { TypeSchemaResolver } from '../TypeSchemaResolver';
import { BasicNodeProvider } from '../../provider/BasicNodeProvider';

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
        }),
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
        }),
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
        }),
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
        }),
      );

      const extendedSchema = withTypeBlueId('extended-schema-blue-id-123')(
        schema.extend({
          age: z.number(),
        }),
      );

      const node = new BlueNode().setType(
        new BlueNode().setBlueId('extended-schema-blue-id-123'),
      );

      const typeSchemaResolver = new TypeSchemaResolver([schema]);
      mockBlueIdResolver.resolveBlueId.mockReturnValue(
        'extended-schema-blue-id-123',
      );

      // Act
      const result = BlueNodeTypeSchema.isTypeOf(node, extendedSchema, {
        typeSchemaResolver,
        checkSchemaExtensions: true,
      });

      // Assert
      expect(result).toBe(true);
    });

    it('should check schema extensions across multiple levels when enabled', () => {
      // Arrange
      const schemaA = withTypeBlueId('schema-blue-id-a')(
        z.object({
          value: z.string(),
        }),
      );

      const schemaB = withTypeBlueId('schema-blue-id-b')(
        schemaA.extend({
          flag: z.boolean(),
        }),
      );

      const schemaC = withTypeBlueId('schema-blue-id-c')(
        schemaB.extend({
          count: z.number(),
        }),
      );

      mockBlueIdResolver.resolveBlueId.mockImplementation((schema) => {
        if (schema === schemaA) {
          return 'schema-blue-id-a';
        }
        if (schema === schemaB) {
          return 'schema-blue-id-b';
        }
        if (schema === schemaC) {
          return 'schema-blue-id-c';
        }
        return undefined;
      });

      const typeSchemaResolver = new TypeSchemaResolver([
        schemaA,
        schemaB,
        schemaC,
      ]);
      // Provide nodeProvider to establish C -> B -> A inheritance by blueId via YAML docs
      const provider = new BasicNodeProvider();
      provider.addSingleDocs(
        `blueId: schema-blue-id-a\nname: A`,
        `blueId: schema-blue-id-b\nname: B\ntype:\n  blueId: schema-blue-id-a`,
        `blueId: schema-blue-id-c\nname: C\ntype:\n  blueId: schema-blue-id-b`,
      );
      typeSchemaResolver.setNodeProvider(provider);
      const node = new BlueNode().setType(
        new BlueNode().setBlueId('schema-blue-id-c'),
      );

      // Act
      const result = BlueNodeTypeSchema.isTypeOf(node, schemaB, {
        typeSchemaResolver,
        checkSchemaExtensions: true,
      });

      // Assert
      expect(result).toBe(true);

      const resultBase = BlueNodeTypeSchema.isTypeOf(node, schemaA, {
        typeSchemaResolver,
        checkSchemaExtensions: true,
      });

      expect(resultBase).toBe(true);
    });
  });
});
