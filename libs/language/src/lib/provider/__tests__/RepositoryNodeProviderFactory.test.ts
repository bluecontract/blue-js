import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { RepositoryNodeProviderFactory } from '../RepositoryNodeProviderFactory';
import { BlueRepository } from '../../Blue';
import { InMemoryNodeProvider } from '../../provider/InMemoryNodeProvider';
import { withTypeBlueId } from '../../../schema/annotations';

describe('RepositoryNodeProviderFactory', () => {
  const personSchema = withTypeBlueId('Person-BlueId')(
    z.object({
      name: z.string(),
      age: z.number().optional(),
    })
  );

  describe('createDefinitionsProvider', () => {
    it('should return undefined when no repositories provided', () => {
      const result =
        RepositoryNodeProviderFactory.createDefinitionsProvider(undefined);
      expect(result).toBeUndefined();
    });

    it('should return undefined when repositories have no definitions', () => {
      const repositories: BlueRepository[] = [
        {
          blueIds: { Person: 'Person-BlueId' },
          schemas: [personSchema],
        },
      ];

      const result =
        RepositoryNodeProviderFactory.createDefinitionsProvider(repositories);
      expect(result).toBeUndefined();
    });

    it('should create InMemoryNodeProvider when definitions exist', () => {
      const repositories: BlueRepository[] = [
        {
          blueIds: { Person: 'Person-BlueId' },
          schemas: [personSchema],
          definitions: {
            'person-1': { name: 'John', age: 30 },
          },
        },
      ];

      const result =
        RepositoryNodeProviderFactory.createDefinitionsProvider(repositories);
      expect(result).toBeInstanceOf(InMemoryNodeProvider);
    });

    it('should add definitions to the provider', () => {
      const repositories: BlueRepository[] = [
        {
          blueIds: { Person: 'Person-BlueId' },
          schemas: [personSchema],
          definitions: {
            'person-1': { name: 'Alice', age: 25 },
          },
        },
      ];

      const provider =
        RepositoryNodeProviderFactory.createDefinitionsProvider(repositories);
      const nodes = provider!.fetchByBlueId('person-1');

      expect(nodes).toHaveLength(1);
      expect(nodes[0].getName()).toBe('Alice');
      expect(nodes[0].getProperties()?.age?.getValue()?.toString()).toBe('25');
    });

    it('should handle multiple repositories with definitions', () => {
      const repositories: BlueRepository[] = [
        {
          blueIds: { Person: 'Person-BlueId' },
          schemas: [personSchema],
          definitions: {
            'person-1': { name: 'John', age: 30 },
          },
        },
        {
          blueIds: { Person: 'Person-BlueId' },
          schemas: [personSchema],
          definitions: {
            'person-2': { name: 'Jane', age: 28 },
          },
        },
      ];

      const provider =
        RepositoryNodeProviderFactory.createDefinitionsProvider(repositories);

      const nodes1 = provider!.fetchByBlueId('person-1');
      const nodes2 = provider!.fetchByBlueId('person-2');

      expect(nodes1).toHaveLength(1);
      expect(nodes1[0].getName()).toBe('John');
      expect(nodes2).toHaveLength(1);
      expect(nodes2[0].getName()).toBe('Jane');
    });
  });
});
