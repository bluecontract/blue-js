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
import { StepsBuilder } from './steps-builder.js';

interface SectionState {
  key: string;
  config: SectionConfig;
  relatedFields: Set<string>;
  relatedContracts: Set<string>;
}

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
  private currentSection: SectionState | null = null;

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
    const channelType = config?.type ?? 'MyOS/MyOS Timeline Channel';
    const { type: _type, ...rest } = config ?? {};
    this.contract(key, {
      type: resolveTypeInput(channelType) as BlueValue,
      ...rest,
    });
    return this;
  }

  public channels(...keys: string[]): this {
    keys.forEach((key) => this.channel(key));
    return this;
  }

  public compositeChannel(key: string, channels: string[]): this {
    this.contract(key, {
      type: 'Conversation/Composite Timeline Channel',
      channels,
    });
    return this;
  }

  public section(key: string, title?: string, summary?: string): this;
  public section(key: string, config: SectionConfig): this;
  public section(key: string, titleOrConfig?: string | SectionConfig, summary?: string): this {
    const config: SectionConfig =
      typeof titleOrConfig === 'string'
        ? { title: titleOrConfig, summary }
        : (titleOrConfig ?? {});
    this.currentSection = {
      key,
      config,
      relatedFields: new Set(),
      relatedContracts: new Set(),
    };
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

  public operation(key: string, config?: OperationConfig): OperationBuilder {
    const operation = new OperationBuilder(this, key);
    if (config) {
      if (config.type) {
        operation.type(config.type);
      }
      if (config.channel) {
        operation.channel(config.channel);
      }
      if (config.description) {
        operation.description(config.description);
      }
      if (config.request) {
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

  public onInit(key: string, stepsFactory: (steps: StepsBuilder) => void): this {
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
    event: BlueValue,
    stepsFactory: (steps: StepsBuilder) => void,
  ): this {
    this.contract('triggeredEventChannel', {
      type: 'Core/Triggered Event Channel',
      event,
    });
    this.workflow(key, {
      channel: 'triggeredEventChannel',
      steps: toSteps(stepsFactory),
    });
    return this;
  }

  public onNamedEvent(
    key: string,
    name: string,
    stepsFactory: (steps: StepsBuilder) => void,
  ): this {
    return this.onEvent(key, { type: 'Common/Named Event', name }, stepsFactory);
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
      fieldPath,
    });
    this.workflow(key, {
      channel: channelKey,
      steps: toSteps(stepsFactory),
    });
    return this;
  }

  public directChange(
    operationKey: string,
    channelKey: string,
    description = 'Direct contract changes',
  ): this {
    this.contract(operationKey, {
      type: 'Conversation/Change Operation',
      channel: channelKey,
      description,
    });
    this.workflow(`${operationKey}Impl`, {
      type: 'Conversation/Change Workflow',
      operation: operationKey,
    });
    return this;
  }

  public contractsPolicy(config: { requireSectionChanges?: boolean }): this {
    this.contract('contractsPolicy', {
      type: 'Conversation/Contracts Change Policy',
      requireSectionChanges: config.requireSectionChanges ?? true,
    });
    return this;
  }

  public proposeChange(
    operationKey: string,
    channelKey: string,
    postfix: string,
    description = 'Propose change',
  ): this {
    this.contract(operationKey, {
      type: 'Conversation/Propose Change Operation',
      channel: channelKey,
      description,
    });
    this.workflow(`${operationKey}Impl`, {
      type: 'Conversation/Propose Change Workflow',
      operation: operationKey,
      postfix,
    });
    return this;
  }

  public acceptChange(
    operationKey: string,
    channelKey: string,
    postfix: string,
    description = 'Accept change',
  ): this {
    this.contract(operationKey, {
      type: 'Conversation/Accept Change Operation',
      channel: channelKey,
      description,
    });
    this.workflow(`${operationKey}Impl`, {
      type: 'Conversation/Accept Change Workflow',
      operation: operationKey,
      postfix,
    });
    return this;
  }

  public rejectChange(
    operationKey: string,
    channelKey: string,
    postfix: string,
    description = 'Reject change',
  ): this {
    this.contract(operationKey, {
      type: 'Conversation/Reject Change Operation',
      channel: channelKey,
      description,
    });
    this.workflow(`${operationKey}Impl`, {
      type: 'Conversation/Reject Change Workflow',
      operation: operationKey,
      postfix,
    });
    return this;
  }

  public documentAnchors(
    key: string,
    anchors: Record<string, BlueContract>,
  ): this {
    this.contract(key, {
      type: 'MyOS/Document Anchors',
      ...anchors,
    });
    return this;
  }

  public documentLinks(
    key: string,
    links: Record<string, BlueContract>,
  ): this {
    this.contract(key, {
      type: 'MyOS/Document Links',
      ...links,
    });
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
    return clone(this.docNode);
  }

  public toYaml(): string {
    this.endSection();
    return toYaml(this.docNode);
  }

  private trackField(pointer: string): void {
    if (this.currentSection) {
      this.currentSection.relatedFields.add(pointer);
    }
  }

  private trackContract(key: string): void {
    if (this.currentSection && key !== this.currentSection.key) {
      this.currentSection.relatedContracts.add(key);
    }
  }
}
