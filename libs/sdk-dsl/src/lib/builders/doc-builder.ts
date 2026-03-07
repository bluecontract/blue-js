import { BlueNode } from '@blue-labs/language';

import type {
  BlueValueInput,
  ContractLike,
  FieldBuilder,
  OperationBuilder,
  TypeInput,
} from '../types';
import { ensureContracts, getContract } from '../internal/contracts';
import { mergeBlueNodes } from '../internal/node-merge';
import {
  getPointerNode,
  normalizeRequiredPointer,
  removePointer,
  writePointer,
} from '../internal/pointer';
import {
  SectionTracker,
  sectionTrackerFromDocument,
} from '../internal/section-tracker';
import { wrapExpression } from '../internal/expression';
import { resolveTypeInput } from '../internal/type-input';
import { toBlueNode, toRequestSchemaNode } from '../internal/value-to-node';
import { StepsBuilder } from './steps-builder';

const DEFAULT_CHANNEL_TYPE = 'Core/Channel';
const COMPOSITE_CHANNEL_TYPE = 'Conversation/Composite Timeline Channel';
const LIFECYCLE_CHANNEL_TYPE = 'Core/Lifecycle Event Channel';
const TRIGGERED_EVENT_CHANNEL_TYPE = 'Core/Triggered Event Channel';
const DOCUMENT_UPDATE_CHANNEL_TYPE = 'Core/Document Update Channel';
const DOCUMENT_PROCESSING_INITIATED_TYPE = 'Core/Document Processing Initiated';
const DOCUMENT_UPDATE_EVENT_TYPE = 'Core/Document Update';
const NAMED_EVENT_TYPE = 'Common/Named Event';
const OPERATION_TYPE = 'Conversation/Operation';
const OPERATION_IMPL_TYPE = 'Conversation/Sequential Workflow Operation';
const SEQUENTIAL_WORKFLOW_TYPE = 'Conversation/Sequential Workflow';

type OperationState = {
  readonly key: string;
  readonly channelKey: string | null;
  readonly description: string | null;
  readonly requestType: TypeInput | null;
  readonly requestSchema: BlueValueInput | null;
  readonly clearRequest: boolean;
  readonly requestDescription: string | null;
  readonly implementation: ((steps: StepsBuilder) => void) | null;
};

