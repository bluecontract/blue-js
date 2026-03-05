import type { JsonObject } from '../core/types.js';

export class MyOsPermissions {
  private readValue: boolean | undefined;
  private writeValue: boolean | undefined;
  private allOpsValue: boolean | undefined;
  private singleOpsValue: string[] = [];

  static create(): MyOsPermissions {
    return new MyOsPermissions();
  }

  read(value: boolean): this {
    this.readValue = value;
    return this;
  }

  write(value: boolean): this {
    this.writeValue = value;
    return this;
  }

  allOps(value: boolean): this {
    this.allOpsValue = value;
    return this;
  }

  singleOps(...operations: string[]): this {
    this.singleOpsValue = operations
      .map((operation) => operation.trim())
      .filter((operation) => operation.length > 0);
    return this;
  }

  build(): JsonObject {
    const result: JsonObject = {};
    if (this.readValue !== undefined) {
      result.read = this.readValue;
    }
    if (this.writeValue !== undefined) {
      result.write = this.writeValue;
    }
    if (this.allOpsValue !== undefined) {
      result.allOps = this.allOpsValue;
    }
    if (this.singleOpsValue.length > 0) {
      result.singleOps = [...this.singleOpsValue];
    }
    return result;
  }
}
