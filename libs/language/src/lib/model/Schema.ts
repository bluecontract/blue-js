import { BlueNode } from './Node';

export const SCHEMA_FIELDS = [
  'required',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minItems',
  'maxItems',
  'uniqueItems',
  'minFields',
  'maxFields',
] as const;

export type SchemaField = (typeof SCHEMA_FIELDS)[number];

export class Schema {
  private readonly fields: Partial<Record<SchemaField, BlueNode>> = {};
  private enumValues?: BlueNode[];

  public get(field: SchemaField): BlueNode | undefined {
    return this.fields[field];
  }

  public set(field: SchemaField, value: BlueNode | undefined): Schema {
    if (value === undefined) {
      delete this.fields[field];
    } else {
      this.fields[field] = value;
    }
    return this;
  }

  public getEnum(): BlueNode[] | undefined {
    return this.enumValues;
  }

  public setEnum(values: BlueNode[] | undefined): Schema {
    this.enumValues = values;
    return this;
  }

  public entries(): [SchemaField, BlueNode][] {
    return SCHEMA_FIELDS.flatMap((field) => {
      const value = this.fields[field];
      return value === undefined
        ? []
        : ([[field, value]] as [SchemaField, BlueNode][]);
    });
  }

  public clone(): Schema {
    const cloned = new Schema();
    for (const [field, value] of this.entries()) {
      cloned.set(field, value.clone());
    }
    cloned.setEnum(this.enumValues?.map((value) => value.clone()));
    return cloned;
  }
}
