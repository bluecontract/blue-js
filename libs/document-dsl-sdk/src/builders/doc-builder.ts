import { expr } from '../expr.js';
import { removeByPointer, setByPointer } from '../internal/path-utils.js';
import { resolveTypeInput } from '../internal/type-resolver.js';
import { toYaml } from '../internal/yaml.js';
import type {
  BlueContract,
  BlueDocument,
  BlueObject,
  BlueTypeInput,
  BlueValue,
  ChannelConfig,
  OperationConfig,
  SectionConfig,
  WorkflowConfig,
} from '../types.js';
import { OperationBuilder } from './operation-builder.js';
import { SectionContext } from './section-context.js';
import { StepsBuilder } from './steps-builder.js';
import {
  createChangeOperationContract,
  createChangeWorkflowContract,
  createContractsPolicyContract,
} from './helpers/change-helpers.js';
import {
  createChannelContract,
  createCompositeChannelContract,
} from './helpers/channel-helpers.js';
import {
  createDocumentAnchorsContract,
  createDocumentLinksContract,
} from './helpers/anchors-links-helpers.js';

const clone = <T>(value: T): T => structuredClone(value);

const asContracts = (doc: BlueDocument): Record<string, BlueContract> => {
  if (!doc.contracts || typeof doc.contracts !== 'object') {
    doc.contracts = {};
  }
  return doc.contracts as Record<string, BlueContract>;
};

const toSteps = (
  factory: ((steps: StepsBuilder) => void) | BlueObject[] | undefined,
): BlueObject[] => {
  if (!factory) {
    return [];
  }
  if (Array.isArray(factory)) {
    return factory;
  }
  const steps = new StepsBuilder();
  factory(steps);
  return steps.build();
};

export class DocBuilder {
  private currentSection: SectionContext | null = null;
  public static readonly expr = expr;

  private constructor(private readonly docNode: BlueDocument) {}

  public static doc(initial?: BlueDocument): DocBuilder {
    return new DocBuilder(clone(initial ?? {}));
  }

  public static from(document: BlueDocument): DocBuilder {
    return new DocBuilder(clone(document));
  }

  public static edit(document: BlueDocument): DocBuilder {
    return new DocBuilder(document);
  }

  public name(value: string): this {
    this.docNode.name = value;
    this.trackField('/name');
    return this;
  }

  public description(value: string): this {
    this.docNode.description = value;
    this.trackField('/description');
    return this;
  }

  public type(typeInput: BlueTypeInput): this {
    this.docNode.type = resolveTypeInput(typeInput) as BlueValue;
    this.trackField('/type');
    return this;
  }

  public field(pointer: string, value: BlueValue): this {
    setByPointer(this.docNode, pointer, value);
    this.trackField(pointer);
    return this;
  }

  public replace(pointer: string, value: BlueValue): this {
    return this.field(pointer, value);
  }

  public remove(pointer: string): this {
    removeByPointer(this.docNode, pointer);
    this.trackField(pointer);
    return this;
  }

  public contract(key: string, contract: BlueContract): this {
    asContracts(this.docNode)[key] = contract;
    this.trackContract(key);
    return this;
  }

  public contracts(contracts: Record<string, BlueContract>): this {
    for (const [key, contract] of Object.entries(contracts)) {
      this.contract(key, contract);
    }
    return this;
  }

  public channel(key: string, config?: ChannelConfig): this {
    const channelType = config?.type ?? 'Core/Channel';
    const rest = { ...(config ?? {}) } as Record<string, BlueValue>;
    delete rest.type;
    this.contract(key, createChannelContract(channelType, rest));
    return this;
  }

  public channels(...keys: string[]): this {
    keys.forEach((key) => this.channel(key));
    return this;
  }

  public compositeChannel(key: string, channels: string[]): this;
  public compositeChannel(key: string, ...channels: string[]): this;
  public compositeChannel(
    key: string,
    ...channelsOrList: string[] | [string[]]
  ): this {
    const channels =
      channelsOrList.length === 1 && Array.isArray(channelsOrList[0])
        ? channelsOrList[0]
        : (channelsOrList as string[]);
    this.contract(key, createCompositeChannelContract(channels));
    return this;
  }