export class DocBuilder {
  private currentSection: SectionTracker | null = null;

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
    this.document.setName(requireNonEmpty(name, 'name'));
    return this;
  }

  description(description: string): this {
    this.document.setDescription(requireNonEmpty(description, 'description'));
    return this;
  }

  type(typeInput: TypeInput): this {
    this.document.setType(resolveTypeInput(typeInput));
    return this;
  }

  field(path: string): FieldBuilder<this>;
  field(path: string, value: BlueValueInput): this;
  field(path: string, value?: BlueValueInput): this | FieldBuilder<this> {
    if (arguments.length === 1) {
      this.trackField(path);
      return new FieldBuilderImpl({
        parent: this,
        path: normalizeRequiredPointer(path, 'field path'),
        resolveExisting: () => this.resolveExistingFieldNode(path),
        commit: (node) => this.setTrackedPointer(path, node),
      });
    }

    return this.setTrackedPointer(path, toBlueNode(value as BlueValueInput));
  }

  replace(path: string, value: BlueValueInput): this {
    return this.setTrackedPointer(path, toBlueNode(value));
  }

  remove(path: string): this {
    removePointer(this.document, normalizeRequiredPointer(path, 'pointer'));
    return this;
  }

  channel(name: string): this;
  channel(name: string, contractLike: ContractLike): this;
  channel(name: string, contractLike?: ContractLike): this {
    const contractKey = requireNonEmpty(name, 'channel key');
    const contracts = ensureContracts(this.document);

    if (arguments.length === 1) {
      contracts[contractKey] = createDefaultChannelContract();
      this.trackContract(contractKey);
      return this;
    }

    const base = contracts[contractKey] ?? createDefaultChannelContract();
    const overlay = toBlueNode(contractLike as ContractLike);
    const merged = mergeBlueNodes(base, overlay);
    if (!merged.getType()) {
      merged.setType(resolveTypeInput(DEFAULT_CHANNEL_TYPE));
    }

    contracts[contractKey] = merged;
    this.trackContract(contractKey);
    return this;
  }

  channels(...names: string[]): this {
    for (const name of names) {
      this.channel(name);
    }
    return this;
  }

  compositeChannel(name: string, ...channelKeys: string[]): this {
    const contractKey = requireNonEmpty(name, 'composite channel key');
    const composite = new BlueNode().setType(
      resolveTypeInput(COMPOSITE_CHANNEL_TYPE),
    );
    composite.addProperty(
      'channels',
      new BlueNode().setItems(
        channelKeys.map((channelKey) => toBlueNode(channelKey)),
      ),
    );
    ensureContracts(this.document)[contractKey] = composite;
    this.trackContract(contractKey);
    return this;
  }

  section(key: string): this;
  section(key: string, title: string, summary?: string | null): this;
  section(key: string, title?: string, summary?: string | null): this {
    const sectionKey = requireNonEmpty(key, 'section key');
    if (this.currentSection) {
      throw new Error(
        `Already in section '${this.currentSection.key}'. Call endSection() first.`,
      );
    }

    const fallbackTitle =
      title == null ? sectionKey : requireNonEmpty(title, 'section title');
    const tracker =
      sectionTrackerFromDocument(
        this.document,
        sectionKey,
        fallbackTitle,
        summary ?? null,
      ) ?? new SectionTracker(sectionKey, fallbackTitle, summary ?? null);

    this.currentSection = tracker;
    return this;
  }

  endSection(): this {
    if (!this.currentSection) {
      throw new Error('Not in a section.');
    }

    ensureContracts(this.document)[this.currentSection.key] =
      this.currentSection.buildNode();
    this.currentSection = null;
    return this;
  }

  operation(key: string): OperationBuilder<this>;
  operation(key: string, channelKey: string, description: string): this;
  operation(
    key: string,
    channelKey: string,
    requestType: TypeInput,
    description: string,
  ): this;
  operation(
    key: string,
    channelKey: string,
    description: string,
    implementation: (steps: StepsBuilder) => void,
  ): this;
  operation(
    key: string,
    channelKey: string,
    requestType: TypeInput,
    description: string,
    implementation: (steps: StepsBuilder) => void,
  ): this;
  operation(
    key: string,
    ...args:
      | []
      | [channelKey: string, description: string]
      | [channelKey: string, requestType: TypeInput, description: string]
      | [
          channelKey: string,
          description: string,
          implementation: (steps: StepsBuilder) => void,
        ]
      | [
          channelKey: string,
          requestType: TypeInput,
          description: string,
          implementation: (steps: StepsBuilder) => void,
        ]
  ): this | OperationBuilder<this> {
    const operationKey = requireNonEmpty(key, 'operation key');

    if (args.length === 0) {
      return new OperationBuilderImpl({
        parent: this,
        key: operationKey,
        applyState: (state) => this.applyOperationState(state),
      });
    }

    if (args.length === 2) {
      const [channelKey, description] = args;
      return this.applyOperationState({
        key: operationKey,
        channelKey,
        description,
        requestType: null,
        requestSchema: null,
        clearRequest: false,
        requestDescription: null,
        implementation: null,
      });
    }

    if (args.length === 3) {
      const [channelKey, third, fourth] = args;
      if (typeof fourth === 'function') {
        return this.applyOperationState({
          key: operationKey,
          channelKey,
          description: requireNonEmpty(third as string, 'description'),
          requestType: null,
          requestSchema: null,
          clearRequest: false,
          requestDescription: null,
          implementation: fourth,
        });
      }

      return this.applyOperationState({
        key: operationKey,
        channelKey,
        description: requireNonEmpty(fourth as string, 'description'),
        requestType: third as TypeInput,
        requestSchema: null,
        clearRequest: false,
        requestDescription: null,
        implementation: null,
      });
    }

    const [channelKey, requestType, description, implementation] = args;
    return this.applyOperationState({
      key: operationKey,
      channelKey,
      description,
      requestType,
      requestSchema: null,
      clearRequest: false,
      requestDescription: null,
      implementation,
    });
  }

  onInit(workflowKey: string, customizer: (steps: StepsBuilder) => void): this {
    const key = requireNonEmpty(workflowKey, 'workflow key');
    requireStepsCustomizer(customizer);
    this.ensureInitChannel();
    return this.applySequentialWorkflow(
      key,
      'initLifecycleChannel',
      null,
      customizer,
    );
  }

  onEvent(
    workflowKey: string,
    eventType: TypeInput,
    customizer: (steps: StepsBuilder) => void,
  ): this {
    const key = requireNonEmpty(workflowKey, 'workflow key');
    requireStepsCustomizer(customizer);
    this.ensureTriggeredChannel();
    return this.applySequentialWorkflow(
      key,
      'triggeredEventChannel',
      new BlueNode().setType(resolveTypeInput(eventType, 'event type')),
      customizer,
    );
  }

  onNamedEvent(
    workflowKey: string,
    eventName: string,
    customizer: (steps: StepsBuilder) => void,
  ): this {
    const key = requireNonEmpty(workflowKey, 'workflow key');
    const normalizedEventName = requireNonEmpty(eventName, 'event name');
    requireStepsCustomizer(customizer);
    this.ensureTriggeredChannel();

    const matcher = new BlueNode().setType(resolveTypeInput(NAMED_EVENT_TYPE));
    matcher.addProperty('name', toBlueNode(normalizedEventName));
    return this.applySequentialWorkflow(
      key,
      'triggeredEventChannel',
      matcher,
      customizer,
    );
  }

  onDocChange(
    workflowKey: string,
    path: string,
    customizer: (steps: StepsBuilder) => void,
  ): this {
    const key = requireNonEmpty(workflowKey, 'workflow key');
    const channelKey = `${key}DocUpdateChannel`;
    requireStepsCustomizer(customizer);

    const channel = new BlueNode().setType(
      resolveTypeInput(DOCUMENT_UPDATE_CHANNEL_TYPE),
    );
    channel.addProperty('path', toBlueNode(requireNonEmpty(path, 'path')));
    ensureContracts(this.document)[channelKey] = channel;
    this.trackContract(channelKey);

    return this.applySequentialWorkflow(
      key,
      channelKey,
      new BlueNode().setType(resolveTypeInput(DOCUMENT_UPDATE_EVENT_TYPE)),
      customizer,
    );
  }

  onChannelEvent(
    workflowKey: string,
    channelKey: string,
    eventType: TypeInput,
    customizer: (steps: StepsBuilder) => void,
  ): this {
    const key = requireNonEmpty(workflowKey, 'workflow key');
    const normalizedChannel = requireNonEmpty(channelKey, 'channel key');
    requireStepsCustomizer(customizer);

    return this.applySequentialWorkflow(
      key,
      normalizedChannel,
      new BlueNode().setType(resolveTypeInput(eventType, 'event type')),
      customizer,
    );
  }

  buildDocument(): BlueNode {
    if (this.currentSection) {
      throw new Error(
        `Unclosed section: '${this.currentSection.key}'. Call endSection() before buildDocument().`,
      );
    }

    return this.document;
  }

  private setTrackedPointer(path: string, node: BlueNode): this {
    writePointer(
      this.document,
      normalizeRequiredPointer(path, 'pointer'),
      node,
    );
    this.trackField(path);
    return this;
  }

  private resolveExistingFieldNode(path: string): BlueNode | null {
    return getPointerNode(
      this.document,
      normalizeRequiredPointer(path, 'field path'),
    );
  }

  private applyOperationState(state: OperationState): this {
    const contracts = ensureContracts(this.document);
    const operationKey = state.key;
    const existingOperation = contracts[operationKey] ?? null;
    const operation = existingOperation?.clone() ?? new BlueNode();
    operation.setType(resolveTypeInput(OPERATION_TYPE));

    const existingChannel = existingOperation
      ?.getProperties()
      ?.channel?.getValue();
    const resolvedChannel =
      state.channelKey?.trim() ||
      (typeof existingChannel === 'string' ? existingChannel.trim() : '');

    if (resolvedChannel.length === 0) {
      throw new Error('channel is required');
    }

    operation.addProperty('channel', toBlueNode(resolvedChannel));

    if (state.description != null) {
      operation.setDescription(
        requireNonEmpty(state.description, 'description'),
      );
    }

    if (state.requestSchema != null) {
      operation.addProperty(
        'request',
        toRequestSchemaNode(state.requestSchema),
      );
    } else if (state.requestType != null) {
      operation.addProperty(
        'request',
        new BlueNode().setType(resolveTypeInput(state.requestType)),
      );
    } else if (state.clearRequest) {
      operation.removeProperty('request');
    }

    contracts[operationKey] = operation;
    this.trackContract(operationKey);

    if (state.requestDescription != null) {
      this.setOperationRequestDescription(
        operationKey,
        requireNonEmpty(state.requestDescription, 'request description'),
      );
    }

    if (state.implementation) {
      this.appendOperationImplementation(
        `${operationKey}Impl`,
        operationKey,
        state.implementation,
      );
      this.trackContract(`${operationKey}Impl`);
    }

    return this;
  }

  private setOperationRequestDescription(
    operationKey: string,
    requestDescription: string,
  ): void {
    const operation = getContract(this.document, operationKey);
    if (!operation) {
      return;
    }

    const request =
      operation.getProperties()?.request?.clone() ?? new BlueNode();
    request.setDescription(requestDescription);
    operation.addProperty('request', request);
  }

  private appendOperationImplementation(
    implementationKey: string,
    operationKey: string,
    customizer: (steps: StepsBuilder) => void,
  ): void {
    const contracts = ensureContracts(this.document);
    const steps = this.buildSteps(customizer);
    const existing = contracts[implementationKey];

    if (!existing) {
      const workflow = new BlueNode().setType(
        resolveTypeInput(OPERATION_IMPL_TYPE),
      );
      workflow.addProperty('operation', toBlueNode(operationKey));
      workflow.addProperty('steps', new BlueNode().setItems(steps));
      contracts[implementationKey] = workflow;
      return;
    }

    existing.setType(resolveTypeInput(OPERATION_IMPL_TYPE));
    existing.addProperty('operation', toBlueNode(operationKey));

    const stepsNode =
      existing.getProperties()?.steps ?? new BlueNode().setItems([]);
    const items = stepsNode.getItems() ?? [];
    items.push(...steps);
    stepsNode.setItems(items);
    existing.addProperty('steps', stepsNode);
    contracts[implementationKey] = existing;
  }

  private buildSteps(customizer: (steps: StepsBuilder) => void): BlueNode[] {
    requireStepsCustomizer(customizer);
    const builder = new StepsBuilder();
    customizer(builder);
    return builder.build();
  }

  private applySequentialWorkflow(
    workflowKey: string,
    channelKey: string,
    eventMatcher: BlueNode | null,
    customizer: (steps: StepsBuilder) => void,
  ): this {
    const workflow = new BlueNode().setType(
      resolveTypeInput(SEQUENTIAL_WORKFLOW_TYPE),
    );
    workflow.addProperty('channel', toBlueNode(channelKey));
    if (eventMatcher) {
      workflow.addProperty('event', eventMatcher.clone());
    }
    workflow.addProperty(
      'steps',
      new BlueNode().setItems(this.buildSteps(customizer)),
    );

    ensureContracts(this.document)[workflowKey] = workflow;
    this.trackContract(workflowKey);
    return this;
  }

  private ensureTriggeredChannel(): void {
    const contracts = ensureContracts(this.document);
    if (contracts.triggeredEventChannel) {
      return;
    }

    contracts.triggeredEventChannel = new BlueNode().setType(
      resolveTypeInput(TRIGGERED_EVENT_CHANNEL_TYPE),
    );
  }

  private ensureInitChannel(): void {
    const contracts = ensureContracts(this.document);
    if (contracts.initLifecycleChannel) {
      return;
    }

    const lifecycleChannel = new BlueNode().setType(
      resolveTypeInput(LIFECYCLE_CHANNEL_TYPE),
    );
    lifecycleChannel.addProperty(
      'event',
      new BlueNode().setType(
        resolveTypeInput(DOCUMENT_PROCESSING_INITIATED_TYPE),
      ),
    );
    contracts.initLifecycleChannel = lifecycleChannel;
  }

  private trackField(path: string): void {
    if (!this.currentSection) {
      return;
    }

    this.currentSection.addField(normalizeRequiredPointer(path, 'field path'));
  }

  private trackContract(contractKey: string): void {
    if (!this.currentSection) {
      return;
    }

    this.currentSection.addContract(
      requireNonEmpty(contractKey, 'contract key'),
    );
  }
}

