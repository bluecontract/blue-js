import { BlueNode } from '@blue-labs/language';
import { AiIntegrationBuilder } from '../ai/ai-builder.js';
import type {
  AIIntegrationConfig,
  AiIntegrationDefinition,
} from '../ai/ai-types.js';
import { AccessBuilder } from '../interactions/access-builder.js';
import { AgencyBuilder } from '../interactions/agency-builder.js';
import { LinkedAccessBuilder } from '../interactions/linked-access-builder.js';
import type {
  AccessConfig,
  AgencyConfig,
  LinkedAccessConfig,
} from '../interactions/types.js';
import { DocJsonState } from '../core/doc-json-state.js';
import {
  ensureExpression,
  fromJsonDocument,
  toOfficialJson,
} from '../core/serialization.js';
import { RuntimeEventTypes } from '../core/runtime-type-support.js';
import { toTypeAlias, type TypeLike } from '../core/type-alias.js';
import type { JsonObject, JsonValue } from '../core/types.js';
import { FieldBuilder, type FieldMetadata } from './field-builder.js';
import {
  OperationBuilder,
  type OperationDefinition,
} from './operation-builder.js';
import { StepsBuilder } from '../steps/steps-builder.js';

type ExistingDoc = JsonObject | BlueNode;
type StepsCustomizer = (steps: StepsBuilder) => void;

function isObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneObject(value: JsonObject): JsonObject {
  return structuredClone(value);
}

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${field} is required`);
  }
  return normalized;
}

function defaultOperationImplementation(steps: StepsBuilder): void {
  steps.jsRaw('EmitEvents', 'return { events: event.message.request };');
}

function aiToken(name: string): string {
  return name
    .replace(/[^A-Za-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .toUpperCase();
}

function canEmitOperationKey(channelKey: string): string {
  return channelKey.endsWith('Channel')
    ? channelKey.replace(/Channel$/u, 'Update')
    : `${channelKey}Update`;
}

type CallResponseListenerMatcher = {
  readonly eventType: string;
  readonly matcher: JsonObject;
};

function isCallResponseMatcherObject(value: unknown): value is JsonObject {
  return isObject(value as JsonValue | undefined);
}

function toCallResponseListenerMatcher(
  responseTypeOrMatcher: TypeLike | JsonObject,
): CallResponseListenerMatcher {
  if (!isCallResponseMatcherObject(responseTypeOrMatcher)) {
    return {
      eventType: toTypeAlias(responseTypeOrMatcher as TypeLike),
      matcher: {},
    };
  }

  const matcherRecord = structuredClone(responseTypeOrMatcher) as Record<
    string,
    unknown
  >;
  const matcherType = matcherRecord.type;
  delete matcherRecord.type;

  return {
    eventType:
      matcherType === undefined
        ? 'Conversation/Response'
        : toTypeAlias(matcherType as TypeLike),
    matcher: matcherRecord as JsonObject,
  };
}

function callResponseEnvelopeWorkflowKey(workflowKey: string): string {
  return `${workflowKey}OnCallResponseEnvelope`;
}

function callResponseFanoutStepName(workflowKey: string): string {
  return `Emit${aiToken(workflowKey)}OnCallResponseItems`;
}

function withRequestIdCorrelationMatcher(
  matcher: JsonObject,
  requestId: string,
): JsonObject {
  const nextMatcher = structuredClone(matcher) as Record<string, unknown>;
  nextMatcher.requestId = requestId;
  const inResponseTo = isObject(
    nextMatcher.inResponseTo as JsonValue | undefined,
  )
    ? (structuredClone(nextMatcher.inResponseTo as JsonObject) as Record<
        string,
        unknown
      >)
    : {};
  inResponseTo.requestId = requestId;
  nextMatcher.inResponseTo = inResponseTo;
  return nextMatcher as JsonObject;
}

function createCallResponseFanoutCode(): string {
  return `const responses = Array.isArray(event.events) ? event.events : [];