  public section(key: string, title?: string, summary?: string): this;
  public section(key: string, config: SectionConfig): this;
  public section(
    key: string,
    titleOrConfig?: string | SectionConfig,
    summary?: string,
  ): this {
    const config: SectionConfig =
      typeof titleOrConfig === 'string'
        ? { title: titleOrConfig, summary }
        : (titleOrConfig ?? {});
    this.currentSection = new SectionContext(key, config);
    return this;
  }

  public endSection(): this {
    if (!this.currentSection) {
      return this;
    }
    const section = this.currentSection;
    this.currentSection = null;
    this.contract(section.key, {
      type: 'Conversation/Document Section',
      ...(section.config.title ? { title: section.config.title } : {}),
      ...(section.config.summary ? { summary: section.config.summary } : {}),
      ...(section.relatedFields.size > 0
        ? { relatedFields: [...section.relatedFields] }
        : {}),
      ...(section.relatedContracts.size > 0
        ? { relatedContracts: [...section.relatedContracts] }
        : {}),
    });
    return this;
  }

  public operation(key: string): OperationBuilder;
  public operation(
    key: string,
    channel: string,
    description: string,
    stepsFactory: (steps: StepsBuilder) => void,
  ): this;
  public operation(
    key: string,
    channel: string,
    requestType: BlueTypeInput,
    description: string,
    stepsFactory: (steps: StepsBuilder) => void,
  ): this;
  public operation(key: string, config: OperationConfig): OperationBuilder;
  public operation(
    key: string,
    configOrChannel?: OperationConfig | string,
    requestTypeOrDescription?: BlueTypeInput | string,
    descriptionOrSteps?: string | ((steps: StepsBuilder) => void),
    maybeStepsFactory?: (steps: StepsBuilder) => void,
  ): this | OperationBuilder {
    if (typeof configOrChannel === 'string') {
      if (typeof requestTypeOrDescription === 'string') {
        const builder = this.operation(key) as OperationBuilder;
        builder
          .channel(configOrChannel)
          .description(requestTypeOrDescription)
          .steps(
            (descriptionOrSteps as
              | ((steps: StepsBuilder) => void)
              | undefined) ?? (() => undefined),
          )
          .done();
        return this;
      }
      const builder = this.operation(key) as OperationBuilder;
      builder
        .channel(configOrChannel)
        .requestType(requestTypeOrDescription as BlueTypeInput)
        .description((descriptionOrSteps as string) ?? '')
        .steps(maybeStepsFactory ?? (() => undefined))
        .done();
      return this;
    }

    const existingContract = this.getContract(key);
    const operation = new OperationBuilder(this, key, existingContract);
    const config = configOrChannel;
    if (config && typeof config === 'object') {
      if (config.type != null) {
        operation.type(config.type);
      }
      if (config.channel != null) {
        operation.channel(config.channel);
      }
      if (config.description != null) {
        operation.description(config.description);
      }
      if (config.request != null) {
        operation.request(config.request);
      }
      if (config.steps) {
        operation.implementation((steps) => {
          config.steps?.forEach((step) => steps.rawStep(step));
        });
      }
    }
    return operation;
  }

  public workflow(key: string, config: WorkflowConfig): this {
    const { steps, ...rest } = config;
    this.contract(key, {
      type: 'Conversation/Sequential Workflow',
      ...rest,
      ...(steps ? { steps } : {}),
    });
    return this;
  }

  public workflowOperation(
    key: string,
    operationKey: string,
    stepsFactory?: ((steps: StepsBuilder) => void) | BlueObject[],
  ): this {
    this.workflow(key, {
      type: 'Conversation/Sequential Workflow Operation',
      operation: operationKey,
      steps: toSteps(stepsFactory),
    });
    return this;
  }

  public onInit(
    key: string,
    stepsFactory: (steps: StepsBuilder) => void,
  ): this {
    this.contract('initLifecycleChannel', {
      type: 'Core/Lifecycle Event Channel',
      event: { type: 'Core/Document Processing Initiated' },
    });
    this.workflow(key, {
      channel: 'initLifecycleChannel',
      steps: toSteps(stepsFactory),
    });
    return this;
  }