class FieldBuilderImpl<P extends DocBuilder> implements FieldBuilder<P> {
  private typeInput: TypeInput | null = null;
  private descriptionText: string | null = null;
  private valueInput: BlueValueInput | null = null;
  private valueSet = false;
  private requiredValue: boolean | null = null;
  private minimumValue: number | null = null;
  private maximumValue: number | null = null;

  constructor(
    private readonly config: {
      readonly parent: P;
      readonly path: string;
      readonly resolveExisting: () => BlueNode | null;
      readonly commit: (node: BlueNode) => P;
    },
  ) {}

  type(typeInput: TypeInput): FieldBuilder<P> {
    this.typeInput = typeInput;
    return this;
  }

  description(text: string): FieldBuilder<P> {
    this.descriptionText = requireNonEmpty(text, 'description');
    return this;
  }

  value(value: BlueValueInput): FieldBuilder<P> {
    this.valueInput = value;
    this.valueSet = true;
    return this;
  }

  required(required: boolean): FieldBuilder<P> {
    this.requiredValue = required;
    return this;
  }

  minimum(value: number): FieldBuilder<P> {
    this.minimumValue = value;
    return this;
  }

  maximum(value: number): FieldBuilder<P> {
    this.maximumValue = value;
    return this;
  }

  done(): P {
    const existing = this.config.resolveExisting();
    const mutated =
      this.valueSet ||
      this.typeInput != null ||
      this.descriptionText != null ||
      this.requiredValue != null ||
      this.minimumValue != null ||
      this.maximumValue != null;

    if (!mutated && !existing) {
      return this.config.parent;
    }

    let working = existing?.clone() ?? new BlueNode();
    if (this.valueSet) {
      working = toBlueNode(this.valueInput as BlueValueInput);
    }

    if (this.typeInput != null) {
      working.setType(resolveTypeInput(this.typeInput));
    }

    if (this.descriptionText != null) {
      working.setDescription(this.descriptionText);
    }

    if (
      this.requiredValue != null ||
      this.minimumValue != null ||
      this.maximumValue != null
    ) {
      const constraints =
        working.getProperties()?.constraints?.clone() ?? new BlueNode();
      if (this.requiredValue != null) {
        constraints.addProperty('required', toBlueNode(this.requiredValue));
      }
      if (this.minimumValue != null) {
        constraints.addProperty('minimum', toBlueNode(this.minimumValue));
      }
      if (this.maximumValue != null) {
        constraints.addProperty('maximum', toBlueNode(this.maximumValue));
      }
      working.addProperty('constraints', constraints);
    }

    return this.config.commit(working);
  }
}

