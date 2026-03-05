import { expr } from '../expr.js';
import type { BlueObject, BlueValue } from '../types.js';

export class ChangesetBuilder {
  private readonly operations: BlueObject[];

  public constructor(initial?: BlueObject[]) {
    this.operations = initial ?? [];
  }

  public add(path: string, value: BlueValue): this {
    this.operations.push({
      op: 'add',
      path,
      value,
    });
    return this;
  }

  public replace(path: string, value: BlueValue): this {
    this.operations.push({
      op: 'replace',
      path,
      value,
    });
    return this;
  }

  public replaceExpression(path: string, expression: string): this {
    this.operations.push({
      op: 'replace',
      path,
      value: expr(expression),
    });
    return this;
  }

  public remove(path: string): this {
    this.operations.push({
      op: 'remove',
      path,
    });
    return this;
  }

  public raw(change: BlueObject): this {
    this.operations.push(change);
    return this;
  }

  public build(): BlueObject[] {
    return this.operations;
  }
}
