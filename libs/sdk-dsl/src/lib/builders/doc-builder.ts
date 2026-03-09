import { BlueNode } from '@blue-labs/language';

import type {
  AIResponseNamedEventMatcher,
  BlueValueInput,
  ContractLike,
  FieldBuilder,
  OperationBuilder,
  TypeInput,
} from '../types';
import { nodeToAliasJson } from '../alias-json';
import { INTERNAL_BLUE } from '../internal/blue';
import { ensureContracts, getContract } from '../internal/contracts';
import {
  type AccessConfig,
  type AIIntegrationConfig,
  type AINamedEventExpectation,
  type AITaskTemplate,
  type AgencyConfig,
  createLinkedDocumentsPermissionSet,
  createPermissionFlagsNode,
  createSingleDocumentPermissionSet,
  createWorkerAgencyPermissionList,
  type InteractionConfigRegistry,
  type LinkedAccessConfig,
  normalizeStringList,
  type PermissionTiming,
  tokenOf,
} from '../internal/interactions';
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
import { AINamedEventFieldsBuilder, StepsBuilder } from './steps-builder';

const DEFAULT_CHANNEL_TYPE = 'Core/Channel';
const COMPOSITE_CHANNEL_TYPE = 'Conversation/Composite Timeline Channel';
const LIFECYCLE_CHANNEL_TYPE = 'Core/Lifecycle Event Channel';
const TRIGGERED_EVENT_CHANNEL_TYPE = 'Core/Triggered Event Channel';
const DOCUMENT_UPDATE_CHANNEL_TYPE = 'Core/Document Update Channel';
const DOCUMENT_PROCESSING_INITIATED_TYPE = 'Core/Document Processing Initiated';
const DOCUMENT_UPDATE_EVENT_TYPE = 'Core/Document Update';
const MYOS_TIMELINE_CHANNEL_TYPE = 'MyOS/MyOS Timeline Channel';
const MYOS_ADMIN_BASE_TYPE = 'MyOS/MyOS Admin Base';
const MYOS_SUBSCRIPTION_UPDATE_TYPE = 'MyOS/Subscription Update';
const NAMED_EVENT_TYPE = 'Common/Named Event';
const OPERATION_TYPE = 'Conversation/Operation';
const OPERATION_IMPL_TYPE = 'Conversation/Sequential Workflow Operation';
const SEQUENTIAL_WORKFLOW_TYPE = 'Conversation/Sequential Workflow';
const MYOS_ADMIN_UPDATE_DESCRIPTION =
  'The standard, required operation for MyOS Admin to deliver events.';
const MYOS_ADMIN_UPDATE_IMPL_DESCRIPTION =
  'Implementation that re-emits the provided events';
const MYOS_ADMIN_REEMIT_CODE = 'return { events: event.message.request };';

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

type AccessState = {
  readonly name: string;
  readonly targetSessionId: BlueValueInput | null;
  readonly onBehalfOfChannel: string | null;
  readonly read: boolean;
  readonly operations: readonly string[];
  readonly statusPath: string | null;
  readonly subscribeAfterGranted: boolean;
  readonly subscriptionEvents: readonly TypeInput[];
  readonly subscribeToCreatedSessions: boolean;
  readonly permissionTiming: PermissionTiming;
};

type LinkedAccessState = {
  readonly name: string;
  readonly targetSessionId: BlueValueInput | null;
  readonly onBehalfOfChannel: string | null;
  readonly statusPath: string | null;
  readonly links: Readonly<Record<string, LinkState>>;
  readonly permissionTiming: PermissionTiming;
};

type LinkState = {
  readonly read: boolean;
  readonly operations: readonly string[];
};

type AgencyState = {
  readonly name: string;
  readonly onBehalfOfChannel: string | null;
  readonly allowedTypes: readonly TypeInput[];
  readonly allowedOperations: readonly string[];
  readonly statusPath: string | null;
  readonly permissionTiming: PermissionTiming;
};

type AIState = {
  readonly name: string;
  readonly sessionId: BlueValueInput | null;
  readonly permissionFromChannel: string | null;
  readonly statusPath: string | null;
  readonly contextPath: string | null;
  readonly requesterId: string | null;
  readonly permissionTiming: PermissionTiming;
  readonly tasks: ReadonlyMap<string, AITaskTemplate>;
};

export class DocBuilder {
  private currentSection: SectionTracker | null = null;
  private readonly accessConfigs = new Map<string, AccessConfig>();
  private readonly linkedAccessConfigs = new Map<string, LinkedAccessConfig>();
  private readonly agencyConfigs = new Map<string, AgencyConfig>();
  private readonly aiConfigs = new Map<string, AIIntegrationConfig>();

  protected constructor(private readonly document: BlueNode) {}

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

  contract(key: string, contractLike: ContractLike): this {
    const contractKey = requireNonEmpty(key, 'contract key');
    ensureContracts(this.document)[contractKey] = toBlueNode(contractLike);
    this.trackContract(contractKey);
    return this;
  }