return {
  events: responses.filter(
    (response) => response && typeof response === 'object' && !Array.isArray(response),
  ),
};`;
}

export class DocBuilder {
  protected readonly state: DocJsonState;
  private readonly aiIntegrations = new Map<string, AIIntegrationConfig>();
  private readonly accessConfigs = new Map<string, AccessConfig>();
  private readonly linkedAccessConfigs = new Map<string, LinkedAccessConfig>();
  private readonly agencyConfigs = new Map<string, AgencyConfig>();

  protected constructor(initial?: JsonObject) {
    this.state = new DocJsonState(initial);
  }

  static doc(): DocBuilder {
    return new DocBuilder();
  }

  static edit(existingDocument: ExistingDoc): DocBuilder {
    return new DocBuilder(DocBuilder.documentToJson(existingDocument));
  }

  static from(existingDocument: ExistingDoc): DocBuilder {
    return new DocBuilder(DocBuilder.documentToJson(existingDocument));
  }

  static expr(expression: string): string {
    return ensureExpression(expression);
  }

  protected static documentToJson(existingDocument: ExistingDoc): JsonObject {
    if (existingDocument instanceof BlueNode) {
      return toOfficialJson(existingDocument);
    }
    return cloneObject(existingDocument);
  }

  name(name: string): this {
    this.state.setName(name);
    return this;
  }

  description(description: string): this {
    this.state.setDescription(description);
    return this;
  }

  type(typeLike: TypeLike): this {
    this.state.setType(toTypeAlias(typeLike));
    return this;
  }

  field(path: string): FieldBuilder<this>;
  field(path: string, value: JsonValue): this;
  field(path: string, value?: JsonValue): FieldBuilder<this> | this {
    if (arguments.length === 1) {
      this.state.trackField(path);
      return new FieldBuilder<this>(this, path);
    }
    this.state.setValue(path, value as JsonValue);
    return this;
  }

  replace(path: string, value: JsonValue): this {
    this.state.setValue(path, value);
    return this;
  }

  remove(path: string): this {
    this.state.removeValue(path);
    return this;
  }

  section(key: string, title: string, summary?: string): this;
  section(key: string): this;
  section(key: string, title?: string, summary?: string): this {
    this.state.section(key, title, summary);
    return this;
  }

  endSection(): this {
    this.state.endSection();
    return this;
  }

  channel(channelKey: string, contract?: JsonObject): this {
    const key = requireText(channelKey, 'channel key');
    const channelContract = contract
      ? { ...cloneObject(contract), type: contract.type ?? 'Core/Channel' }
      : { type: 'Core/Channel' };
    this.state.setContract(key, channelContract);
    return this;
  }

  channels(...channelKeys: string[]): this {
    for (const channelKey of channelKeys) {
      this.channel(channelKey);
    }
    return this;
  }

  compositeChannel(compositeKey: string, ...channelKeys: string[]): this {
    this.state.setContract(requireText(compositeKey, 'composite channel key'), {
      type: 'Conversation/Composite Timeline Channel',
      channels: channelKeys.map((channelKey) =>
        requireText(channelKey, 'channel key'),
      ),
    });
    return this;
  }

  contract(contractKey: string, contract: JsonObject): this {
    this.state.setContract(
      requireText(contractKey, 'contract key'),
      cloneObject(contract),
    );
    return this;
  }

  contracts(contracts: Record<string, JsonObject>): this {
    for (const [contractKey, contract] of Object.entries(contracts)) {
      this.contract(contractKey, contract);
    }
    return this;
  }

  operation(key: string): OperationBuilder<this>;
  operation(
    key: string,
    channelKey: string,
    description: string,
    implementation?: StepsCustomizer,
  ): this;
  operation(
    key: string,
    channelKey: string,
    requestType: TypeLike,
    description: string,
    implementation?: StepsCustomizer,
  ): this;
  operation(
    key: string,
    channelKey?: string,
    requestOrDescription?: TypeLike | string,
    descriptionOrImplementation?: string | StepsCustomizer,
    implementationMaybe?: StepsCustomizer,
  ): OperationBuilder<this> | this {
    if (channelKey === undefined) {
      return new OperationBuilder<this>(
        this,
        requireText(key, 'operation key'),
      );
    }

    if (requestOrDescription === undefined) {
      const implementation =
        typeof descriptionOrImplementation === 'function'
          ? descriptionOrImplementation
          : implementationMaybe;
      return this.applyOperationDefinition({
        key,
        channelKey,
        clearRequest: false,
        steps: implementation ? this.buildSteps(implementation) : undefined,
      });
    }

    if (typeof requestOrDescription === 'string') {
      if (typeof descriptionOrImplementation === 'string') {
        return this.applyOperationDefinition({
          key,
          channelKey,
          description: descriptionOrImplementation,
          request: { type: requestOrDescription },
          clearRequest: false,
          steps: implementationMaybe
            ? this.buildSteps(implementationMaybe)
            : undefined,
        });
      }

      const description = requestOrDescription;
      const implementation =
        typeof descriptionOrImplementation === 'function'
          ? descriptionOrImplementation
          : implementationMaybe;
      return this.applyOperationDefinition({
        key,
        channelKey,
        description,
        clearRequest: false,
        steps: implementation ? this.buildSteps(implementation) : undefined,
      });
    }

    const requestType = requestOrDescription as TypeLike;
    const description =
      typeof descriptionOrImplementation === 'string'
        ? descriptionOrImplementation
        : undefined;
    const implementation =
      typeof descriptionOrImplementation === 'function'
        ? descriptionOrImplementation
        : implementationMaybe;
    return this.applyOperationDefinition({
      key,
      channelKey,
      description,
      request: { type: toTypeAlias(requestType) },
      clearRequest: false,
      steps: implementation ? this.buildSteps(implementation) : undefined,
    });
  }

  requestDescription(operationKey: string, requestDescription: string): this {
    const contracts = this.state.ensureContractsRoot();
    const existing = contracts[operationKey];
    if (!isObject(existing)) {
      return this;
    }
    const request = isObject(existing.request)
      ? cloneObject(existing.request)
      : {};
    request.description = requestDescription;
    existing.request = request;
    this.state.setContract(operationKey, existing);
    return this;
  }

  onInit(workflowKey: string, customizer: StepsCustomizer): this {
    this.ensureInitLifecycleChannel();
    this.state.setContract(requireText(workflowKey, 'workflow key'), {
      type: 'Conversation/Sequential Workflow',
      channel: 'initLifecycleChannel',
      steps: this.buildSteps(customizer),
    });
    return this;
  }

  onEvent(
    workflowKey: string,
    eventType: TypeLike,
    customizer: StepsCustomizer,
  ): this {
    this.ensureTriggeredEventChannel();
    this.state.setContract(requireText(workflowKey, 'workflow key'), {
      type: 'Conversation/Sequential Workflow',
      channel: 'triggeredEventChannel',
      event: { type: toTypeAlias(eventType) },
      steps: this.buildSteps(customizer),
    });
    return this;
  }

  onNamedEvent(
    workflowKey: string,
    eventName: string,
    customizer: StepsCustomizer,
  ): this {
    return this.onTriggeredWithMatcher(
      workflowKey,
      RuntimeEventTypes.NamedEvent,
      { name: eventName },
      customizer,
    );
  }

  onChannelEvent(
    workflowKey: string,
    channelKey: string,
    eventType: TypeLike,
    customizer: StepsCustomizer,
  ): this {
    const normalizedChannelKey = requireText(channelKey, 'channel key');
    this.state.setContract(requireText(workflowKey, 'workflow key'), {
      type: 'Conversation/Sequential Workflow',
      channel: normalizedChannelKey,
      event: this.resolveChannelEventMatcher(normalizedChannelKey, eventType),
      steps: this.buildSteps(customizer),
    });
    return this;
  }

  onDocChange(
    workflowKey: string,
    path: string,
    customizer: StepsCustomizer,
  ): this {
    const workflow = requireText(workflowKey, 'workflow key');
    const channelKey = `${workflow}DocUpdateChannel`;
    this.state.setContract(channelKey, {
      type: 'Core/Document Update Channel',
      path,
    });
    this.state.setContract(workflow, {
      type: 'Conversation/Sequential Workflow',
      channel: channelKey,
      event: { type: 'Core/Document Update' },
      steps: this.buildSteps(customizer),
    });
    return this;
  }

  workflow(
    workflowKey: string,
    channelKey: string,
    customizer: StepsCustomizer,
    event?: JsonObject,
  ): this {
    this.state.setContract(requireText(workflowKey, 'workflow key'), {
      type: 'Conversation/Sequential Workflow',
      channel: requireText(channelKey, 'channel key'),
      ...(event ? { event: cloneObject(event) } : {}),
      steps: this.buildSteps(customizer),
    });
    return this;
  }

  onTriggeredWithId(
    workflowKey: string,
    eventType: TypeLike,
    idFieldName: 'requestId' | 'subscriptionId',
    idValue: string,
    customizer: StepsCustomizer,
  ): this {
    if (idFieldName === 'requestId') {
      return this.onTriggeredWithMatcher(
        workflowKey,
        eventType,
        {
          requestId: idValue,
          inResponseTo: { requestId: idValue },
        },
        customizer,
      );
    }
    return this.onTriggeredWithMatcher(
      workflowKey,
      eventType,
      { subscriptionId: idValue },
      customizer,
    );
  }

  onTriggeredWithMatcher(
    workflowKey: string,
    eventType: TypeLike,
    matcher: JsonObject,
    customizer: StepsCustomizer,
  ): this {
    this.ensureTriggeredEventChannel();
    this.state.setContract(requireText(workflowKey, 'workflow key'), {
      type: 'Conversation/Sequential Workflow',
      channel: 'triggeredEventChannel',
      event: {
        type: toTypeAlias(eventType),
        ...cloneObject(matcher),
      },
      steps: this.buildSteps(customizer),
    });
    return this;
  }

  onMyOsResponse(
    workflowKey: string,
    responseType: TypeLike,
    customizer: StepsCustomizer,
  ): this;
  onMyOsResponse(
    workflowKey: string,
    responseType: TypeLike,
    requestId: string,
    customizer: StepsCustomizer,
  ): this;
  onMyOsResponse(
    workflowKey: string,
    responseType: TypeLike,
    matcher: JsonObject,
    customizer: StepsCustomizer,
  ): this;
  onMyOsResponse(
    workflowKey: string,
    responseType: TypeLike,
    requestIdOrMatcherOrCustomizer: string | JsonObject | StepsCustomizer,
    customizerMaybe?: StepsCustomizer,
  ): this {
    if (typeof requestIdOrMatcherOrCustomizer === 'function') {
      return this.onTriggeredWithMatcher(
        workflowKey,
        responseType,
        {},
        requestIdOrMatcherOrCustomizer,
      );
    }
    const customizer = customizerMaybe as StepsCustomizer;
    if (typeof requestIdOrMatcherOrCustomizer !== 'string') {
      return this.onTriggeredWithMatcher(
        workflowKey,
        responseType,
        requestIdOrMatcherOrCustomizer,
        customizer,
      );
    }
    return this.onTriggeredWithMatcher(
      workflowKey,
      responseType,
      {
        inResponseTo: {
          requestId: requestIdOrMatcherOrCustomizer,
        },
      },
      customizer,
    );
  }

  onSubscriptionUpdate(
    workflowKey: string,
    subscriptionId: string,
    updateTypeOrCustomizer: TypeLike | StepsCustomizer,
    customizerMaybe?: StepsCustomizer,
  ): this {
    const matcher: JsonObject = {
      subscriptionId: requireText(subscriptionId, 'subscription id'),
    };
    if (customizerMaybe === undefined) {
      return this.onTriggeredWithMatcher(
        workflowKey,
        'MyOS/Subscription Update',
        matcher,
        updateTypeOrCustomizer as StepsCustomizer,
      );
    }
    return this.onTriggeredWithMatcher(
      workflowKey,
      'MyOS/Subscription Update',
      {
        ...matcher,
        update: { type: toTypeAlias(updateTypeOrCustomizer as TypeLike) },
      },
      customizerMaybe,
    );
  }

  ai(integrationName: string): AiIntegrationBuilder<this> {
    this.myOsAdmin();
    return new AiIntegrationBuilder<this>(this, integrationName);
  }

  access(accessName: string): AccessBuilder<this> {
    this.myOsAdmin();
    return new AccessBuilder<this>(
      this,
      requireText(accessName, 'access name'),
    );
  }

  accessLinked(linkedAccessName: string): LinkedAccessBuilder<this> {
    this.myOsAdmin();
    return new LinkedAccessBuilder<this>(
      this,
      requireText(linkedAccessName, 'linked access name'),
    );
  }

  agency(agencyName: string): AgencyBuilder<this> {
    this.myOsAdmin();
    return new AgencyBuilder<this>(
      this,
      requireText(agencyName, 'agency name'),
    );
  }

  onAIResponse(
    integrationName: string,
    workflowKey: string,
    customizer: StepsCustomizer,
  ): this;
  onAIResponse(
    integrationName: string,
    workflowKey: string,
    responseType: TypeLike,
    customizer: StepsCustomizer,
  ): this;
  onAIResponse(
    integrationName: string,
    workflowKey: string,
    responseTypeOrCustomizer: TypeLike | StepsCustomizer,
    customizerMaybe?: StepsCustomizer,
  ): this {
    const integration = this.requireAiIntegration(integrationName);
    if (customizerMaybe === undefined) {
      return this.onAIResponse(
        integrationName,
        workflowKey,
        'Conversation/Response',
        responseTypeOrCustomizer as StepsCustomizer,
      );
    }
    return this.onAIResponseWithMatcher(
      integration,
      workflowKey,
      toTypeAlias(responseTypeOrCustomizer as TypeLike),
      undefined,
      undefined,
      customizerMaybe,
    );
  }

  onAIResponseForTask(
    integrationName: string,
    workflowKey: string,
    taskName: string,
    customizer: StepsCustomizer,
  ): this;
  onAIResponseForTask(
    integrationName: string,
    workflowKey: string,
    responseType: TypeLike,
    taskName: string,
    customizer: StepsCustomizer,
  ): this;
  onAIResponseForTask(
    integrationName: string,
    workflowKey: string,
    responseTypeOrTaskName: TypeLike | string,
    taskNameOrCustomizer: string | StepsCustomizer,
    customizerMaybe?: StepsCustomizer,
  ): this {
    const integration = this.requireAiIntegration(integrationName);
    if (customizerMaybe === undefined) {
      const taskName = responseTypeOrTaskName as string;
      return this.onAIResponseWithMatcher(
        integration,
        workflowKey,
        'Conversation/Response',
        taskName,
        undefined,
        taskNameOrCustomizer as StepsCustomizer,
      );
    }
    return this.onAIResponseWithMatcher(
      integration,
      workflowKey,
      toTypeAlias(responseTypeOrTaskName as TypeLike),
      taskNameOrCustomizer as string,
      undefined,
      customizerMaybe,
    );
  }

  onAINamedResponse(
    integrationName: string,
    workflowKey: string,
    namedEventName: string,
    customizer: StepsCustomizer,
  ): this;
  onAINamedResponse(
    integrationName: string,
    workflowKey: string,
    namedEventName: string,
    taskName: string,
    customizer: StepsCustomizer,
  ): this;
  onAINamedResponse(
    integrationName: string,
    workflowKey: string,
    namedEventName: string,
    taskNameOrCustomizer: string | StepsCustomizer,
    customizerMaybe?: StepsCustomizer,
  ): this {
    const integration = this.requireAiIntegration(integrationName);
    if (customizerMaybe === undefined) {
      return this.onAIResponseWithMatcher(
        integration,
        workflowKey,
        RuntimeEventTypes.NamedEvent,
        undefined,
        namedEventName,
        taskNameOrCustomizer as StepsCustomizer,
      );
    }
    return this.onAIResponseWithMatcher(
      integration,
      workflowKey,
      RuntimeEventTypes.NamedEvent,
      taskNameOrCustomizer as string,
      namedEventName,
      customizerMaybe,
    );
  }

  onAccessGranted(
    accessName: string,
    workflowKey: string,
    customizer: StepsCustomizer,
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
    customizer: StepsCustomizer,
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
    customizer: StepsCustomizer,
  ): this {
    const config = this.requireAccessConfig(accessName);
    return this.onMyOsResponse(
      workflowKey,
      'MyOS/Single Document Permission Revoked',
      config.requestId,
      customizer,
    );
  }

  onUpdate(
    accessName: string,
    workflowKey: string,
    customizer: StepsCustomizer,
  ): this;
  onUpdate(
    accessName: string,
    workflowKey: string,
    updateType: TypeLike,
    customizer: StepsCustomizer,
  ): this;
  onUpdate(
    accessName: string,
    workflowKey: string,
    updateTypeOrCustomizer: TypeLike | StepsCustomizer,
    customizerMaybe?: StepsCustomizer,
  ): this {
    const config = this.requireAccessConfig(accessName);
    if (customizerMaybe === undefined) {
      return this.onSubscriptionUpdate(
        workflowKey,
        config.subscriptionId,
        updateTypeOrCustomizer as StepsCustomizer,
      );
    }
    return this.onSubscriptionUpdate(
      workflowKey,
      config.subscriptionId,
      updateTypeOrCustomizer as TypeLike,
      customizerMaybe,
    );
  }

  onLinkedUpdate(
    linkedAccessName: string,
    workflowKey: string,
    customizer: StepsCustomizer,
  ): this;
  onLinkedUpdate(
    linkedAccessName: string,
    workflowKey: string,
    updateType: TypeLike,
    customizer: StepsCustomizer,
  ): this;
  onLinkedUpdate(
    linkedAccessName: string,
    workflowKey: string,
    updateTypeOrCustomizer: TypeLike | StepsCustomizer,
    customizerMaybe?: StepsCustomizer,
  ): this {
    const config = this.requireLinkedAccessConfig(linkedAccessName);
    const subscriptionId =
      config.subscriptionId ?? `SUB_LINKED_${config.token}`;
    if (customizerMaybe === undefined) {
      return this.onSubscriptionUpdate(
        workflowKey,
        subscriptionId,
        updateTypeOrCustomizer as StepsCustomizer,
      );
    }
    return this.onSubscriptionUpdate(
      workflowKey,
      subscriptionId,
      updateTypeOrCustomizer as TypeLike,
      customizerMaybe,
    );
  }

  onLinkedAccessGranted(
    linkedAccessName: string,
    workflowKey: string,
    customizer: StepsCustomizer,
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
    customizer: StepsCustomizer,
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
    customizer: StepsCustomizer,
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
    customizer: StepsCustomizer,
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
    customizer: StepsCustomizer,
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
    customizer: StepsCustomizer,
  ): this {
    const config = this.requireAgencyConfig(agencyName);
    return this.onMyOsResponse(
      workflowKey,
      'MyOS/Worker Agency Permission Revoked',
      config.requestId,
      customizer,
    );
  }

  onCallResponse(
    accessName: string,
    workflowKey: string,
    customizer: StepsCustomizer,
  ): this;
  onCallResponse(
    accessName: string,
    workflowKey: string,
    responseType: TypeLike,
    customizer: StepsCustomizer,
  ): this;
  onCallResponse(
    accessName: string,
    workflowKey: string,
    responseMatcher: JsonObject,
    customizer: StepsCustomizer,
  ): this;
  onCallResponse(
    accessName: string,
    workflowKey: string,
    responseTypeOrMatcherOrCustomizer: TypeLike | JsonObject | StepsCustomizer,
    customizerMaybe?: StepsCustomizer,
  ): this {
    const config = this.requireAccessConfig(accessName);
    if (customizerMaybe === undefined) {
      return this.onTriggeredWithMatcher(
        workflowKey,
        'MyOS/Call Operation Responded',
        {
          inResponseTo: {
            requestId: config.requestId,
          },
        },
        responseTypeOrMatcherOrCustomizer as StepsCustomizer,
      );
    }

    const workflow = requireText(workflowKey, 'workflow key');
    const listener = toCallResponseListenerMatcher(
      responseTypeOrMatcherOrCustomizer as TypeLike | JsonObject,
    );
    this.onEvent(
      callResponseEnvelopeWorkflowKey(workflow),
      'MyOS/Call Operation Responded',
      (steps) =>
        steps.jsRaw(
          callResponseFanoutStepName(workflow),
          createCallResponseFanoutCode(),
        ),
    );
    return this.onTriggeredWithMatcher(
      workflow,
      listener.eventType,
      withRequestIdCorrelationMatcher(listener.matcher, config.requestId),
      customizerMaybe,
    );
  }

  onSessionCreated(
    accessName: string,
    workflowKey: string,
    customizer: StepsCustomizer,
  ): this {
    const config = this.requireAccessConfig(accessName);
    return this.onTriggeredWithId(
      workflowKey,
      'MyOS/Subscription to Session Initiated',
      'subscriptionId',
      config.subscriptionId,
      customizer,
    );
  }

  onAgencyUpdate(
    agencyName: string,
    workflowKey: string,
    subscriptionId: string,
    customizer: StepsCustomizer,
  ): this;
  onAgencyUpdate(
    agencyName: string,
    workflowKey: string,
    subscriptionId: string,
    updateType: TypeLike,
    customizer: StepsCustomizer,
  ): this;
  onAgencyUpdate(
    agencyName: string,
    workflowKey: string,
    subscriptionId: string,
    updateTypeOrCustomizer: TypeLike | StepsCustomizer,
    customizerMaybe?: StepsCustomizer,
  ): this {
    this.requireAgencyConfig(agencyName);
    if (customizerMaybe === undefined) {
      return this.onSubscriptionUpdate(
        workflowKey,
        subscriptionId,
        updateTypeOrCustomizer as StepsCustomizer,
      );
    }
    return this.onSubscriptionUpdate(
      workflowKey,
      subscriptionId,
      updateTypeOrCustomizer as TypeLike,
      customizerMaybe,
    );
  }

  onLinkedDocGranted(
    linkedAccessName: string,
    workflowKey: string,
    customizer: StepsCustomizer,
  ): this {
    const config = this.requireLinkedAccessConfig(linkedAccessName);
    return this.onTriggeredWithMatcher(
      workflowKey,
      'MyOS/Single Document Permission Granted',
      {
        inResponseTo: {
          requestId: config.requestId,
        },
      },
      customizer,
    );
  }

  onLinkedDocRevoked(
    linkedAccessName: string,
    workflowKey: string,
    customizer: StepsCustomizer,
  ): this {
    const config = this.requireLinkedAccessConfig(linkedAccessName);
    return this.onTriggeredWithMatcher(
      workflowKey,
      'MyOS/Single Document Permission Revoked',
      {
        inResponseTo: {
          requestId: config.requestId,
        },
      },
      customizer,
    );
  }

  onSessionStarting(
    agencyName: string,
    workflowKey: string,
    customizer: StepsCustomizer,
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
    customizer: StepsCustomizer,
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
    customizer: StepsCustomizer,
  ): this {
    this.requireAgencyConfig(agencyName);
    return this.onEvent(workflowKey, 'MyOS/Bootstrap Failed', customizer);
  }

  onParticipantResolved(
    workflowKey: string,
    customizer: StepsCustomizer,
  ): this {
    return this.onEvent(workflowKey, 'MyOS/Participant Resolved', customizer);
  }

  onAllParticipantsReady(
    workflowKey: string,
    customizer: StepsCustomizer,
  ): this {
    return this.onEvent(workflowKey, 'MyOS/All Participants Ready', customizer);
  }

  participantsOrchestration(
    contractKey = 'participantsOrchestration',
    contract?: JsonObject,
  ): this {
    return this.setMyOsMarkerContract(
      contractKey,
      'MyOS/MyOS Participants Orchestration',
      contract,
    );
  }

  sessionInteraction(
    contractKey = 'sessionInteraction',
    contract?: JsonObject,
  ): this {
    return this.setMyOsMarkerContract(
      contractKey,
      'MyOS/MyOS Session Interaction',
      contract,
    );
  }

  workerAgency(contractKey = 'workerAgency', contract?: JsonObject): this {
    return this.setMyOsMarkerContract(
      contractKey,
      'MyOS/MyOS Worker Agency',
      contract,
    );
  }

  myOsAdmin(channelKey = 'myOsAdminChannel'): this {
    this.channel(channelKey, { type: 'MyOS/MyOS Timeline Channel' });
    this.canEmit(channelKey);
    return this;
  }

  registerAiIntegration(definition: AiIntegrationDefinition): this {
    const name = definition.name.trim();
    const sessionId = (definition.sessionId ?? '').trim();
    const permissionFrom = (definition.permissionFrom ?? '').trim();
    if (!sessionId || !permissionFrom) {
      throw new Error(`ai('${name}') requires sessionId and permissionFrom`);
    }

    const config: AIIntegrationConfig = {
      name,
      sessionId,
      permissionFrom,
      statusPath: definition.statusPath,
      contextPath: definition.contextPath,
      requesterId: definition.requesterId,
      requestId: definition.requestId,
      subscriptionId: definition.subscriptionId,
      permissionTiming: definition.permissionTiming,
      permissionTriggerEventType: definition.permissionTriggerEventType,
      permissionTriggerDocPath: definition.permissionTriggerDocPath,
      tasks: structuredClone(definition.tasks),
    };
    this.aiIntegrations.set(name, config);
    this.state.setValue(config.statusPath, 'idle');
    this.state.setValue(config.contextPath, {});

    const token = aiToken(name);
    const requestPermissionWorkflow = (steps: StepsBuilder): void => {
      steps
        .myOs()
        .requestSingleDocPermission(
          config.permissionFrom,
          config.requestId,
          config.sessionId,
          {
            read: true,
            singleOps: ['provideInstructions'],
          },
        )
        .replaceValue(
          'SetAIPermissionStatusPending',
          config.statusPath,
          'pending',
        );
    };

    switch (config.permissionTiming) {
      case 'onInit':
        this.onInit(`request${token}Permission`, requestPermissionWorkflow);
        break;
      case 'onEvent':
        this.onEvent(
          `request${token}Permission`,
          config.permissionTriggerEventType ?? 'Conversation/Event',
          requestPermissionWorkflow,
        );
        break;
      case 'onDocChange':
        this.onDocChange(
          `request${token}Permission`,
          config.permissionTriggerDocPath ?? '/',
          requestPermissionWorkflow,
        );
        break;
      case 'manual':
      default:
        break;
    }

    if (config.permissionTiming !== 'manual') {
      this.onMyOsResponse(
        `subscribe${token}OnGranted`,
        'MyOS/Single Document Permission Granted',
        config.requestId,
        (steps) =>
          steps
            .myOs()
            .subscribeToSessionWithMatchers(
              config.sessionId,
              config.subscriptionId,
              [
                'Conversation/Response',
                {
                  type: RuntimeEventTypes.NamedEvent,
                },
              ],
            ),
      );
    }

    this.onTriggeredWithId(
      `mark${token}SubscriptionReady`,
      'MyOS/Subscription to Session Initiated',
      'subscriptionId',
      config.subscriptionId,
      (steps) =>
        steps.replaceValue('SetAIStatusReady', config.statusPath, 'ready'),
    );

    return this;
  }

  registerAccessConfig(config: AccessConfig): this {
    this.accessConfigs.set(config.name, structuredClone(config));
    return this;
  }

  registerLinkedAccessConfig(config: LinkedAccessConfig): this {
    this.linkedAccessConfigs.set(config.name, structuredClone(config));
    return this;
  }

  registerAgencyConfig(config: AgencyConfig): this {
    this.agencyConfigs.set(config.name, structuredClone(config));
    return this;
  }

  canEmit(channelKey: string, ...allowedEventTypes: TypeLike[]): this {
    const normalizedChannel = requireText(channelKey, 'channel key');
    const operationKey = canEmitOperationKey(normalizedChannel);
    const request: JsonObject = { type: 'List' };
    if (allowedEventTypes.length > 0) {
      request.events = allowedEventTypes.map((typeLike) => ({
        type: toTypeAlias(typeLike),
      }));
    }

    this.applyOperationDefinition({
      key: operationKey,
      channelKey: normalizedChannel,
      description: 'Operation for emitting events through channel',
      request,
      clearRequest: false,
      steps: this.buildSteps(defaultOperationImplementation),
    });
    return this;
  }

  contractsPolicy(requireSectionChanges = true, key = 'contractsPolicy'): this {
    this.state.setContract(key, {
      type: 'Conversation/Contracts Change Policy',
      requireSectionChanges,
    });
    return this;
  }

  directChange(
    operationKey = 'changeDocument',
    channelKey = 'ownerChannel',
    description = 'Apply Conversation/Change Request directly',
  ): this {
    this.contractsPolicy(true);
    this.state.setContract(operationKey, {
      type: 'Conversation/Change Operation',
      channel: channelKey,
      description,
      request: {
        type: 'Conversation/Change Request',
      },
    });
    this.state.setContract(`${operationKey}Impl`, {
      type: 'Conversation/Change Workflow',
      operation: operationKey,
    });
    return this;
  }

  proposeChange(
    operationKey = 'proposeChange',
    channelKey = 'ownerChannel',
    postfix = '',
  ): this {
    this.contractsPolicy(true);
    this.state.setContract(operationKey, {
      type: 'Conversation/Propose Change Operation',
      channel: channelKey,
    });
    this.state.setContract(`${operationKey}Impl`, {
      type: 'Conversation/Propose Change Workflow',
      operation: operationKey,
      ...(postfix ? { postfix } : {}),
    });
    return this;
  }

  acceptChange(
    operationKey = 'acceptChange',
    channelKey = 'ownerChannel',
    postfix = '',
  ): this {
    this.contractsPolicy(true);
    this.state.setContract(operationKey, {
      type: 'Conversation/Accept Change Operation',
      channel: channelKey,
    });
    this.state.setContract(`${operationKey}Impl`, {
      type: 'Conversation/Accept Change Workflow',
      operation: operationKey,
      ...(postfix ? { postfix } : {}),
    });
    return this;
  }

  rejectChange(
    operationKey = 'rejectChange',
    channelKey = 'ownerChannel',
    postfix = '',
  ): this {
    this.contractsPolicy(true);
    this.state.setContract(operationKey, {
      type: 'Conversation/Reject Change Operation',
      channel: channelKey,
    });
    this.state.setContract(`${operationKey}Impl`, {
      type: 'Conversation/Reject Change Workflow',
      operation: operationKey,
      ...(postfix ? { postfix } : {}),
    });
    return this;
  }

  documentAnchors(
    anchors:
      | string[]
      | Record<string, JsonObject>
      | ((anchors: JsonObject) => void),
    contractKey = 'anchors',
  ): this {
    const existing = this.state.ensureContractsRoot()[contractKey];
    const contract: JsonObject =
      isObject(existing) && typeof existing.type === 'string'
        ? cloneObject(existing)
        : {
            type: 'MyOS/Document Anchors',
          };
    contract.type = 'MyOS/Document Anchors';
    if (Array.isArray(anchors)) {
      for (const anchorName of anchors) {
        const key = requireText(anchorName, 'anchor name');
        contract[key] = { type: 'MyOS/Document Anchor' };
      }
    } else if (typeof anchors === 'function') {
      anchors(contract);
    } else {
      for (const [anchorName, anchorDef] of Object.entries(anchors)) {
        const key = requireText(anchorName, 'anchor name');
        contract[key] = cloneObject(anchorDef);
      }
    }
    this.state.setContract(contractKey, contract);
    return this;
  }

  documentLinks(
    links: Record<string, JsonObject>,
    contractKey = 'links',
  ): this {
    const existing = this.state.ensureContractsRoot()[contractKey];
    const contract: JsonObject =
      isObject(existing) && typeof existing.type === 'string'
        ? cloneObject(existing)
        : {
            type: 'MyOS/Document Links',
          };
    contract.type = 'MyOS/Document Links';
    for (const [linkName, linkDef] of Object.entries(links)) {
      contract[requireText(linkName, 'link name')] = cloneObject(linkDef);
    }
    this.state.setContract(contractKey, contract);
    return this;
  }

  sessionLink(
    linkName: string,
    anchor: string,
    sessionId: string,
    contractKey = 'links',
  ): this {
    return this.documentLinks(
      {
        [linkName]: {
          type: 'MyOS/MyOS Session Link',
          anchor,
          sessionId,
        },
      },
      contractKey,
    );
  }

  documentLink(
    linkName: string,
    anchor: string,
    documentId: string,
    contractKey = 'links',
  ): this {
    return this.documentLinks(
      {
        [linkName]: {
          type: 'MyOS/Document Link',
          anchor,
          documentId,
        },
      },
      contractKey,
    );
  }

  documentTypeLink(
    linkName: string,
    anchor: string,
    documentTypeBlueId: string,
    contractKey = 'links',
  ): this {
    return this.documentLinks(
      {
        [linkName]: {
          type: 'MyOS/Document Type Link',
          anchor,
          documentType: {
            blueId: documentTypeBlueId,
          },
        },
      },
      contractKey,
    );
  }

  buildJson(): JsonObject {
    return this.state.build();
  }

  buildDocument(): BlueNode {
    return fromJsonDocument(this.buildJson());
  }

  applyFieldMetadata(field: FieldMetadata): this {
    const existing = this.state.getValue(field.path);
    const next: JsonObject = isObject(existing) ? cloneObject(existing) : {};

    if (
      !isObject(existing) &&
      existing !== undefined &&
      !field.hasExplicitValue
    ) {
      next.value = existing;
    }
    if (field.hasExplicitValue) {
      next.value = field.value as JsonValue;
    }
    if (field.typeAlias) {
      next.type = field.typeAlias;
    }
    if (field.description) {
      next.description = field.description;
    }

    const constraints: JsonObject = {};
    if (field.required !== undefined) {
      constraints.required = field.required;
    }
    if (field.minimum !== undefined) {
      constraints.minimum = field.minimum;
    }
    if (field.maximum !== undefined) {
      constraints.maximum = field.maximum;
    }
    if (Object.keys(constraints).length > 0) {
      next.constraints = constraints;
    }

    if (Object.keys(next).length === 0) {
      return this;
    }
    this.state.setValue(field.path, next);
    return this;
  }

  applyOperationDefinition(definition: OperationDefinition): this {
    const key = requireText(definition.key, 'operation key');
    const contracts = this.state.ensureContractsRoot();
    const existing = contracts[key];
    const operation = isObject(existing) ? cloneObject(existing) : {};
    operation.type = 'Conversation/Operation';
    operation.channel = definition.channelKey ?? operation.channel;
    if (!operation.channel) {
      throw new Error(
        `Operation '${key}' has no channel. Set it via operation(...channel...)`,
      );
    }
    if (definition.description !== undefined) {
      operation.description = definition.description;
    }
    if (definition.request !== undefined) {
      const existingRequest = isObject(operation.request)
        ? cloneObject(operation.request)
        : {};
      operation.request = {
        ...existingRequest,
        ...cloneObject(definition.request),
      };
    } else if (definition.clearRequest) {
      delete operation.request;
    }

    this.state.setContract(key, operation);

    if (definition.steps !== undefined) {
      this.state.setContract(`${key}Impl`, {
        type: 'Conversation/Sequential Workflow Operation',
        operation: key,
        steps: structuredClone(definition.steps),
      });
    }
    return this;
  }

  protected buildSteps(customizer: StepsCustomizer): JsonObject[] {
    const steps = this.createStepsBuilder();
    customizer(steps);
    return steps.build();
  }

  createStepsBuilder(): StepsBuilder {
    return new StepsBuilder({
      aiIntegrations: Object.fromEntries(this.aiIntegrations.entries()),
      accessConfigs: Object.fromEntries(this.accessConfigs.entries()),
      linkedAccessConfigs: Object.fromEntries(
        this.linkedAccessConfigs.entries(),
      ),
      agencyConfigs: Object.fromEntries(this.agencyConfigs.entries()),
    });
  }

  private onAIResponseWithMatcher(
    integration: AIIntegrationConfig,
    workflowKey: string,
    responseType: string,
    taskName: string | undefined,
    namedEventName: string | undefined,
    customizer: StepsCustomizer,
  ): this {
    if (taskName) {
      this.assertAiTaskExists(integration, taskName);
    }
    const normalizedTaskName = taskName?.trim();
    return this.onTriggeredWithMatcher(
      workflowKey,
      'MyOS/Subscription Update',
      {
        subscriptionId: integration.subscriptionId,
        update: {
          type: responseType,
          ...(namedEventName ? { name: namedEventName } : {}),
          inResponseTo: {
            incomingEvent: {
              requester: integration.requesterId,
              ...(normalizedTaskName ? { taskName: normalizedTaskName } : {}),
            },
          },
        },
      },
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

  private requireAiIntegration(name: string): AIIntegrationConfig {
    const key = name.trim();
    const integration = this.aiIntegrations.get(key);
    if (!integration) {
      throw new Error(`Unknown AI integration: ${name}`);
    }
    return integration;
  }

  private assertAiTaskExists(
    integration: AIIntegrationConfig,
    taskName: string,
  ): void {
    const normalized = taskName.trim();
    if (!integration.tasks[normalized]) {
      throw new Error(
        `Unknown AI task '${normalized}' for integration '${integration.name}'`,
      );
    }
  }

  private requireAccessConfig(name: string): AccessConfig {
    const config = this.accessConfigs.get(name.trim());
    if (!config) {
      throw new Error(`Unknown access: ${name}`);
    }
    return config;
  }

  private requireLinkedAccessConfig(name: string): LinkedAccessConfig {
    const config = this.linkedAccessConfigs.get(name.trim());
    if (!config) {
      throw new Error(`Unknown linked access: ${name}`);
    }
    return config;
  }

  private requireAgencyConfig(name: string): AgencyConfig {
    const config = this.agencyConfigs.get(name.trim());
    if (!config) {
      throw new Error(`Unknown agency: ${name}`);
    }
    return config;
  }

  private ensureTriggeredEventChannel(): void {
    this.state.setContract('triggeredEventChannel', {
      type: 'Core/Triggered Event Channel',
    });
  }

  private ensureInitLifecycleChannel(): void {
    this.state.setContract('initLifecycleChannel', {
      type: 'Core/Lifecycle Event Channel',
      event: { type: 'Core/Document Processing Initiated' },
    });
  }

  private resolveChannelEventMatcher(
    channelKey: string,
    eventType: TypeLike,
  ): JsonObject {
    const matcher = { type: toTypeAlias(eventType) };
    if (!this.isTimelineLikeChannel(channelKey)) {
      return matcher;
    }
    if (this.isTimelineEntryMatcher(matcher.type)) {
      return matcher;
    }
    return {
      message: matcher,
    };
  }

  private isTimelineLikeChannel(channelKey: string): boolean {
    const contract = this.state.ensureContractsRoot()[channelKey];
    if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
      return false;
    }
    const type = (contract as JsonObject).type;
    return (
      type === 'Conversation/Timeline Channel' ||
      type === 'Conversation/Composite Timeline Channel' ||
      type === 'MyOS/MyOS Timeline Channel'
    );
  }

  private isTimelineEntryMatcher(typeAlias: string): boolean {
    return (
      typeAlias === 'Conversation/Timeline Entry' ||
      typeAlias === 'MyOS/MyOS Timeline Entry'
    );
  }

  private setMyOsMarkerContract(
    contractKey: string,
    markerType: string,
    contract?: JsonObject,
  ): this {
    this.state.setContract(requireText(contractKey, 'contract key'), {
      ...(contract ? cloneObject(contract) : {}),
      type: markerType,
    });
    return this;
  }
}
