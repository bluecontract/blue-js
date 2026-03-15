import { toTypeAlias, type TypeLike } from '../core/type-alias.js';
import type { JsonValue } from '../core/types.js';

export interface FieldMetadata {
  readonly path: string;
  readonly typeAlias?: string;
  readonly description?: string;
  readonly value?: JsonValue;
  readonly hasExplicitValue: boolean;
  readonly required?: boolean;
  readonly minimum?: number;
  readonly maximum?: number;
}

type FieldBuilderParent<P> = {
  applyFieldMetadata(field: FieldMetadata): P;
};

export class FieldBuilder<P> {
  private typeAlias: string | undefined;
  private descriptionValue: string | undefined;
  private currentValue: JsonValue | undefined;
  private hasExplicitValue = false;
  private requiredValue: boolean | undefined;
  private minimumValueRef: number | undefined;
  private maximumValueRef: number | undefined;

  constructor(
    private readonly parent: FieldBuilderParent<P>,
    private readonly path: string,
  ) {}

  type(type: TypeLike): this {
    this.typeAlias = toTypeAlias(type);
    return this;
  }

  descriptionText(description: string): this {
    this.descriptionValue = description;
    return this;
  }

  description(description: string): this {
    return this.descriptionText(description);
  }

  valueOf(value: JsonValue): this {
    this.currentValue = value;
    this.hasExplicitValue = true;
    return this;
  }

  value(value: JsonValue): this {
    return this.valueOf(value);
  }

  requiredFlag(required: boolean): this {
    this.requiredValue = required;
    return this;
  }

  required(required: boolean): this {
    return this.requiredFlag(required);
  }

  minimumValue(minimum: number): this {
    this.minimumValueRef = minimum;
    return this;
  }

  minimum(minimum: number): this {
    return this.minimumValue(minimum);
  }

  maximumValue(maximum: number): this {
    this.maximumValueRef = maximum;
    return this;
  }

  maximum(maximum: number): this {
    return this.maximumValue(maximum);
  }

  done(): P {
    return this.parent.applyFieldMetadata({
      path: this.path,
      typeAlias: this.typeAlias,
      description: this.descriptionValue,
      value: this.currentValue,
      hasExplicitValue: this.hasExplicitValue,
      required: this.requiredValue,
      minimum: this.minimumValueRef,
      maximum: this.maximumValueRef,
    });
  }
}
