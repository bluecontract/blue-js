import { BlueNode } from '@blue-labs/language';

import {
  appendOperationImplementationSteps,
  buildCompositeChannelContract,
  buildDefaultChannelContract,
  ensureContracts,
  ensureOperationContract,
  getImplementationContractKey,
  getOperationChannel,
  mergeSpecialization,
  removeOperationRequest,
  setOperationChannel,
  setOperationDescription,
  setOperationRequestDescription,
  setOperationRequestNode,
  setOperationRequestType,
} from './internal/contracts.js';
import { wrapExpression } from './internal/expressions.js';
import { toBlueNode } from './internal/node-input.js';
import {
  getNodeAtPointer,
  normalizePointer,
  removeNodeAtPointer,
  setNodeAtPointer,
} from './internal/pointer.js';
import { SectionTracker } from './internal/section-tracker.js';
import { resolveTypeInput } from './internal/type-input.js';
import { StepsBuilder } from './steps-builder.js';
import type { BlueValue, TypeInput } from './types.js';

function requireNonBlank(value: string, label: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${label} cannot be empty.`);
  }
  return normalized;
}

type StepsCustomizer = (steps: StepsBuilder) => void;

export class DocBuilder {
  private currentSection?: SectionTracker;

  private constructor(private readonly document: BlueNode) {}

  static doc(): DocBuilder {
    return new DocBuilder(new BlueNode());
  }

  static edit(existingNode: BlueNode): DocBuilder {
    return new DocBuilder(existingNode);
  }

  static from(existingNode: BlueNode): DocBuilder {
    return new DocBuilder(existingNode.clone());
  }

  static expr(expression: string): string {
    return wrapExpression(expression);
  }

  name(name: string): this {
    this.document.setName(name);
    return this;
  }

  description(description: string): this {
    this.document.setDescription(description);
    return this;
  }

  type(typeInput: TypeInput): this {
    this.document.setType(resolveTypeInput(typeInput));
    return this;
  }

  field(path: string): FieldBuilder;
  field(path: string, value: BlueValue): this;
  field(path: string, value?: BlueValue): this | FieldBuilder {
    if (arguments.length === 1) {
      this.trackField(path);
      return new FieldBuilder(this, normalizePointer(path, 'field path'));
    }

    this.applyFieldValue(path, toBlueNode(value as BlueValue));
    return this;
  }

  replace(path: string, value: BlueValue): this {
    this.applyFieldValue(path, toBlueNode(value));
    return this;
  }

  remove(path: string): this {
    removeNodeAtPointer(this.document, path);
    return this;
  }

  channel(name: string): this;
  channel(name: string, contractLike: BlueValue): this;
  channel(name: string, contractLike?: BlueValue): this {
    const key = requireNonBlank(name, 'Channel name');
    const contracts = ensureContracts(this.document);
    const contract =
      arguments.length === 1
        ? buildDefaultChannelContract()
        : mergeSpecialization(
            contracts[key] ?? buildDefaultChannelContract(),
            toBlueNode(contractLike as BlueValue),
          );
    contracts[key] = contract;
    this.trackContract(key);
    return this;
  }

  channels(...names: string[]): this {
    for (const name of names) {
      this.channel(name);
    }
    return this;
  }

  compositeChannel(name: string, ...channelKeys: string[]): this {
    const key = requireNonBlank(name, 'Composite channel name');
    ensureContracts(this.document)[key] = buildCompositeChannelContract(
      channelKeys.map((channelKey) => requireNonBlank(channelKey, 'Channel key')),
    );
    this.trackContract(key);
    return this;
  }

  section(key: string): this;
  section(key: string, title: string, summary?: string): this;
  section(key: string, title?: string, summary?: string): this {
    const normalizedKey = requireNonBlank(key, 'Section key');
    if (this.currentSection) {
      throw new Error(
        `Already in section '${this.currentSection.key}'. Call endSection() first.`,
      );
    }
    this.currentSection = SectionTracker.open(
      this.document,
      normalizedKey,
      title?.trim() || normalizedKey,
      summary?.trim(),
    );
    return this;
  }

  endSection(): this {
    if (!this.currentSection) {
      throw new Error('No section is currently open.');
    }
    ensureContracts(this.document)[this.currentSection.key] =
      this.currentSection.buildNode();
    this.currentSection = undefined;
    return this;
  }

  operation(key: string): OperationBuilder;
  operation(key: string, channel: string, description: string): this;
  operation(
    key: string,
    channel: string,
    requestType: TypeInput,
    description: string,
  ): this;
  operation(
    key: string,
    channel: string,
    description: string,
    stepsCustomizer: StepsCustomizer,
  ): this;
  operation(
    key: string,
    channel: string,
    requestType: TypeInput,
    description: string,
    stepsCustomizer: StepsCustomizer,
  ): this;
  operation(
    key: string,
    channel?: string,
    arg3?: string | TypeInput,
    arg4?: string | StepsCustomizer,
    arg5?: StepsCustomizer,
  ): this | OperationBuilder {
    if (arguments.length === 1) {
      return new OperationBuilder(this, requireNonBlank(key, 'Operation key'));
    }

    const operationKey = requireNonBlank(key, 'Operation key');
    const channelKey = requireNonBlank(channel ?? '', 'Operation channel');

    let requestType: TypeInput | undefined;
    let description: string;
    let stepsCustomizer: StepsCustomizer | undefined;

    if (arguments.length === 3) {
      description = requireNonBlank(arg3 as string, 'Operation description');
    } else if (arguments.length === 4) {
      if (typeof arg4 === 'function') {
        description = requireNonBlank(arg3 as string, 'Operation description');
        stepsCustomizer = arg4;
      } else {
        requestType = arg3 as TypeInput;
        description = requireNonBlank(
          arg4 as string,
          'Operation description',
        );
      }
    } else {
      requestType = arg3 as TypeInput;
      description = requireNonBlank(arg4 as string, 'Operation description');
      stepsCustomizer = arg5;
    }

    this.applyOperation({
      key: operationKey,
      channelKey,
      description,
      requestType,
      stepsCustomizer,
    });
    return this;
  }

  buildDocument(): BlueNode {
    if (this.currentSection) {
      throw new Error(
        `Unclosed section: '${this.currentSection.key}'. Call endSection() before buildDocument().`,
      );
    }
    return this.document;
  }

  documentNode(): BlueNode {
    return this.document;
  }

  applyFieldBuilder(path: string, node: BlueNode): this {
    this.applyFieldValue(path, node);
    return this;
  }

  applyOperation(config: {
    key: string;
    channelKey?: string;
    description?: string;
    requestType?: TypeInput;
    requestNode?: BlueNode;
    clearRequest?: boolean;
    requestDescription?: string;
    stepsCustomizer?: StepsCustomizer;
  }): this {
    const contracts = ensureContracts(this.document);
    const operation = ensureOperationContract(contracts, config.key);

    const channelKey = config.channelKey ?? getOperationChannel(operation);
    if (!channelKey) {
      throw new Error(`Operation '${config.key}' requires a channel.`);
    }

    setOperationChannel(operation, requireNonBlank(channelKey, 'Operation channel'));

    if (config.description !== undefined) {
      setOperationDescription(operation, config.description);
    }
    if (config.requestNode) {
      setOperationRequestNode(operation, config.requestNode);
    } else if (config.requestType !== undefined) {
      setOperationRequestType(operation, config.requestType);
    } else if (config.clearRequest) {
      removeOperationRequest(operation);
    }
    if (config.requestDescription !== undefined) {
      setOperationRequestDescription(operation, config.requestDescription);
    }

    contracts[config.key] = operation;
    this.trackContract(config.key);

    if (config.stepsCustomizer) {
      const steps = new StepsBuilder();
      config.stepsCustomizer(steps);
      appendOperationImplementationSteps(
        contracts,
        config.key,
        steps.build(),
      );
      this.trackContract(getImplementationContractKey(config.key));
    }

    return this;
  }

  private applyFieldValue(path: string, valueNode: BlueNode): void {
    setNodeAtPointer(this.document, path, valueNode);
    this.trackField(path);
  }

  private trackField(path: string): void {
    this.currentSection?.trackField(path);
  }

  private trackContract(key: string): void {
    this.currentSection?.trackContract(key);
  }
}

export class FieldBuilder {
  private fieldType?: TypeInput;
  private fieldDescription?: string;
  private fieldValue?: BlueValue;
  private hasValue = false;
  private requiredValue?: boolean;
  private minimumValue?: number;
  private maximumValue?: number;

  constructor(
    private readonly parent: DocBuilder,
    private readonly path: string,
  ) {}

  type(typeInput: TypeInput): this {
    this.fieldType = typeInput;
    return this;
  }

  description(description: string): this {
    this.fieldDescription = description;
    return this;
  }

  value(value: BlueValue): this {
    this.fieldValue = value;
    this.hasValue = true;
    return this;
  }

  required(required: boolean): this {
    this.requiredValue = required;
    return this;
  }

  minimum(minimum: number): this {
    this.minimumValue = minimum;
    return this;
  }

  maximum(maximum: number): this {
    this.maximumValue = maximum;
    return this;
  }

  done(): DocBuilder {
    const existing = getNodeAtPointer(this.parent.documentNode(), this.path);
    const mutated =
      this.hasValue ||
      this.fieldType !== undefined ||
      this.fieldDescription !== undefined ||
      this.requiredValue !== undefined ||
      this.minimumValue !== undefined ||
      this.maximumValue !== undefined;

    if (!mutated && !existing) {
      return this.parent;
    }

    let fieldNode = existing?.clone() ?? new BlueNode();
    if (this.hasValue) {
      fieldNode = toBlueNode(this.fieldValue as BlueValue);
    }
    if (this.fieldType !== undefined) {
      fieldNode.setType(resolveTypeInput(this.fieldType));
    }
    if (this.fieldDescription !== undefined) {
      fieldNode.setDescription(this.fieldDescription);
    }
    if (this.requiredValue !== undefined) {
      fieldNode.addProperty('required', new BlueNode().setValue(this.requiredValue));
    }
    if (this.minimumValue !== undefined) {
      fieldNode.addProperty('minimum', new BlueNode().setValue(this.minimumValue));
    }
    if (this.maximumValue !== undefined) {
      fieldNode.addProperty('maximum', new BlueNode().setValue(this.maximumValue));
    }

    return this.parent.applyFieldBuilder(this.path, fieldNode);
  }
}

export class OperationBuilder {
  private operationChannel?: string;
  private operationDescription?: string;
  private configuredRequestType?: TypeInput;
  private requestNode?: BlueNode;
  private clearRequest = false;
  private operationRequestDescription?: string;
  private implementation?: StepsCustomizer;

  constructor(
    private readonly parent: DocBuilder,
    private readonly key: string,
  ) {}

  channel(channelKey: string): this {
    this.operationChannel = channelKey;
    return this;
  }

  description(description: string): this {
    this.operationDescription = description;
    return this;
  }

  requestType(typeInput: TypeInput): this {
    this.configuredRequestType = typeInput;
    this.requestNode = undefined;
    this.clearRequest = false;
    return this;
  }

  request(requestSchema: BlueValue): this {
    this.requestNode = toBlueNode(requestSchema);
    this.configuredRequestType = undefined;
    this.clearRequest = false;
    return this;
  }

  requestDescription(description: string): this {
    this.operationRequestDescription = description;
    return this;
  }

  noRequest(): this {
    this.clearRequest = true;
    this.configuredRequestType = undefined;
    this.requestNode = undefined;
    return this;
  }

  steps(stepsCustomizer: StepsCustomizer): this {
    this.implementation = stepsCustomizer;
    return this;
  }

  done(): DocBuilder {
    return this.parent.applyOperation({
      key: this.key,
      channelKey: this.operationChannel,
      description: this.operationDescription,
      requestType: this.configuredRequestType,
      requestNode: this.requestNode,
      clearRequest: this.clearRequest,
      requestDescription: this.operationRequestDescription,
      stepsCustomizer: this.implementation,
    });
  }
}
