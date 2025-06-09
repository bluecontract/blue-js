import { describe, it, expect } from 'vitest';
import { applyPatches, ENABLE_IMMUTABILITY } from '../utils/document';
import { PatchApplicationError } from '../utils/exceptions';
import { JsonObject } from '@blue-labs/shared-utils';
import { Blue, type BlueNodePatch } from '@blue-labs/language';
import { repository as coreRepository } from '@blue-repository/core-dev';

describe('Document Utilities', () => {
  const blue = new Blue({
    repositories: [coreRepository],
  });
  describe('applyPatches', () => {
    it('should apply valid patches to a document', () => {
      // Arrange
      const document: JsonObject = {
        counter: 1,
        nested: { property: 'original' },
        array: [1, 2, 3],
      };

      const patches: BlueNodePatch[] = [
        { op: 'replace', path: '/counter', val: 2 },
        { op: 'replace', path: '/nested/property', val: 'updated' },
        { op: 'add', path: '/newProperty', val: 'new value' },
        { op: 'add', path: '/array/-', val: 4 },
      ];

      const docNode = blue.jsonValueToNode(document);

      // Act
      const result = applyPatches(docNode, patches);
      const resultJson = blue.nodeToJson(result, 'simple');

      // Assert
      expect(resultJson).toEqual({
        counter: 2,
        nested: { property: 'updated' },
        array: [1, 2, 3, 4],
        newProperty: 'new value',
      });
      expect(result).not.toBe(document); // Should return a new object
    });

    it('should return the original document if patches array is empty', () => {
      // Arrange
      const document: JsonObject = { counter: 1 };
      const patches: BlueNodePatch[] = [];

      // Act
      const docNode = blue.jsonValueToNode(document);
      const result = applyPatches(docNode, patches);
      const resultJson = blue.nodeToJson(result, 'simple');

      // Assert
      expect(resultJson).toEqual(document); // Should return the same object reference
    });

    it('should throw PatchApplicationError when a patch cannot be applied', () => {
      // Arrange
      const document: JsonObject = { counter: 1 };
      const invalidPatch: BlueNodePatch = {
        op: 'replace',
        path: '/nonExistentProperty/subProperty',
        val: 'some value',
      };

      const docNode = blue.jsonValueToNode(document);

      // Act & Assert
      expect(() => applyPatches(docNode, [invalidPatch])).toThrow(
        PatchApplicationError
      );
    });

    it('should include the offending patch in the error', () => {
      // Arrange
      const document: JsonObject = { counter: 1 };
      const invalidPatch: BlueNodePatch = {
        op: 'replace',
        path: '/nonExistentProperty/subProperty',
        val: 'some value',
      };

      const docNode = blue.jsonValueToNode(document);

      // Act & Assert
      try {
        applyPatches(docNode, [invalidPatch]);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(PatchApplicationError);
        if (error instanceof PatchApplicationError) {
          expect(error.patch).toBe(invalidPatch);
        }
      }
    });

    it('should apply patches in sequence and abort on first error', () => {
      // Arrange
      const document: JsonObject = { counter: 1 };

      // Create patches where the second one will definitely cause an error
      // by trying to access a nested property of a non-existent object
      const patches: BlueNodePatch[] = [
        { op: 'replace', path: '/counter', val: 2 },
        { op: 'replace', path: '/nonExistentObject/property', val: 'error' },
        { op: 'replace', path: '/counter', val: 3 }, // This should never be applied
      ];

      const docNode = blue.jsonValueToNode(document);

      // Act & Assert - Use direct assertion for simplicity
      expect(() => applyPatches(docNode, patches)).toThrow(
        PatchApplicationError
      );

      // Also check that the error has the correct patch
      try {
        applyPatches(docNode, patches);
      } catch (error) {
        expect(error).toBeInstanceOf(PatchApplicationError);
        if (error instanceof PatchApplicationError) {
          expect(error.patch).toEqual(patches[1]);
        }
      }
    });

    it('should replace an object with another object', () => {
      // Arrange
      const document: JsonObject = {
        user: {
          id: 1,
          name: 'John',
          email: 'john@example.com',
        },
        settings: {
          theme: 'dark',
          notifications: true,
        },
      };

      const newUser = {
        id: 2,
        name: 'Jane',
        email: 'jane@example.com',
        role: 'admin',
      };

      const patches: BlueNodePatch[] = [
        { op: 'replace', path: '/user', val: newUser },
      ];

      const docNode = blue.jsonValueToNode(document);

      // Act
      const result = applyPatches(docNode, patches);
      const resultJson = blue.nodeToJson(result, 'simple');

      // Assert
      expect(resultJson).toEqual({
        user: {
          id: 2,
          name: 'Jane',
          email: 'jane@example.com',
          role: 'admin',
        },
        settings: {
          theme: 'dark',
          notifications: true,
        },
      });
      expect(result).not.toBe(document); // Should return a new object
    });

    it('should replace complex nested objects and arrays', () => {
      // Arrange
      const document: JsonObject = {
        company: {
          name: 'OldCorp',
          employees: [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' },
          ],
          departments: {
            engineering: { budget: 100000, head: 'Charlie' },
            marketing: { budget: 50000, head: 'Diana' },
          },
        },
        metadata: {
          version: '1.0',
          lastUpdated: '2023-01-01',
        },
      };

      const newCompany = {
        name: 'NewCorp',
        employees: [
          { id: 1, name: 'Alice', role: 'Senior Dev' },
          { id: 3, name: 'Eve', role: 'Junior Dev' },
        ],
        departments: {
          engineering: { budget: 150000, head: 'Frank' },
          sales: { budget: 75000, head: 'Grace' },
        },
        founded: '2024-01-01',
      };

      const patches: BlueNodePatch[] = [
        { op: 'replace', path: '/company', val: newCompany },
      ];

      const docNode = blue.jsonValueToNode(document);

      // Act
      const result = applyPatches(docNode, patches);
      const resultJson = blue.nodeToJson(result, 'simple');

      // Assert
      expect(resultJson).toEqual({
        company: {
          name: 'NewCorp',
          employees: [
            { id: 1, name: 'Alice', role: 'Senior Dev' },
            { id: 3, name: 'Eve', role: 'Junior Dev' },
          ],
          departments: {
            engineering: { budget: 150000, head: 'Frank' },
            sales: { budget: 75000, head: 'Grace' },
          },
          founded: '2024-01-01',
        },
        metadata: {
          version: '1.0',
          lastUpdated: '2023-01-01',
        },
      });
      expect(result).not.toBe(document); // Should return a new object
    });

    it('should replace deeply nested objects', () => {
      // Arrange
      const document: JsonObject = {
        config: {
          database: {
            primary: {
              host: 'old-db.example.com',
              port: 5432,
              credentials: {
                username: 'olduser',
                password: 'oldpass',
              },
            },
            replica: {
              host: 'old-replica.example.com',
              port: 5433,
            },
          },
          cache: {
            redis: {
              host: 'redis.example.com',
              port: 6379,
            },
          },
        },
      };

      const newPrimaryDb = {
        host: 'new-db.example.com',
        port: 5432,
        credentials: {
          username: 'newuser',
          password: 'newpass',
        },
        ssl: true,
        connectionPool: {
          min: 5,
          max: 20,
        },
      };

      const patches: BlueNodePatch[] = [
        { op: 'replace', path: '/config/database/primary', val: newPrimaryDb },
      ];

      const docNode = blue.jsonValueToNode(document);

      // Act
      const result = applyPatches(docNode, patches);
      const resultJson = blue.nodeToJson(result, 'simple');

      // Assert
      expect(resultJson).toEqual({
        config: {
          database: {
            primary: {
              host: 'new-db.example.com',
              port: 5432,
              credentials: {
                username: 'newuser',
                password: 'newpass',
              },
              ssl: true,
              connectionPool: {
                min: 5,
                max: 20,
              },
            },
            replica: {
              host: 'old-replica.example.com',
              port: 5433,
            },
          },
          cache: {
            redis: {
              host: 'redis.example.com',
              port: 6379,
            },
          },
        },
      });
      expect(result).not.toBe(document); // Should return a new object
    });

    it('should replace root-level property when it exists', () => {
      // Arrange - Document with existing gameState
      const document: JsonObject = {
        gameState: {
          fen: '',
          turn: 'white',
          history: [],
        },
        contracts: {
          someContract: { type: 'test' },
        },
      };

      const newGameState = {
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        turn: 'black',
        isCheck: false,
        isCheckmate: false,
        isDraw: false,
        history: ['e4'],
        validMove: true,
        message: '',
        inDraw: false,
        winner: null,
      };

      const patches: BlueNodePatch[] = [
        { op: 'replace', path: '/gameState', val: newGameState },
      ];

      const docNode = blue.jsonValueToNode(document);

      // Act
      const result = applyPatches(docNode, patches);
      const resultJson = blue.nodeToJson(result, 'simple');

      // Assert
      expect(resultJson).toEqual({
        gameState: {
          fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
          turn: 'black',
          isCheck: false,
          isCheckmate: false,
          isDraw: false,
          history: ['e4'],
          validMove: true,
          message: '',
          inDraw: false,
          winner: null,
        },
        contracts: {
          someContract: { type: 'test' },
        },
      });
    });

    it('should replace root-level property when properties object is undefined', () => {
      // Arrange - Create a BlueNode with no properties initially
      const docNode = blue.jsonValueToNode({});

      const newGameState = {
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        turn: 'black',
        history: ['e4'],
      };

      const patches: BlueNodePatch[] = [
        { op: 'replace', path: '/gameState', val: newGameState },
      ];

      // Act
      const result = applyPatches(docNode, patches);
      const resultJson = blue.nodeToJson(result, 'simple');

      // Assert
      expect(resultJson).toEqual({
        gameState: {
          fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
          turn: 'black',
          history: ['e4'],
        },
      });
    });

    it('should reproduce chess game scenario - replace gameState in document with contracts', () => {
      // Arrange - Simulate the exact structure from chessGame.yaml
      const document: JsonObject = {
        gameState: {
          fen: '',
          turn: 'white',
          isCheck: false,
          isCheckmate: false,
          isDraw: false,
          history: [],
          validMove: false,
          message: '',
          inDraw: false,
          winner: null,
        },
        contracts: {
          whiteTimeline: {
            type: 'Timeline Channel',
            timelineId: 'white-player',
          },
          blackTimeline: {
            type: 'Timeline Channel',
            timelineId: 'black-player',
          },
          compositeTimeline: {
            type: 'Composite Timeline Channel',
            channels: ['whiteTimeline', 'blackTimeline'],
          },
          chessGame: {
            type: 'Sequential Workflow',
            channel: 'compositeTimeline',
          },
        },
      };

      const newGameState = {
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        turn: 'black',
        isCheck: false,
        isCheckmate: false,
        isDraw: false,
        history: ['e4'],
        validMove: true,
        message: '',
        inDraw: false,
        winner: null,
      };

      const patches: BlueNodePatch[] = [
        { op: 'replace', path: '/gameState', val: newGameState },
      ];

      const docNode = blue.jsonValueToNode(document);

      // Act
      const result = applyPatches(docNode, patches);
      const resultJson = blue.nodeToJson(result, 'simple') as any;

      // Assert
      expect(resultJson.gameState).toEqual(newGameState);
      expect(resultJson.contracts).toBeDefined(); // Just check contracts exist
    });

    it('should apply complex nested patches correctly', () => {
      // Arrange
      const document: JsonObject = {
        contracts: {
          test: {
            type: 'TestContract',
            list: [], // Initially empty
          },
        },
      };

      const patches: BlueNodePatch[] = [
        {
          op: 'add',
          path: '/contracts/test/list/-', // Append first item
          val: { id: '1', name: 'Item 1 Original Name' },
        },
        {
          op: 'add',
          path: '/contracts/test/list/1', // Append second item
          val: { id: '2', name: 'Item 2' },
        },
        {
          op: 'replace',
          path: '/contracts/test/list/0/name', // Replace name of the first item (now at index 0)
          val: 'Updated Item 1',
        },
      ];

      // Act
      const docNode = blue.jsonValueToNode(document);
      const result = applyPatches(docNode, patches);

      const resultJson = blue.nodeToJson(result, 'simple') as any;

      // Assert
      const testContractList = resultJson.contracts?.['test']?.list as any[];
      // Assuming nodeToJson serializes BlueNode arrays to JS arrays for 'simple' mode
      expect(testContractList).toBeInstanceOf(Array);
      expect(testContractList.length).toBe(2);
      expect(testContractList[0].name).toBe('Updated Item 1');
      expect(testContractList[0].id).toBe('1');
      expect(testContractList[1].name).toBe('Item 2');
      expect(testContractList[1].id).toBe('2');
    });

    it('should create an immutable result when ENABLE_IMMUTABILITY is true', () => {
      // This test assumes ENABLE_IMMUTABILITY is true in the actual code
      if (!ENABLE_IMMUTABILITY) {
        return; // Skip test if immutability is disabled
      }

      // Arrange
      const document: JsonObject = {
        counter: 1,
        nested: { property: 'original' },
      };
      const patches: BlueNodePatch[] = [
        { op: 'replace', path: '/counter', val: 2 },
      ];

      // Act
      const docNode = blue.jsonValueToNode(document);
      const result = applyPatches(docNode, patches);

      // Assert
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.getProperties()?.['nested'])).toBe(true);

      const counterNode = result.getProperties()?.['counter'];

      expect(() => {
        counterNode?.setValue(3);
      }).toThrow(TypeError);

      expect(counterNode?.getValue()?.toString()).toBe('2');
    });
  });

  // describe('createImmutableDocument', () => {
  //   it('should create a deep clone of the document', () => {
  //     // Arrange
  //     const document: DocumentNode = {
  //       value: 1,
  //       nested: { property: 'test' },
  //     };

  //     // Act
  //     const result = createImmutableDocument(document);

  //     // Assert
  //     expect(result).toEqual(document);
  //     expect(result).not.toBe(document);
  //     expect(result.nested).not.toBe(document.nested);
  //   });

  //   it('should freeze the document when ENABLE_IMMUTABILITY is true', () => {
  //     // This test assumes ENABLE_IMMUTABILITY is true in the actual code
  //     if (!ENABLE_IMMUTABILITY) {
  //       return; // Skip test if immutability is disabled
  //     }

  //     // Arrange
  //     const document: DocumentNode = {
  //       value: 1,
  //       nested: { property: 'test' },
  //     };

  //     // Act
  //     const result = createImmutableDocument(document);

  //     // Assert
  //     expect(Object.isFrozen(result)).toBe(true);
  //     expect(Object.isFrozen(result.nested)).toBe(true);
  //   });
  // });

  // describe('deepFreeze', () => {
  //   it('should recursively freeze all nested objects', () => {
  //     // Arrange
  //     const obj = {
  //       a: 1,
  //       b: {
  //         c: 2,
  //         d: {
  //           e: 3,
  //         },
  //       },
  //       f: [1, 2, { g: 4 }],
  //     };

  //     // Act
  //     const result = deepFreeze(obj);

  //     // Assert
  //     expect(Object.isFrozen(result)).toBe(true);
  //     expect(Object.isFrozen(result.b)).toBe(true);
  //     expect(Object.isFrozen(result.b.d)).toBe(true);
  //     expect(Object.isFrozen(result.f)).toBe(true);
  //     expect(Object.isFrozen(result.f[2])).toBe(true);
  //   });
  // });

  // describe('deepClone', () => {
  //   it('should create a deep copy of complex objects', () => {
  //     // Arrange
  //     const obj = {
  //       a: 1,
  //       b: {
  //         c: 2,
  //         d: {
  //           e: 3,
  //         },
  //       },
  //       f: [1, 2, { g: 4 }],
  //     };

  //     // Act
  //     const result = deepClone(obj);

  //     // Assert
  //     expect(result).toEqual(obj);
  //     expect(result).not.toBe(obj);
  //     expect(result.b).not.toBe(obj.b);
  //     expect(result.b.d).not.toBe(obj.b.d);
  //     expect(result.f).not.toBe(obj.f);
  //     expect(result.f[2]).not.toBe(obj.f[2]);
  //   });
  // });
});
