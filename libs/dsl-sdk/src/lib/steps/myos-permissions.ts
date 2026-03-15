import type { JsonObject } from '../core/types.js';

function cloneObject(value: JsonObject): JsonObject {
  return structuredClone(value);
}

export function normalizeMyOsPermissionObject(value: JsonObject): JsonObject {
  return cloneObject(value);
}

export class MyOsPermissions {
  private readValue: boolean | undefined;
  private shareValue: boolean | undefined;
  private allOpsValue: boolean | undefined;
  private singleOpsValue: string[] = [];
  private singleOpsSet = false;

  static create(): MyOsPermissions {
    return new MyOsPermissions();
  }

  read(value: boolean): this {
    this.readValue = value;
    return this;
  }

  share(value: boolean): this {
    this.shareValue = value;
    return this;
  }

  allOps(value: boolean): this {
    this.allOpsValue = value;
    return this;
  }

  singleOps(...operations: Array<string | null | undefined>): this {
    this.singleOpsSet = true;
    this.singleOpsValue = operations
      .filter((operation): operation is string => typeof operation === 'string')
      .map((operation) => operation.trim())
      .filter((operation) => operation.length > 0);
    return this;
  }

  build(): JsonObject {
    const result: JsonObject = {};
    if (this.readValue !== undefined) {
      result.read = this.readValue;
    }
    if (this.shareValue !== undefined) {
      result.share = this.shareValue;
    }
    if (this.allOpsValue !== undefined) {
      result.allOps = this.allOpsValue;
    }
    if (this.singleOpsSet) {
      result.singleOps = [...this.singleOpsValue];
    }
    return result;
  }
}
