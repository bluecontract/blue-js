import type { DocBuilder } from './doc-builder.js';
import type { BlueObject, BlueTypeInput, BlueValue } from '../types.js';
import { resolveTypeInput } from '../internal/type-resolver.js';
import { StepsBuilder } from './steps-builder.js';

export class OperationBuilder {
  private readonly contract: BlueObject;
  private readonly implementationSteps = new StepsBuilder();
  private implementationKey: string;

  public constructor(
    private readonly parent: DocBuilder,
    private readonly operationKey: string,
  ) {
    this.contract = {
      type: 'Conversation/Operation',
      channel: operationKey,
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
    this.contract.request = {
      type: resolveTypeInput(typeInput),
    };
    return this;
  }

  public request(request: BlueValue): this {
    this.contract.request = request;
    return this;
  }

  public implementation(keyOrFactory: string | ((steps: StepsBuilder) => void)): this {
    if (typeof keyOrFactory === 'string') {
      this.implementationKey = keyOrFactory;
      return this;
    }
    keyOrFactory(this.implementationSteps);
    return this;
  }

  public steps(factory: (steps: StepsBuilder) => void): this {
    factory(this.implementationSteps);
    return this;
  }

  public done(): DocBuilder {
    this.parent.contract(this.operationKey, this.contract);
    if (this.implementationSteps.build().length > 0) {
      this.parent.workflow(this.implementationKey, {
        type: 'Conversation/Sequential Workflow Operation',
        operation: this.operationKey,
        steps: this.implementationSteps.build(),
      });
    }
    return this.parent;
  }
}