  public onEvent(
    key: string,
    event: BlueTypeInput | BlueValue,
    stepsFactory: (steps: StepsBuilder) => void,
  ): this {
    this.contract('triggeredEventChannel', {
      type: 'Core/Triggered Event Channel',
    });
    this.workflow(key, {
      channel: 'triggeredEventChannel',
      event: this.toEventMatcher(event),
      steps: toSteps(stepsFactory),
    });
    return this;
  }

  public onNamedEvent(
    key: string,
    name: string,
    stepsFactory: (steps: StepsBuilder) => void,
  ): this {
    return this.onEvent(
      key,
      { type: 'Conversation/Event', name },
      stepsFactory,
    );
  }

  public onChannelEvent(
    key: string,
    channel: string,
    event: BlueValue,
    stepsFactory: (steps: StepsBuilder) => void,
  ): this {
    this.workflow(key, {
      channel,
      event,
      steps: toSteps(stepsFactory),
    });
    return this;
  }

  public onDocChange(
    key: string,
    fieldPath: string,
    stepsFactory: (steps: StepsBuilder) => void,
  ): this {
    const channelKey = `${key}DocUpdateChannel`;
    this.contract(channelKey, {
      type: 'Core/Document Update Channel',
      path: fieldPath,
    });
    this.workflow(key, {
      channel: channelKey,
      event: { type: 'Core/Document Update' },
      steps: toSteps(stepsFactory),
    });
    return this;
  }

  public onMyOsResponse(
    key: string,
    eventType: BlueTypeInput | BlueValue,
    requestIdOrFactory: string | ((steps: StepsBuilder) => void),
    maybeStepsFactory?: (steps: StepsBuilder) => void,
  ): this {
    if (typeof requestIdOrFactory === 'string') {
      return this.onEvent(
        key,
        {
          ...this.toEventMatcherObject(eventType),
          requestId: requestIdOrFactory,
          inResponseTo: {
            requestId: requestIdOrFactory,
          },
        },
        maybeStepsFactory ?? (() => undefined),
      );
    }
    return this.onEvent(key, eventType, requestIdOrFactory);
  }

  public onTriggeredWithId(
    key: string,
    eventType: BlueTypeInput | BlueValue,
    fieldName: string,
    idValue: string,
    stepsFactory: (steps: StepsBuilder) => void,
  ): this {
    return this.onEvent(
      key,
      {
        ...this.toEventMatcherObject(eventType),
        [fieldName]: idValue,
      },
      stepsFactory,
    );
  }

  public onSubscriptionUpdate(
    key: string,
    subscriptionId: string,
    updateTypeOrFactory:
      | BlueTypeInput
      | BlueValue
      | ((steps: StepsBuilder) => void),
    maybeStepsFactory?: (steps: StepsBuilder) => void,
  ): this {
    if (typeof updateTypeOrFactory === 'function') {
      return this.onEvent(
        key,
        {
          type: 'MyOS/Subscription Update',
          subscriptionId,
        },
        updateTypeOrFactory,
      );
    }

    return this.onEvent(
      key,
      {
        type: 'MyOS/Subscription Update',
        subscriptionId,
        update: this.toEventMatcher(updateTypeOrFactory),
      },
      maybeStepsFactory ?? (() => undefined),
    );
  }

  public directChange(
    operationKey: string,
    channelKey: string,
    description = 'Direct contract changes',
  ): this {
    this.contract(
      operationKey,
      createChangeOperationContract(
        'Conversation/Change Operation',
        channelKey,
        description,
      ),
    );
    this.contract(
      `${operationKey}Impl`,
      createChangeWorkflowContract(
        'Conversation/Change Workflow',
        operationKey,
      ),
    );
    return this;
  }

  public contractsPolicy(
    config: { requireSectionChanges?: boolean },
    key = 'contractsPolicy',
  ): this {
    this.contract(
      key,
      createContractsPolicyContract(config.requireSectionChanges ?? true),
    );
    return this;
  }

  public proposeChange(
    operationKey: string,
    channelKey: string,
    postfix: string,
    description = 'Propose change',
  ): this {
    this.contract(
      operationKey,
      createChangeOperationContract(
        'Conversation/Propose Change Operation',
        channelKey,
        description,
      ),
    );
    this.contract(
      `${operationKey}Impl`,
      createChangeWorkflowContract(
        'Conversation/Propose Change Workflow',
        operationKey,
        postfix,
      ),
    );
    return this;
  }

