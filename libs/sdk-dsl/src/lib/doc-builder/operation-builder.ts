import { StepsBuilder } from '../steps/steps-builder.js';
import { toTypeAlias, type TypeLike } from '../core/type-alias.js';
import type { JsonObject } from '../core/types.js';

export interface OperationDefinition {
  readonly key: string;
  readonly channelKey?: string;
  readonly description?: string;
  readonly request?: JsonObject;
  readonly clearRequest: boolean;
  readonly steps?: JsonObject[];
}

type OperationBuilderParent<P> = {
  applyOperationDefinition(definition: OperationDefinition): P;
};

function asRequestFromType(typeAlias: string): JsonObject {
  return { type: typeAlias };
}

export class OperationBuilder<P> {
  private channelKey: string | undefined;
  private descriptionValue: string | undefined;
  private requestSchemaValue: JsonObject | undefined;
  private clearRequest = false;
  private stepsValue: JsonObject[] | undefined;

  constructor(
    private readonly parent: OperationBuilderParent<P>,
    private readonly key: string,
  ) {}

  channel(channelKey: string): this {
    this.channelKey = channelKey.trim();
    return this;
  }

  descriptionText(description: string): this {
    this.descriptionValue = description;
    return this;
  }

  description(description: string): this {
    return this.descriptionText(description);
  }

  requestType(typeLike: TypeLike): this {
    this.requestSchemaValue = asRequestFromType(toTypeAlias(typeLike));
    this.clearRequest = false;
    return this;
  }

  requestSchema(request: JsonObject): this {
    this.requestSchemaValue = structuredClone(request);
    this.clearRequest = false;
    return this;
  }

  request(request: JsonObject): this {
    return this.requestSchema(request);
  }

  requestDescription(description: string): this {
    const request = this.requestSchemaValue
      ? structuredClone(this.requestSchemaValue)
      : {};
    request.description = description;
    this.requestSchemaValue = request;
    this.clearRequest = false;
    return this;
  }

  noRequest(): this {
    this.requestSchemaValue = undefined;
    this.clearRequest = true;
    return this;
  }

  stepsList(steps: JsonObject[]): this {
    this.stepsValue = structuredClone(steps);
    return this;
  }

  steps(
    customizer: (steps: StepsBuilder) => void,
    existingBuilder?: StepsBuilder,
  ): this {
    const builder = existingBuilder ?? new StepsBuilder();
    customizer(builder);
    this.stepsValue = builder.build();
    return this;
  }

  done(): P {
    return this.parent.applyOperationDefinition({
      key: this.key,
      channelKey: this.channelKey,
      description: this.descriptionValue,
      request: this.requestSchemaValue,
      clearRequest: this.clearRequest,
      steps: this.stepsValue,
    });
  }
}
