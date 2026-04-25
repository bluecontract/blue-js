import { describe, expect, it } from 'vitest';
import { BlueErrorCode } from '../../errors/BlueError';
import { BlueNode } from '../../model';
import { StorageShapeValidator } from '../StorageShapeValidator';

describe('StorageShapeValidator', () => {
  it('rejects value plus items payloads', () => {
    const node = new BlueNode().setValue('value').setItems([]);

    expect(() => StorageShapeValidator.validateStorageShape(node)).toThrow(
      expect.objectContaining({ code: BlueErrorCode.INVALID_STORAGE_SHAPE }),
    );
  });

  it('rejects value plus object child fields', () => {
    const node = new BlueNode().setValue('value').setProperties({
      child: new BlueNode().setValue('child'),
    });

    expect(() => StorageShapeValidator.validateStorageShape(node)).toThrow(
      expect.objectContaining({ code: BlueErrorCode.INVALID_STORAGE_SHAPE }),
    );
  });

  it('rejects items plus object child fields', () => {
    const node = new BlueNode().setItems([]).setProperties({
      child: new BlueNode().setValue('child'),
    });

    expect(() => StorageShapeValidator.validateStorageShape(node)).toThrow(
      expect.objectContaining({ code: BlueErrorCode.INVALID_STORAGE_SHAPE }),
    );
  });

  it('rejects the document-level properties key', () => {
    const node = new BlueNode().setProperties({
      properties: new BlueNode().setValue('internal detail'),
    });

    expect(() => StorageShapeValidator.validateStorageShape(node)).toThrow(
      expect.objectContaining({ code: BlueErrorCode.INVALID_STORAGE_SHAPE }),
    );
  });

  it('allows value payloads with reserved metadata properties', () => {
    const node = new BlueNode().setValue('value').setProperties({
      schema: new BlueNode().setProperties({
        minLength: new BlueNode().setValue(1),
      }),
      mergePolicy: new BlueNode().setValue('positional'),
      contracts: new BlueNode().setProperties({
        workflow: new BlueNode().setValue('contract'),
      }),
    });

    expect(() =>
      StorageShapeValidator.validateStorageShape(node),
    ).not.toThrow();
  });

  it('keeps blueId plus payload under the specific ambiguous reference error', () => {
    const node = new BlueNode()
      .setReferenceBlueId('ReferenceBlueId')
      .setProperties({
        child: new BlueNode().setValue('child'),
      });

    expect(() => StorageShapeValidator.validateStorageShape(node)).toThrow(
      expect.objectContaining({
        code: BlueErrorCode.AMBIGUOUS_BLUE_ID_PAYLOAD,
      }),
    );
  });
});