  public acceptChange(
    operationKey: string,
    channelKey: string,
    postfix: string,
    description = 'Accept change',
  ): this {
    this.contract(
      operationKey,
      createChangeOperationContract(
        'Conversation/Accept Change Operation',
        channelKey,
        description,
      ),
    );
    this.contract(
      `${operationKey}Impl`,
      createChangeWorkflowContract(
        'Conversation/Accept Change Workflow',
        operationKey,
        postfix,
      ),
    );
    return this;
  }

  public rejectChange(
    operationKey: string,
    channelKey: string,
    postfix: string,
    description = 'Reject change',
  ): this {
    this.contract(
      operationKey,
      createChangeOperationContract(
        'Conversation/Reject Change Operation',
        channelKey,
        description,
      ),
    );
    this.contract(
      `${operationKey}Impl`,
      createChangeWorkflowContract(
        'Conversation/Reject Change Workflow',
        operationKey,
        postfix,
      ),
    );
    return this;
  }

  public documentAnchors(
    keyOrAnchors: string | Record<string, BlueContract>,
    maybeAnchors?: Record<string, BlueContract>,
  ): this {
    const key =
      typeof keyOrAnchors === 'string' ? keyOrAnchors : 'documentAnchors';
    const anchors =
      typeof keyOrAnchors === 'string' ? (maybeAnchors ?? {}) : keyOrAnchors;
    this.contract(key, createDocumentAnchorsContract(anchors));
    return this;
  }

  public documentLinks(
    keyOrLinks: string | Record<string, BlueContract>,
    maybeLinks?: Record<string, BlueContract>,
  ): this {
    const key = typeof keyOrLinks === 'string' ? keyOrLinks : 'documentLinks';
    const links =
      typeof keyOrLinks === 'string' ? (maybeLinks ?? {}) : keyOrLinks;
    this.contract(key, createDocumentLinksContract(links));
    return this;
  }

  public myOsAdmin(
    operationKey = 'myOsAdminUpdate',
    channelKey = 'myOsAdminChannel',
    implementationKey = 'myOsAdminUpdateImpl',
  ): this {
    this.channel(channelKey, { type: 'MyOS/MyOS Timeline Channel' });
    this.contract(operationKey, {
      type: 'Conversation/Operation',
      description: 'Main operation to handle user actions in timeline.',
      channel: channelKey,
    });
    this.workflow(implementationKey, {
      type: 'Conversation/Sequential Workflow Operation',
      operation: operationKey,
      steps: [
        {
          name: 'aggregateEventsFromMyOsRequest',
          type: 'Conversation/JavaScript Code',
          code: 'return { events: event.message.request };',
        },
      ],
    });
    return this;
  }

  public eventFromExpression(expression: string): string {
    return expr(expression);
  }

  public buildObject(): BlueDocument {
    this.endSection();
    return clone(this.docNode);
  }

  public buildDocument(): BlueDocument {
    return this.buildObject();
  }

  public toYaml(): string {
    return toYaml(this.buildObject());
  }

  public getContract(key: string): BlueContract | undefined {
    return asContracts(this.docNode)[key];
  }

  private trackField(pointer: string): void {
    if (this.currentSection) {
      this.currentSection.trackField(pointer);
    }
  }

  private trackContract(key: string): void {
    if (this.currentSection) {
      this.currentSection.trackContract(key);
    }
  }

  private toEventMatcher(event: BlueTypeInput | BlueValue): BlueValue {
    if (typeof event === 'string') {
      return { type: resolveTypeInput(event) as BlueValue };
    }
    if (typeof event === 'object' && event !== null) {
      if ('blueId' in event) {
        return { type: resolveTypeInput(event as BlueTypeInput) as BlueValue };
      }
      if ('_def' in event && 'parse' in event) {
        return { type: resolveTypeInput(event as BlueTypeInput) as BlueValue };
      }
      return event as BlueValue;
    }
    return event as BlueValue;
  }

  private toEventMatcherObject(event: BlueTypeInput | BlueValue): BlueObject {
    const resolved = this.toEventMatcher(event);
    if (
      typeof resolved === 'object' &&
      resolved !== null &&
      !Array.isArray(resolved)
    ) {
      return resolved as BlueObject;
    }
    return { value: resolved };
  }
}
