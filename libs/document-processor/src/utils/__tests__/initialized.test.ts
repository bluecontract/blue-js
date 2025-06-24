import { describe, it, expect, beforeEach } from 'vitest';
import { Blue } from '@blue-labs/language';
import { ensureInitializedContract } from '../initialized';
import { repository as coreRepository } from '@blue-repository/core-dev';
import { JsonObject } from '@blue-labs/shared-utils';

describe('ensureInitializedContract', () => {
  let blue: Blue;

  beforeEach(() => {
    blue = new Blue({
      repositories: [coreRepository],
    });
  });

  it('should add initialized contract when it does not exist', () => {
    const doc: JsonObject = {
      name: 'Test Document',
      contracts: {
        someExistingContract: {
          type: 'Timeline Channel',
          timelineId: 'test-timeline',
        },
      },
    };

    const docNode = blue.jsonValueToNode(doc);
    const result = ensureInitializedContract(docNode, blue);
    const jsonResult = blue.nodeToJson(result, 'simple') as any;

    expect(jsonResult.contracts.initialized).toBeDefined();
    expect(jsonResult.contracts.initialized.type.name).toBe(
      'Initialized Marker'
    );
  });

  it('should overwrite existing initialized contract if the name is the same', () => {
    const doc: JsonObject = {
      name: 'Test Document',
      contracts: {
        initialized: {
          type: {
            name: 'Custom Initialized',
            blueId: 'custom-id',
          },
          customField: 'existing-value',
        },
      },
    };

    const docNode = blue.jsonValueToNode(doc);
    const result = ensureInitializedContract(docNode, blue);
    const jsonResult = blue.nodeToJson(result, 'simple') as any;

    expect(jsonResult.contracts.initialized.type.name).toBe(
      'Initialized Marker'
    );
    expect(jsonResult.contracts.initialized.type.blueId).not.toBe('custom-id');
    expect(jsonResult.contracts.initialized.customField).toBeUndefined();
  });

  it('should add initialized contract even when no contracts exist initially', () => {
    const doc: JsonObject = {
      name: 'Test Document',
      // no contracts property
    };

    const docNode = blue.jsonValueToNode(doc);
    const result = ensureInitializedContract(docNode, blue);
    const jsonResult = blue.nodeToJson(result, 'simple') as any;

    // Should create contracts object and add initialized contract
    expect(jsonResult.contracts).toBeDefined();
    expect(jsonResult.contracts.initialized).toBeDefined();
    expect(jsonResult.contracts.initialized.type.name).toBe(
      'Initialized Marker'
    );
  });

  it('should clone the document (not mutate original)', () => {
    const doc: JsonObject = {
      name: 'Test Document',
      contracts: {},
    };

    const docNode = blue.jsonValueToNode(doc);
    const result = ensureInitializedContract(docNode, blue);

    // Original should not have the initialized contract
    const originalJson = blue.nodeToJson(docNode, 'simple') as any;
    expect(originalJson.contracts?.initialized).toBeUndefined();

    // Result should have the initialized contract
    const resultJson = blue.nodeToJson(result, 'simple') as any;
    expect(resultJson.contracts.initialized).toBeDefined();
  });
});
