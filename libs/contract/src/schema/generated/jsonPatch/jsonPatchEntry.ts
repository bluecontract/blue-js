import { BaseBlueObject, BlueObjectStringValue } from '@blue-company/language';

interface JsonPatchOperationEntry extends BaseBlueObject {
  value?: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
}

export interface JsonPatchEntry extends BaseBlueObject {
  op?: JsonPatchOperationEntry;
  path?: BlueObjectStringValue;
  val?: BlueObjectStringValue;
}
