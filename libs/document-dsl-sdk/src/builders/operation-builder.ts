import type { DocBuilder } from './doc-builder.js';
import type { BlueObject, BlueTypeInput, BlueValue } from '../types.js';
import { resolveTypeInput } from '../internal/type-resolver.js';
import { StepsBuilder } from './steps-builder.js';

export class OperationBuilder {
  private readonly contract: BlueObject;
  private readonly implementationSteps = new StepsBuilder();
  private implementationKey: string;
  private hasExplicitImplementation = false;

  public constructor(
    private readonly parent: DocBuilder,
    private readonly operationKey: string,
    initialContract?: BlueObject,
  ) {
    this.contract = initialContract ?? {
      type: 'Conversation/Operation',
    };
    this.implementationKey = `${operationKey}Impl`;
  }

  public type(type: string): this {
    this.contract.type = type;
    return this;
  }

  public channel(channelKey: string): this {
    this.contract.channel = channelKey;
    return this;
  }

  public description(description: string): this {
    this.contract.description = description;
    return this;
  }

  public requestType(typeInput: BlueTypeInput): this {
    const request =
      (this.contract.request &&
      typeof this.contract.request === 'object' &&
      !Array.isArray(this.contract.request)
        ? (this.contract.request as Record<string, unknown>)
        : {}) ?? {};
    this.contract.request = {
      ...request,
      type: resolveTypeInput(typeInput),
    };
    return this;
  }

  public request(request: BlueValue): this {
    this.contract.request = request;
    return this;
  }

  public requestDescription(description: string): this {
    const request =
      (this.contract.request &&
      typeof this.contract.request === 'object' &&
      !Array.isArray(this.contract.request)
        ? (this.contract.request as Record<string, unknown>)
        : {}) ?? {};
    this.contract.request = {
      ...request,
      description,
    };
    return this;
  }

  public noRequest(): this {
    delete this.contract.request;
    return this;
  }

  public implementation(
    keyOrFactory: string | ((steps: StepsBuilder) => void),
  ): this {
    if (typeof keyOrFactory === 'string') {
      this.implementationKey = keyOrFactory;
      return this;
    }
    this.hasExplicitImplementation = true;
    keyOrFactory(this.implementationSteps);
    return this;
  }

  public steps(factory: (steps: StepsBuilder) => void): this {
    this.hasExplicitImplementation = true;
    factory(this.implementationSteps);
    return this;
  }

  public done(): DocBuilder {
    this.parent.contract(this.operationKey, this.contract);
    if (
      this.hasExplicitImplementation ||
      this.implementationSteps.build().length > 0
    ) {
      this.parent.workflow(this.implementationKey, {
        type: 'Conversation/Sequential Workflow Operation',
        operation: this.operationKey,
        steps: this.implementationSteps.build(),
      });
    }
    return this.parent;
  }
}