class OperationBuilderImpl<
  P extends DocBuilder,
> implements OperationBuilder<P> {
  private channelKey: string | null = null;
  private descriptionText: string | null = null;
  private requestTypeInput: TypeInput | null = null;
  private requestSchema: BlueValueInput | null = null;
  private clearRequest = false;
  private requestDescriptionText: string | null = null;
  private implementation: ((steps: StepsBuilder) => void) | null = null;

  constructor(
    private readonly config: {
      readonly parent: P;
      readonly key: string;
      readonly applyState: (state: OperationState) => P;
    },
  ) {}

  channel(channelKey: string): OperationBuilder<P> {
    this.channelKey = requireNonEmpty(channelKey, 'channel');
    return this;
  }

  description(text: string): OperationBuilder<P> {
    this.descriptionText = requireNonEmpty(text, 'description');
    return this;
  }

  requestType(typeInput: TypeInput): OperationBuilder<P> {
    this.requestTypeInput = typeInput;
    this.requestSchema = null;
    this.clearRequest = false;
    return this;
  }

  request(requestSchema: BlueValueInput): OperationBuilder<P> {
    this.requestSchema = requestSchema;
    this.requestTypeInput = null;
    this.clearRequest = false;
    return this;
  }

  requestDescription(text: string): OperationBuilder<P> {
    this.requestDescriptionText = requireNonEmpty(text, 'request description');
    return this;
  }

  noRequest(): OperationBuilder<P> {
    this.requestSchema = null;
    this.requestTypeInput = null;
    this.clearRequest = true;
    return this;
  }

  steps(customizer: (steps: StepsBuilder) => void): OperationBuilder<P> {
    this.implementation = customizer;
    return this;
  }

  done(): P {
    return this.config.applyState({
      key: this.config.key,
      channelKey: this.channelKey,
      description: this.descriptionText,
      requestType: this.requestTypeInput,
      requestSchema: this.requestSchema,
      clearRequest: this.clearRequest,
      requestDescription: this.requestDescriptionText,
      implementation: this.implementation,
    });
  }
}

function createDefaultChannelContract(): BlueNode {
  return new BlueNode().setType(resolveTypeInput(DEFAULT_CHANNEL_TYPE));
}

function requireNonEmpty(
  value: string | null | undefined,
  label: string,
): string {
  const trimmed = value?.trim() ?? '';
  if (trimmed.length === 0) {
    throw new Error(`${label} is required`);
  }
  return trimmed;
}

function requireStepsCustomizer(
  customizer: ((steps: StepsBuilder) => void) | null | undefined,
): asserts customizer is (steps: StepsBuilder) => void {
  if (typeof customizer !== 'function') {
    throw new Error('steps is required');
  }
}