  contracts(record: Record<string, ContractLike>): this {
    for (const [contractKey, contractLike] of Object.entries(record)) {
      this.contract(contractKey, contractLike);
    }
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

  access(accessName: string): AccessBuilder<this> {
    return new AccessBuilder({
      parent: this,
      name: requireNonEmpty(accessName, 'access name'),
      applyState: (state) => this.applyAccessState(state),
    });
  }

  accessLinked(linkedAccessName: string): LinkedAccessBuilder<this> {
    return new LinkedAccessBuilder({
      parent: this,
      name: requireNonEmpty(linkedAccessName, 'linked access name'),
      applyState: (state) => this.applyLinkedAccessState(state),
    });
  }

  agency(agencyName: string): AgencyBuilder<this> {
    return new AgencyBuilder({
      parent: this,
      name: requireNonEmpty(agencyName, 'agency name'),
      applyState: (state) => this.applyAgencyState(state),
    });
  }

  ai(aiName: string): AiIntegrationBuilder<this> {
    return new AiIntegrationBuilder({
      parent: this,
      name: requireNonEmpty(aiName, 'ai name'),
      applyState: (state) => this.applyAiState(state),
    });
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

  myOsAdmin(): this;
  myOsAdmin(channelKey: string): this;
  myOsAdmin(channelKey?: string): this {
    const adminChannelKey =
      channelKey == null
        ? 'myOsAdminChannel'
        : requireNonEmpty(channelKey, 'channel key');

    if (
      adminChannelKey === 'myOsAdminChannel' &&
      this.isMyOsAdminBaseDocument()
    ) {
      return this;
    }

    const contracts = ensureContracts(this.document);
    contracts[adminChannelKey] = mergeBlueNodes(
      new BlueNode().setType(resolveTypeInput(MYOS_TIMELINE_CHANNEL_TYPE)),
      contracts[adminChannelKey] ?? new BlueNode(),
    );

    const adminUpdate = (contracts.myOsAdminUpdate ?? new BlueNode()).clone();
    adminUpdate.setType(resolveTypeInput(OPERATION_TYPE));
    adminUpdate.setDescription(MYOS_ADMIN_UPDATE_DESCRIPTION);
    adminUpdate.addProperty('channel', toBlueNode(adminChannelKey));
    adminUpdate.addProperty(
      'request',
      new BlueNode().setType(resolveTypeInput('List')),
    );
    contracts.myOsAdminUpdate = adminUpdate;

    const adminUpdateImpl = new BlueNode()
      .setType(resolveTypeInput(OPERATION_IMPL_TYPE))
      .setDescription(MYOS_ADMIN_UPDATE_IMPL_DESCRIPTION);
    adminUpdateImpl.addProperty('operation', toBlueNode('myOsAdminUpdate'));
    adminUpdateImpl.addProperty(
      'steps',
      new BlueNode().setItems(
        new StepsBuilder()
          .jsRaw('EmitAdminEvents', MYOS_ADMIN_REEMIT_CODE)
          .build(),
      ),
    );
    contracts.myOsAdminUpdateImpl = adminUpdateImpl;

    this.trackContract(adminChannelKey);
    this.trackContract('myOsAdminUpdate');
    this.trackContract('myOsAdminUpdateImpl');
    return this;
  }

  onTriggeredWithId(
    workflowKey: string,
    eventType: TypeInput,
    idFieldName: string,
    idValue: string,
    customizer: (steps: StepsBuilder) => void,
  ): this {
    const normalizedField = requireNonEmpty(idFieldName, 'id field name');
    const normalizedValue = requireNonEmpty(idValue, 'id value');

    if (normalizedField === 'subscriptionId') {
      return this.onTriggeredWithMatcher(
        workflowKey,
        eventType,
        { subscriptionId: normalizedValue },
        customizer,
      );
    }

    if (normalizedField === 'requestId') {
      return this.onTriggeredWithMatcher(
        workflowKey,
        eventType,
        {
          inResponseTo: {
            requestId: normalizedValue,
          },
        },
        customizer,
      );
    }

    throw new Error(`Unsupported id field for matcher: ${normalizedField}`);
  }

  onTriggeredWithMatcher(
    workflowKey: string,
    eventType: TypeInput,
    matcher: BlueValueInput | null | undefined,
    customizer: (steps: StepsBuilder) => void,
  ): this {
    const key = requireNonEmpty(workflowKey, 'workflow key');
    requireStepsCustomizer(customizer);
    this.ensureTriggeredChannel();

    return this.applySequentialWorkflow(
      key,
      'triggeredEventChannel',
      this.buildTriggeredMatcher(eventType, matcher),
      customizer,
    );
  }

  onSubscriptionUpdate(
    workflowKey: string,
    subscriptionId: string,
    customizer: (steps: StepsBuilder) => void,
  ): this;
  onSubscriptionUpdate(
    workflowKey: string,
    subscriptionId: string,
    updateType: TypeInput,
    customizer: (steps: StepsBuilder) => void,
  ): this;
  onSubscriptionUpdate(
    workflowKey: string,
    subscriptionId: string,
    updateTypeOrCustomizer: TypeInput | ((steps: StepsBuilder) => void),
    maybeCustomizer?: (steps: StepsBuilder) => void,
  ): this {
    const normalizedSubscriptionId = requireNonEmpty(
      subscriptionId,
      'subscription id',
    );

    if (typeof updateTypeOrCustomizer === 'function') {
      return this.onTriggeredWithMatcher(
        workflowKey,
        MYOS_SUBSCRIPTION_UPDATE_TYPE,
        {
          subscriptionId: normalizedSubscriptionId,
        },
        updateTypeOrCustomizer,
      );
    }

    const matcher = new BlueNode();
    matcher.addProperty('subscriptionId', toBlueNode(normalizedSubscriptionId));
    matcher.addProperty(
      'update',
      new BlueNode().setType(resolveTypeInput(updateTypeOrCustomizer)),
    );
    const customizer = maybeCustomizer;
    requireStepsCustomizer(customizer);

    return this.onTriggeredWithMatcher(
      workflowKey,
      MYOS_SUBSCRIPTION_UPDATE_TYPE,
      matcher,
      customizer,
    );
  }

  onMyOsResponse(
    workflowKey: string,
    responseEventType: TypeInput,
    customizer: (steps: StepsBuilder) => void,
  ): this;
  onMyOsResponse(
    workflowKey: string,
    responseEventType: TypeInput,
    requestId: string,
    customizer: (steps: StepsBuilder) => void,
  ): this;
  onMyOsResponse(
    workflowKey: string,
    responseEventType: TypeInput,
    requestIdOrCustomizer: string | ((steps: StepsBuilder) => void),
    maybeCustomizer?: (steps: StepsBuilder) => void,
  ): this {
    if (typeof requestIdOrCustomizer === 'function') {
      return this.onTriggeredWithMatcher(
        workflowKey,
        responseEventType,
        null,
        requestIdOrCustomizer,
      );
    }

    const normalizedRequestId = requestIdOrCustomizer.trim();
    const customizer = maybeCustomizer;
    requireStepsCustomizer(customizer);
    if (normalizedRequestId.length === 0) {
      return this.onTriggeredWithMatcher(
        workflowKey,
        responseEventType,
        null,
        customizer,
      );
    }

    return this.onTriggeredWithId(
      workflowKey,
      responseEventType,
      'requestId',
      normalizedRequestId,
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

  onAccessGranted(
    accessName: string,
    workflowKey: string,
    customizer: (steps: StepsBuilder) => void,
  ): this {
    const config = this.requireAccessConfig(accessName);
    return this.onMyOsResponse(
      workflowKey,
      'MyOS/Single Document Permission Granted',
      config.requestId,
      customizer,
    );
  }

  onAccessRejected(
    accessName: string,
    workflowKey: string,
    customizer: (steps: StepsBuilder) => void,
  ): this {
    const config = this.requireAccessConfig(accessName);
    return this.onMyOsResponse(
      workflowKey,
      'MyOS/Single Document Permission Rejected',
      config.requestId,
      customizer,
    );
  }

  onAccessRevoked(
    accessName: string,
    workflowKey: string,
    customizer: (steps: StepsBuilder) => void,
  ): this {
    const config = this.requireAccessConfig(accessName);
    return this.onMyOsResponse(
      workflowKey,
      'MyOS/Single Document Permission Revoked',
      config.requestId,
      customizer,
    );
  }

  onCallResponse(
    accessName: string,
    workflowKey: string,
    customizer: (steps: StepsBuilder) => void,
  ): this {
    this.requireAccessConfig(accessName);
    return this.onEvent(
      workflowKey,
      'MyOS/Call Operation Responded',
      customizer,
    );
  }

  onUpdate(
    accessName: string,
    workflowKey: string,
    customizer: (steps: StepsBuilder) => void,
  ): this;
  onUpdate(
    accessName: string,
    workflowKey: string,
    updateType: TypeInput,
    customizer: (steps: StepsBuilder) => void,
  ): this;
  onUpdate(
    accessName: string,
    workflowKey: string,
    updateTypeOrCustomizer: TypeInput | ((steps: StepsBuilder) => void),
    maybeCustomizer?: (steps: StepsBuilder) => void,
  ): this {
    const config = this.requireAccessConfig(accessName);
    if (typeof updateTypeOrCustomizer === 'function') {
      return this.onSubscriptionUpdate(
        workflowKey,
        config.subscriptionId,
        updateTypeOrCustomizer,
      );
    }

    const customizer = maybeCustomizer;
    requireStepsCustomizer(customizer);
    return this.onSubscriptionUpdate(
      workflowKey,
      config.subscriptionId,
      updateTypeOrCustomizer,
      customizer,
    );
  }

  onLinkedAccessGranted(
    linkedAccessName: string,
    workflowKey: string,
    customizer: (steps: StepsBuilder) => void,
  ): this {
    const config = this.requireLinkedAccessConfig(linkedAccessName);
    return this.onMyOsResponse(
      workflowKey,
      'MyOS/Linked Documents Permission Granted',
      config.requestId,
      customizer,
    );
  }

  onLinkedAccessRejected(
    linkedAccessName: string,
    workflowKey: string,
    customizer: (steps: StepsBuilder) => void,
  ): this {
    const config = this.requireLinkedAccessConfig(linkedAccessName);
    return this.onMyOsResponse(
      workflowKey,
      'MyOS/Linked Documents Permission Rejected',
      config.requestId,
      customizer,
    );
  }

  onLinkedAccessRevoked(
    linkedAccessName: string,
    workflowKey: string,
    customizer: (steps: StepsBuilder) => void,
  ): this {
    const config = this.requireLinkedAccessConfig(linkedAccessName);
    return this.onMyOsResponse(
      workflowKey,
      'MyOS/Linked Documents Permission Revoked',
      config.requestId,
      customizer,
    );
  }

  onAgencyGranted(
    agencyName: string,
    workflowKey: string,
    customizer: (steps: StepsBuilder) => void,
  ): this {
    const config = this.requireAgencyConfig(agencyName);
    return this.onMyOsResponse(
      workflowKey,
      'MyOS/Worker Agency Permission Granted',
      config.requestId,
      customizer,
    );
  }

  onAgencyRejected(
    agencyName: string,
    workflowKey: string,
    customizer: (steps: StepsBuilder) => void,
  ): this {
    const config = this.requireAgencyConfig(agencyName);
    return this.onMyOsResponse(
      workflowKey,
      'MyOS/Worker Agency Permission Rejected',
      config.requestId,
      customizer,
    );
  }

  onAgencyRevoked(
    agencyName: string,
    workflowKey: string,
    customizer: (steps: StepsBuilder) => void,
  ): this {
    const config = this.requireAgencyConfig(agencyName);
    return this.onMyOsResponse(
      workflowKey,
      'MyOS/Worker Agency Permission Revoked',
      config.requestId,
      customizer,
    );
  }

  onSessionStarting(
    agencyName: string,
    workflowKey: string,
    customizer: (steps: StepsBuilder) => void,
  ): this {
    this.requireAgencyConfig(agencyName);
    return this.onEvent(
      workflowKey,
      'MyOS/Worker Session Starting',
      customizer,
    );
  }

  onSessionStarted(
    agencyName: string,
    workflowKey: string,
    customizer: (steps: StepsBuilder) => void,
  ): this {
    this.requireAgencyConfig(agencyName);
    return this.onEvent(
      workflowKey,
      'MyOS/Target Document Session Started',
      customizer,
    );
  }

  onSessionFailed(
    agencyName: string,
    workflowKey: string,
    customizer: (steps: StepsBuilder) => void,
  ): this {
    this.requireAgencyConfig(agencyName);
    return this.onEvent(workflowKey, 'MyOS/Bootstrap Failed', customizer);
  }

  onParticipantResolved(
    agencyName: string,
    workflowKey: string,
    customizer: (steps: StepsBuilder) => void,
  ): this {
    this.requireAgencyConfig(agencyName);
    return this.onEvent(workflowKey, 'MyOS/Participant Resolved', customizer);
  }

  onAllParticipantsReady(
    agencyName: string,
    workflowKey: string,
    customizer: (steps: StepsBuilder) => void,
  ): this {
    this.requireAgencyConfig(agencyName);
    return this.onEvent(workflowKey, 'MyOS/All Participants Ready', customizer);
  }

  onAIResponse(
    integrationName: string,
    workflowKey: string,
    customizer: (steps: StepsBuilder) => void,
  ): this;
  onAIResponse(
    integrationName: string,
    workflowKey: string,
    responseType: TypeInput | AIResponseNamedEventMatcher,
    customizer: (steps: StepsBuilder) => void,
  ): this;
  onAIResponse(
    integrationName: string,
    workflowKey: string,
    responseType: TypeInput | AIResponseNamedEventMatcher,
    taskName: string,
    customizer: (steps: StepsBuilder) => void,
  ): this;
  onAIResponse(
    integrationName: string,
    workflowKey: string,
    responseTypeOrCustomizer:
      | TypeInput
      | AIResponseNamedEventMatcher
      | ((steps: StepsBuilder) => void),
    taskNameOrCustomizer?: string | ((steps: StepsBuilder) => void),
    maybeCustomizer?: (steps: StepsBuilder) => void,
  ): this {
    const integration = this.requireAiIntegration(integrationName);

    const responseType =
      typeof responseTypeOrCustomizer === 'function'
        ? ('Conversation/Response' as const)
        : responseTypeOrCustomizer;
    const taskName =
      typeof taskNameOrCustomizer === 'string'
        ? requireNonEmpty(taskNameOrCustomizer, 'task name')
        : null;
    const customizer =
      typeof responseTypeOrCustomizer === 'function'
        ? responseTypeOrCustomizer
        : typeof taskNameOrCustomizer === 'function'
          ? taskNameOrCustomizer
          : maybeCustomizer;

    requireStepsCustomizer(customizer);

    if (taskName && !integration.tasks.has(taskName)) {
      throw new Error(
        `Unknown task '${taskName}' for AI integration '${integration.name}'`,
      );
    }

    const updateMatcher = isAiNamedEventMatcher(responseType)
      ? new BlueNode().setType(resolveTypeInput(NAMED_EVENT_TYPE))
      : resolveTypeInput(responseType).clone();

    if (isAiNamedEventMatcher(responseType)) {
      updateMatcher.addProperty(
        'name',
        toBlueNode(
          requireNonEmpty(responseType.namedEvent, 'named event name'),
        ),
      );
    }

    const incomingEventMatcher = new BlueNode().addProperty(
      'requester',
      toBlueNode(integration.requesterId),
    );
    if (taskName) {
      incomingEventMatcher.addProperty('taskName', toBlueNode(taskName));
    }

    updateMatcher.addProperty(
      'inResponseTo',
      new BlueNode().addProperty('incomingEvent', incomingEventMatcher),
    );

    const matcher = new BlueNode();
    matcher.addProperty(
      'subscriptionId',
      toBlueNode(integration.subscriptionId),
    );
    matcher.addProperty('update', updateMatcher);

    return this.onTriggeredWithMatcher(
      workflowKey,
      MYOS_SUBSCRIPTION_UPDATE_TYPE,
      matcher,
      (steps) => {
        steps.replaceExpression(
          '_SaveAIContext',
          integration.contextPath,
          'event.update.context',
        );
        customizer(steps);
      },
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

  buildJson(): Record<string, unknown> {
    return nodeToAliasJson(this.buildDocument()) as Record<string, unknown>;
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

  private applyAccessState(state: AccessState): this {
    const targetSessionId = requireBlueValueInput(
      state.targetSessionId,
      `access('${state.name}'): targetSessionId is required`,
    );
    const onBehalfOfChannel = requireNonEmpty(
      state.onBehalfOfChannel,
      `access('${state.name}'): onBehalfOf is required`,
    );

    this.ensureMyOsAdmin();

    const token = tokenOf(state.name, 'ACCESS');
    const config: AccessConfig = {
      name: state.name,
      token,
      targetSessionId,
      onBehalfOfChannel,
      requestId: `REQ_ACCESS_${token}`,
      subscriptionId: `SUB_ACCESS_${token}`,
      permissions: createSingleDocumentPermissionSet({
        read: state.read,
        operations: state.operations,
      }),
      statusPath: state.statusPath,
      subscribeAfterGranted: state.subscribeAfterGranted,
      subscriptionEvents: filterTypeInputs(state.subscriptionEvents),
      subscribeToCreatedSessions: state.subscribeToCreatedSessions,
      permissionTiming: state.permissionTiming,
    };

    this.registerAccessConfig(config);

    if (config.statusPath) {
      this.field(config.statusPath, 'pending');
    }

    this.materializePermissionWorkflow(
      `access${token}RequestPermission`,
      config.permissionTiming,
      (steps) =>
        steps
          .myOs()
          .requestSingleDocPermission(
            config.onBehalfOfChannel,
            config.requestId,
            config.targetSessionId.clone(),
            config.permissions.clone(),
          ),
    );

    this.onMyOsResponse(
      `access${token}Granted`,
      'MyOS/Single Document Permission Granted',
      config.requestId,
      (steps) => {
        if (config.statusPath) {
          steps.replaceValue('MarkAccessGranted', config.statusPath, 'granted');
        }

        if (config.subscribeAfterGranted) {
          steps
            .myOs()
            .subscribeToSessionRequested(
              config.targetSessionId.clone(),
              config.subscriptionId,
              {
                stepName: 'SubscribeToGrantedSession',
                events: config.subscriptionEvents,
              },
            );
        }
      },
    );

    this.onMyOsResponse(
      `access${token}Rejected`,
      'MyOS/Single Document Permission Rejected',
      config.requestId,
      (steps) => {
        if (config.statusPath) {
          steps.replaceValue(
            'MarkAccessRejected',
            config.statusPath,
            'rejected',
          );
        }
      },
    );

    this.onMyOsResponse(
      `access${token}Revoked`,
      'MyOS/Single Document Permission Revoked',
      config.requestId,
      (steps) => {
        if (config.statusPath) {
          steps.replaceValue('MarkAccessRevoked', config.statusPath, 'revoked');
        }
      },
    );

    if (config.subscribeAfterGranted) {
      this.onTriggeredWithId(
        `access${token}SubscriptionReady`,
        'MyOS/Subscription to Session Initiated',
        'subscriptionId',
        config.subscriptionId,
        (steps) => {
          if (config.statusPath) {
            steps.replaceValue(
              'MarkAccessSubscribed',
              config.statusPath,
              'subscribed',
            );
          }
        },
      );

      this.onTriggeredWithId(
        `access${token}SubscriptionFailed`,
        'MyOS/Subscription to Session Failed',
        'subscriptionId',
        config.subscriptionId,
        (steps) => {
          if (config.statusPath) {
            steps.replaceValue(
              'MarkAccessSubscriptionFailed',
              config.statusPath,
              'subscription-failed',
            );
          }
        },
      );
    }

    return this;
  }

  private applyLinkedAccessState(state: LinkedAccessState): this {
    const targetSessionId = requireBlueValueInput(
      state.targetSessionId,
      `accessLinked('${state.name}'): targetSessionId is required`,
    );
    const onBehalfOfChannel = requireNonEmpty(
      state.onBehalfOfChannel,
      `accessLinked('${state.name}'): onBehalfOf is required`,
    );
    if (Object.keys(state.links).length === 0) {
      throw new Error(
        `accessLinked('${state.name}'): at least one link(...) is required`,
      );
    }

    this.ensureMyOsAdmin();

    const token = tokenOf(state.name, 'LINKEDACCESS');
    const config: LinkedAccessConfig = {
      name: state.name,
      token,
      targetSessionId,
      onBehalfOfChannel,
      requestId: `REQ_LINKED_ACCESS_${token}`,
      statusPath: state.statusPath,
      links: Object.fromEntries(
        Object.entries(state.links).map(([linkName, linkState]) => [
          linkName,
          createPermissionFlagsNode({
            read: linkState.read,
            operations: linkState.operations,
          }),
        ]),
      ),
      permissionTiming: state.permissionTiming,
    };

    this.registerLinkedAccessConfig(config);

    if (config.statusPath) {
      this.field(config.statusPath, 'pending');
    }

    this.materializePermissionWorkflow(
      `linkedAccess${token}RequestPermission`,
      config.permissionTiming,
      (steps) =>
        steps
          .myOs()
          .requestLinkedDocsPermission(
            config.onBehalfOfChannel,
            config.requestId,
            config.targetSessionId.clone(),
            createLinkedDocumentsPermissionSet(config.links),
          ),
    );

    this.onMyOsResponse(
      `linkedAccess${token}Granted`,
      'MyOS/Linked Documents Permission Granted',
      config.requestId,
      (steps) => {
        if (config.statusPath) {
          steps.replaceValue(
            'MarkLinkedAccessGranted',
            config.statusPath,
            'granted',
          );
        }
      },
    );

    this.onMyOsResponse(
      `linkedAccess${token}Rejected`,
      'MyOS/Linked Documents Permission Rejected',
      config.requestId,
      (steps) => {
        if (config.statusPath) {
          steps.replaceValue(
            'MarkLinkedAccessRejected',
            config.statusPath,
            'rejected',
          );
        }
      },
    );

    this.onMyOsResponse(
      `linkedAccess${token}Revoked`,
      'MyOS/Linked Documents Permission Revoked',
      config.requestId,
      (steps) => {
        if (config.statusPath) {
          steps.replaceValue(
            'MarkLinkedAccessRevoked',
            config.statusPath,
            'revoked',
          );
        }
      },
    );

    return this;
  }

  private applyAgencyState(state: AgencyState): this {
    const onBehalfOfChannel = requireNonEmpty(
      state.onBehalfOfChannel,
      `agency('${state.name}'): onBehalfOf is required`,
    );

    this.ensureMyOsAdmin();
    this.ensureWorkerAgencyMarker();

    const token = tokenOf(state.name, 'AGENCY');
    const config: AgencyConfig = {
      name: state.name,
      token,
      onBehalfOfChannel,
      requestId: `REQ_AGENCY_${token}`,
      allowedWorkerAgencyPermissions: createWorkerAgencyPermissionList({
        allowedTypes: filterTypeInputs(state.allowedTypes),
        allowedOperations: state.allowedOperations,
      }),
      statusPath: state.statusPath,
      permissionTiming: state.permissionTiming,
    };

    this.registerAgencyConfig(config);

    if (config.statusPath) {
      this.field(config.statusPath, 'pending');
    }

    this.materializePermissionWorkflow(
      `agency${token}RequestPermission`,
      config.permissionTiming,
      (steps) =>
        steps
          .myOs()
          .grantWorkerAgencyPermission(
            config.onBehalfOfChannel,
            config.requestId,
            new BlueNode().setItems(
              config.allowedWorkerAgencyPermissions.map((permission) =>
                permission.clone(),
              ),
            ),
          ),
    );

    this.onMyOsResponse(
      `agency${token}Granted`,
      'MyOS/Worker Agency Permission Granted',
      config.requestId,
      (steps) => {
        if (config.statusPath) {
          steps.replaceValue('MarkAgencyGranted', config.statusPath, 'granted');
        }
      },
    );

    this.onMyOsResponse(
      `agency${token}Rejected`,
      'MyOS/Worker Agency Permission Rejected',
      config.requestId,
      (steps) => {
        if (config.statusPath) {
          steps.replaceValue(
            'MarkAgencyRejected',
            config.statusPath,
            'rejected',
          );
        }
      },
    );

    this.onMyOsResponse(
      `agency${token}Revoked`,
      'MyOS/Worker Agency Permission Revoked',
      config.requestId,
      (steps) => {
        if (config.statusPath) {
          steps.replaceValue('MarkAgencyRevoked', config.statusPath, 'revoked');
        }
      },
    );

    return this;
  }

  private applyAiState(state: AIState): this {
    const sessionId = requireBlueValueInput(
      state.sessionId,
      `ai('${state.name}'): sessionId is required`,
    );
    const permissionFromChannel = requireNonEmpty(
      state.permissionFromChannel,
      `ai('${state.name}'): permissionFrom is required`,
    );
    const statusPath = requireNonEmpty(
      state.statusPath,
      `ai('${state.name}'): statusPath is required`,
    );
    const contextPath = requireNonEmpty(
      state.contextPath,
      `ai('${state.name}'): contextPath is required`,
    );
    const requesterId = requireNonEmpty(
      state.requesterId,
      `ai('${state.name}'): requesterId is required`,
    );

    this.ensureMyOsAdmin();

    const token = tokenOf(state.name, 'AI');
    const config: AIIntegrationConfig = {
      name: state.name,
      token,
      sessionId,
      permissionFromChannel,
      statusPath,
      contextPath,
      requesterId,
      requestId: `REQ_${token}`,
      subscriptionId: `SUB_${token}`,
      permissionTiming: state.permissionTiming,
      tasks: cloneAiTaskMap(state.tasks),
    };

    this.registerAiConfig(config);
    this.field(config.statusPath, 'pending');
    this.field(config.contextPath, new BlueNode());

    this.materializePermissionWorkflow(
      `ai${token}RequestPermission`,
      config.permissionTiming,
      (steps) => steps.ai(config.name).requestPermission(),
    );

    this.onMyOsResponse(
      `ai${token}Subscribe`,
      'MyOS/Single Document Permission Granted',
      config.requestId,
      (steps) => steps.ai(config.name).subscribe(),
    );

    this.onTriggeredWithId(
      `ai${token}SubscriptionReady`,
      'MyOS/Subscription to Session Initiated',
      'subscriptionId',
      config.subscriptionId,
      (steps) =>
        steps.replaceValue(`Mark${token}Ready`, config.statusPath, 'ready'),
    );

    this.onMyOsResponse(
      `ai${token}PermissionRejected`,
      'MyOS/Single Document Permission Rejected',
      config.requestId,
      (steps) =>
        steps.replaceValue(`Mark${token}Revoked`, config.statusPath, 'revoked'),
    );

    return this;
  }

  private materializePermissionWorkflow(
    workflowKey: string,
    permissionTiming: PermissionTiming,
    customizer: (steps: StepsBuilder) => void,
  ): void {
    switch (permissionTiming.kind) {
      case 'onInit':
        this.onInit(workflowKey, customizer);
        return;
      case 'onEvent':
        this.onEvent(workflowKey, permissionTiming.eventType, customizer);
        return;
      case 'onDocChange':
        this.onDocChange(workflowKey, permissionTiming.path, customizer);
        return;
      case 'manual':
        return;
    }
  }

  private registerAccessConfig(config: AccessConfig): void {
    if (this.accessConfigs.has(config.name)) {
      throw new Error(`Duplicate access config: ${config.name}`);
    }
    this.accessConfigs.set(config.name, config);
  }

  private registerLinkedAccessConfig(config: LinkedAccessConfig): void {
    if (this.linkedAccessConfigs.has(config.name)) {
      throw new Error(`Duplicate linked access config: ${config.name}`);
    }
    this.linkedAccessConfigs.set(config.name, config);
  }

  private registerAgencyConfig(config: AgencyConfig): void {
    if (this.agencyConfigs.has(config.name)) {
      throw new Error(`Duplicate agency config: ${config.name}`);
    }
    this.agencyConfigs.set(config.name, config);
  }

  private registerAiConfig(config: AIIntegrationConfig): void {
    if (this.aiConfigs.has(config.name)) {
      throw new Error(`Duplicate AI integration: ${config.name}`);
    }
    this.aiConfigs.set(config.name, config);
  }

  private requireAccessConfig(accessName: string): AccessConfig {
    const normalized = requireNonEmpty(accessName, 'access name');
    const config = this.accessConfigs.get(normalized);
    if (!config) {
      throw new Error(`Unknown access: ${normalized}`);
    }
    return config;
  }

  private requireLinkedAccessConfig(
    linkedAccessName: string,
  ): LinkedAccessConfig {
    const normalized = requireNonEmpty(linkedAccessName, 'linked access name');
    const config = this.linkedAccessConfigs.get(normalized);
    if (!config) {
      throw new Error(`Unknown linked access: ${normalized}`);
    }
    return config;
  }

  private requireAgencyConfig(agencyName: string): AgencyConfig {
    const normalized = requireNonEmpty(agencyName, 'agency name');
    const config = this.agencyConfigs.get(normalized);
    if (!config) {
      throw new Error(`Unknown agency: ${normalized}`);
    }
    return config;
  }

  private requireAiIntegration(integrationName: string): AIIntegrationConfig {
    const normalized = requireNonEmpty(integrationName, 'ai integration');
    const config = this.aiConfigs.get(normalized);
    if (!config) {
      throw new Error(`Unknown AI integration: ${normalized}`);
    }
    return config;
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
    const builder = new StepsBuilder(this.createInteractionRegistry());
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

  private buildTriggeredMatcher(
    eventType: TypeInput,
    matcher: BlueValueInput | null | undefined,
  ): BlueNode {
    const triggeredMatcher =
      matcher == null ? new BlueNode() : toBlueNode(matcher);
    triggeredMatcher.setType(resolveTypeInput(eventType, 'event type'));
    return triggeredMatcher;
  }

  private ensureTriggeredChannel(): void {
    const contracts = ensureContracts(this.document);
    if (!contracts.triggeredEventChannel) {
      contracts.triggeredEventChannel = new BlueNode().setType(
        resolveTypeInput(TRIGGERED_EVENT_CHANNEL_TYPE),
      );
    }

    this.trackContract('triggeredEventChannel');
  }

  private ensureMyOsAdmin(): void {
    this.myOsAdmin();
  }

  private isMyOsAdminBaseDocument(): boolean {
    const documentType = this.document.getType();
    const adminBaseBlueId = resolveTypeInput(MYOS_ADMIN_BASE_TYPE).getBlueId();
    if (!documentType || !adminBaseBlueId) {
      return false;
    }

    return INTERNAL_BLUE.isTypeOfBlueId(
      new BlueNode().setType(documentType.clone()),
      adminBaseBlueId,
    );
  }

  private ensureInitChannel(): void {
    const contracts = ensureContracts(this.document);
    if (!contracts.initLifecycleChannel) {
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

    this.trackContract('initLifecycleChannel');
  }

  private ensureWorkerAgencyMarker(): void {
    const contracts = ensureContracts(this.document);
    if (!contracts.workerAgency) {
      contracts.workerAgency = new BlueNode().setType(
        resolveTypeInput('MyOS/MyOS Worker Agency'),
      );
    }

    this.trackContract('workerAgency');
  }

  private createInteractionRegistry(): InteractionConfigRegistry {
    return {
      accessConfigs: new Map(this.accessConfigs),
      linkedAccessConfigs: new Map(this.linkedAccessConfigs),
      agencyConfigs: new Map(this.agencyConfigs),
      aiConfigs: new Map(this.aiConfigs),
    };
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

export class AccessBuilder<P extends DocBuilder> {
  private targetSessionIdValue: BlueValueInput | null = null;
  private onBehalfOfChannel: string | null = null;
  private readValue = false;
  private readonly operationsList: string[] = [];
  private statusPathValue: string | null = null;
  private subscribeAfterGrantedValue = false;
  private readonly subscriptionEventTypes: TypeInput[] = [];
  private subscribeToCreatedSessionsValue = false;
  private permissionTiming: PermissionTiming = { kind: 'onInit' };

  constructor(
    private readonly config: {
      readonly parent: P;
      readonly name: string;
      readonly applyState: (state: AccessState) => P;
    },
  ) {}

  targetSessionId(targetSessionId: BlueValueInput): AccessBuilder<P> {
    this.targetSessionIdValue = targetSessionId;
    return this;
  }

  onBehalfOf(channelKey: string): AccessBuilder<P> {
    this.onBehalfOfChannel = channelKey;
    return this;
  }

  read(read: boolean): AccessBuilder<P> {
    this.readValue = read;
    return this;
  }

  operations(...operations: string[]): AccessBuilder<P> {
    this.operationsList.push(...operations);
    return this;
  }

  statusPath(statusPath: string): AccessBuilder<P> {
    this.statusPathValue = requireNonEmpty(statusPath, 'statusPath');
    return this;
  }

  subscribeAfterGranted(): AccessBuilder<P> {
    this.subscribeAfterGrantedValue = true;
    return this;
  }

  subscriptionEvents(...eventTypes: TypeInput[]): AccessBuilder<P> {
    this.subscriptionEventTypes.push(
      ...eventTypes.filter(
        (eventType): eventType is TypeInput => eventType != null,
      ),
    );
    return this;
  }

  subscribeToCreatedSessions(enabled: boolean): AccessBuilder<P> {
    this.subscribeToCreatedSessionsValue = enabled;
    return this;
  }

  requestPermissionOnInit(): AccessBuilder<P> {
    this.permissionTiming = { kind: 'onInit' };
    return this;
  }

  requestPermissionOnEvent(eventType: TypeInput): AccessBuilder<P> {
    this.permissionTiming = {
      kind: 'onEvent',
      eventType,
    };
    return this;
  }

  requestPermissionOnDocChange(path: string): AccessBuilder<P> {
    this.permissionTiming = {
      kind: 'onDocChange',
      path: requireNonEmpty(path, 'path'),
    };
    return this;
  }

  requestPermissionManually(): AccessBuilder<P> {
    this.permissionTiming = { kind: 'manual' };
    return this;
  }

  done(): P {
    return this.config.applyState({
      name: this.config.name,
      targetSessionId: this.targetSessionIdValue,
      onBehalfOfChannel: this.onBehalfOfChannel,
      read: this.readValue,
      operations: normalizeStringList(this.operationsList),
      statusPath: this.statusPathValue,
      subscribeAfterGranted: this.subscribeAfterGrantedValue,
      subscriptionEvents: this.subscriptionEventTypes,
      subscribeToCreatedSessions: this.subscribeToCreatedSessionsValue,
      permissionTiming: this.permissionTiming,
    });
  }
}

export class LinkedAccessBuilder<P extends DocBuilder> {
  private targetSessionIdValue: BlueValueInput | null = null;
  private onBehalfOfChannel: string | null = null;
  private statusPathValue: string | null = null;
  private readonly linkStates = new Map<string, LinkState>();
  private permissionTiming: PermissionTiming = { kind: 'onInit' };

  constructor(
    private readonly config: {
      readonly parent: P;
      readonly name: string;
      readonly applyState: (state: LinkedAccessState) => P;
    },
  ) {}

  targetSessionId(targetSessionId: BlueValueInput): LinkedAccessBuilder<P> {
    this.targetSessionIdValue = targetSessionId;
    return this;
  }

  onBehalfOf(channelKey: string): LinkedAccessBuilder<P> {
    this.onBehalfOfChannel = channelKey;
    return this;
  }

  statusPath(statusPath: string): LinkedAccessBuilder<P> {
    this.statusPathValue = requireNonEmpty(statusPath, 'statusPath');
    return this;
  }

  link(linkName: string): LinkedAccessLinkBuilder<P> {
    const normalized = requireNonEmpty(linkName, 'link name');
    const existing = this.linkStates.get(normalized) ?? {
      read: false,
      operations: [],
    };

    return new LinkedAccessLinkBuilder({
      parent: this,
      name: normalized,
      initial: existing,
      commit: (state) => {
        this.linkStates.set(normalized, state);
        return this;
      },
    });
  }

  requestPermissionOnInit(): LinkedAccessBuilder<P> {
    this.permissionTiming = { kind: 'onInit' };
    return this;
  }

  requestPermissionOnEvent(eventType: TypeInput): LinkedAccessBuilder<P> {
    this.permissionTiming = {
      kind: 'onEvent',
      eventType,
    };
    return this;
  }

  requestPermissionOnDocChange(path: string): LinkedAccessBuilder<P> {
    this.permissionTiming = {
      kind: 'onDocChange',
      path: requireNonEmpty(path, 'path'),
    };
    return this;
  }

  requestPermissionManually(): LinkedAccessBuilder<P> {
    this.permissionTiming = { kind: 'manual' };
    return this;
  }

  done(): P {
    return this.config.applyState({
      name: this.config.name,
      targetSessionId: this.targetSessionIdValue,
      onBehalfOfChannel: this.onBehalfOfChannel,
      statusPath: this.statusPathValue,
      links: Object.fromEntries(this.linkStates.entries()),
      permissionTiming: this.permissionTiming,
    });
  }
}

export class LinkedAccessLinkBuilder<P extends DocBuilder> {
  private readValue: boolean;
  private readonly operationsList: string[];

  constructor(
    private readonly config: {
      readonly parent: LinkedAccessBuilder<P>;
      readonly name: string;
      readonly initial: LinkState;
      readonly commit: (state: LinkState) => LinkedAccessBuilder<P>;
    },
  ) {
    this.readValue = config.initial.read;
    this.operationsList = [...config.initial.operations];
  }

  read(read: boolean): LinkedAccessLinkBuilder<P> {
    this.readValue = read;
    return this;
  }

  operations(...operations: string[]): LinkedAccessLinkBuilder<P> {
    this.operationsList.push(...operations);
    return this;
  }

  done(): LinkedAccessBuilder<P> {
    return this.config.commit({
      read: this.readValue,
      operations: normalizeStringList(this.operationsList),
    });
  }
}

export class AgencyBuilder<P extends DocBuilder> {
  private onBehalfOfChannel: string | null = null;
  private readonly allowedTypeInputs: TypeInput[] = [];
  private readonly allowedOperationKeys: string[] = [];
  private statusPathValue: string | null = null;
  private permissionTiming: PermissionTiming = { kind: 'onInit' };

  constructor(
    private readonly config: {
      readonly parent: P;
      readonly name: string;
      readonly applyState: (state: AgencyState) => P;
    },
  ) {}

  onBehalfOf(channelKey: string): AgencyBuilder<P> {
    this.onBehalfOfChannel = channelKey;
    return this;
  }

  allowedTypes(...allowedTypes: TypeInput[]): AgencyBuilder<P> {
    this.allowedTypeInputs.push(
      ...allowedTypes.filter(
        (allowedType): allowedType is TypeInput => allowedType != null,
      ),
    );
    return this;
  }

  allowedOperations(...allowedOperations: string[]): AgencyBuilder<P> {
    this.allowedOperationKeys.push(...allowedOperations);
    return this;
  }

  statusPath(statusPath: string): AgencyBuilder<P> {
    this.statusPathValue = requireNonEmpty(statusPath, 'statusPath');
    return this;
  }

  requestPermissionOnInit(): AgencyBuilder<P> {
    this.permissionTiming = { kind: 'onInit' };
    return this;
  }

  requestPermissionOnEvent(eventType: TypeInput): AgencyBuilder<P> {
    this.permissionTiming = {
      kind: 'onEvent',
      eventType,
    };
    return this;
  }

  requestPermissionOnDocChange(path: string): AgencyBuilder<P> {
    this.permissionTiming = {
      kind: 'onDocChange',
      path: requireNonEmpty(path, 'path'),
    };
    return this;
  }

  requestPermissionManually(): AgencyBuilder<P> {
    this.permissionTiming = { kind: 'manual' };
    return this;
  }

  done(): P {
    return this.config.applyState({
      name: this.config.name,
      onBehalfOfChannel: this.onBehalfOfChannel,
      allowedTypes: this.allowedTypeInputs,
      allowedOperations: normalizeStringList(this.allowedOperationKeys),
      statusPath: this.statusPathValue,
      permissionTiming: this.permissionTiming,
    });
  }
}

export class AiIntegrationBuilder<P extends DocBuilder> {
  private sessionIdValue: BlueValueInput | null = null;
  private permissionFromChannel: string | null = null;
  private statusPathValue: string;
  private contextPathValue: string;
  private requesterIdValue: string;
  private permissionTiming: PermissionTiming = { kind: 'onInit' };
  private readonly tasks = new Map<string, AITaskTemplate>();

  constructor(
    private readonly config: {
      readonly parent: P;
      readonly name: string;
      readonly applyState: (state: AIState) => P;
    },
  ) {
    this.statusPathValue = `/ai/${config.name}/status`;
    this.contextPathValue = `/ai/${config.name}/context`;
    this.requesterIdValue = tokenOf(config.name, 'AI');
  }

  sessionId(sessionId: BlueValueInput): AiIntegrationBuilder<P> {
    this.sessionIdValue = sessionId;
    return this;
  }

  permissionFrom(channelKey: string): AiIntegrationBuilder<P> {
    this.permissionFromChannel = requireNonEmpty(channelKey, 'permissionFrom');
    return this;
  }

  statusPath(pointer: string): AiIntegrationBuilder<P> {
    this.statusPathValue = requireNonEmpty(pointer, 'statusPath');
    return this;
  }

  contextPath(pointer: string): AiIntegrationBuilder<P> {
    this.contextPathValue = requireNonEmpty(pointer, 'contextPath');
    return this;
  }

  requesterId(requesterId: string): AiIntegrationBuilder<P> {
    this.requesterIdValue = requireNonEmpty(requesterId, 'requesterId');
    return this;
  }

  requestPermissionOnInit(): AiIntegrationBuilder<P> {
    this.permissionTiming = { kind: 'onInit' };
    return this;
  }

  requestPermissionOnEvent(eventType: TypeInput): AiIntegrationBuilder<P> {
    this.permissionTiming = {
      kind: 'onEvent',
      eventType,
    };
    return this;
  }

  requestPermissionOnDocChange(path: string): AiIntegrationBuilder<P> {
    this.permissionTiming = {
      kind: 'onDocChange',
      path: requireNonEmpty(path, 'path'),
    };
    return this;
  }

  requestPermissionManually(): AiIntegrationBuilder<P> {
    this.permissionTiming = { kind: 'manual' };
    return this;
  }

  task(taskName: string): AITaskBuilder<P> {
    return new AITaskBuilder({
      parent: this,
      taskName: requireNonEmpty(taskName, 'task name'),
      register: (task) => {
        if (this.tasks.has(task.name)) {
          throw new Error(`Duplicate AI task name: ${task.name}`);
        }
        this.tasks.set(task.name, task);
        return this;
      },
    });
  }

  done(): P {
    return this.config.applyState({
      name: this.config.name,
      sessionId: this.sessionIdValue,
      permissionFromChannel: this.permissionFromChannel,
      statusPath: this.statusPathValue,
      contextPath: this.contextPathValue,
      requesterId: this.requesterIdValue,
      permissionTiming: this.permissionTiming,
      tasks: new Map(this.tasks),
    });
  }
}

export class AITaskBuilder<P extends DocBuilder> {
  private readonly instructions: string[] = [];
  private readonly expectedResponses: BlueNode[] = [];
  private readonly expectedNamedEvents: AINamedEventExpectation[] = [];

  constructor(
    private readonly config: {
      readonly parent: AiIntegrationBuilder<P>;
      readonly taskName: string;
      readonly register: (task: AITaskTemplate) => AiIntegrationBuilder<P>;
    },
  ) {}

  instruction(text: string | null | undefined): AITaskBuilder<P> {
    const normalized = text?.trim() ?? '';
    if (normalized.length > 0) {
      this.instructions.push(normalized);
    }
    return this;
  }

  expects(typeInput: TypeInput): AITaskBuilder<P> {
    this.expectedResponses.push(resolveTypeInput(typeInput).clone());
    return this;
  }

  expectsNamed(eventName: string): AITaskBuilder<P>;
  expectsNamed(
    eventName: string,
    fieldsCustomizer: (fields: AINamedEventFieldsBuilder) => void,
  ): AITaskBuilder<P>;
  expectsNamed(eventName: string, ...fieldNames: string[]): AITaskBuilder<P>;
  expectsNamed(
    eventName: string,
    ...rest:
      | []
      | [fieldsCustomizer: (fields: AINamedEventFieldsBuilder) => void]
      | string[]
  ): AITaskBuilder<P> {
    const builder = new AINamedEventFieldsBuilder(eventName);
    const first = rest[0];
    if (typeof first === 'function') {
      first(builder);
    } else {
      for (const fieldName of rest.filter(
        (value): value is string => typeof value === 'string',
      )) {
        builder.field(fieldName);
      }
    }
    this.expectedNamedEvents.push(builder.build());
    return this;
  }

  done(): AiIntegrationBuilder<P> {
    if (this.instructions.length === 0) {
      throw new Error(
        `Task '${this.config.taskName}': at least one instruction required`,
      );
    }

    return this.config.register({
      name: this.config.taskName,
      instructions: [...this.instructions],
      expectedResponses: this.expectedResponses.map((response) =>
        response.clone(),
      ),
      expectedNamedEvents: this.expectedNamedEvents.map((expectation) => ({
        name: expectation.name,
        fields: expectation.fields.map((field) => ({
          name: field.name,
          description: field.description,
        })),
      })),
    });
  }
}

function cloneAiTaskMap(
  tasks: ReadonlyMap<string, AITaskTemplate>,
): ReadonlyMap<string, AITaskTemplate> {
  return new Map(
    [...tasks.entries()].map(([name, task]) => [
      name,
      {
        name: task.name,
        instructions: [...task.instructions],
        expectedResponses: task.expectedResponses.map((response) =>
          response.clone(),
        ),
        expectedNamedEvents: task.expectedNamedEvents.map((expectation) => ({
          name: expectation.name,
          fields: expectation.fields.map((field) => ({
            name: field.name,
            description: field.description,
          })),
        })),
      },
    ]),
  );
}

function isAiNamedEventMatcher(
  value: TypeInput | AIResponseNamedEventMatcher,
): value is AIResponseNamedEventMatcher {
  return (
    value != null &&
    typeof value === 'object' &&
    'namedEvent' in value &&
    typeof (value as { namedEvent?: unknown }).namedEvent === 'string'
  );
}

function createDefaultChannelContract(): BlueNode {
  return new BlueNode().setType(resolveTypeInput(DEFAULT_CHANNEL_TYPE));
}

function filterTypeInputs(values: readonly TypeInput[]): TypeInput[] {
  return values.filter((value): value is TypeInput => value != null);
}

function requireBlueValueInput(
  value: BlueValueInput | null,
  message: string,
): BlueNode {
  if (value == null) {
    throw new Error(message);
  }

  if (typeof value === 'string' && value.trim().length === 0) {
    throw new Error(message);
  }

  return toBlueNode(value);
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
