import { BlueNode } from '@blue-labs/language';
import type { ZodTypeAny } from 'zod';

import type {
  BlueValueInput,
  BootstrapOptionsBuilderLike,
  ChangesetBuilderLike,
  EventPatternInput,
  MyOsCallOperationRequestedOptions,
  MyOsSingleDocumentPermissionGrantRequestedOptions,
  MyOsSubscribeToSessionRequestedOptions,
  StepPayloadBuilder,
  TypeInput,
} from '../types';
import { BootstrapOptionsBuilder } from '../internal/bootstrap-options-builder';
import { ChangesetBuilder } from '../internal/changeset-builder';
import { isBlank, wrapExpression } from '../internal/expression';
import type {
  AccessConfig,
  AgencyConfig,
  InteractionConfigRegistry,
} from '../internal/interactions';
import { EMPTY_INTERACTION_CONFIG_REGISTRY } from '../internal/interactions';
import { NodeObjectBuilder } from '../internal/node-object-builder';
import { resolveTypeInput } from '../internal/type-input';
import { toBlueNode } from '../internal/value-to-node';

type WorkerSessionBindingInput =
  | Record<string, BlueValueInput>
  | ReadonlyMap<string, BlueValueInput>;

type WorkerSessionOptionsCustomizer =
  | ((options: AgencySessionOptionsBuilder) => void)
  | undefined;

type SimpleStepOptions = {
  readonly stepName?: string | null | undefined;
  readonly name?: string | null | undefined;
  readonly description?: string | null | undefined;
};

type RevokeRequestOptions = SimpleStepOptions & {
  readonly reason?: string | null | undefined;
};

export class StepsBuilder {
  private readonly steps: BlueNode[] = [];

  constructor(
    private readonly interactionConfigs: InteractionConfigRegistry = EMPTY_INTERACTION_CONFIG_REGISTRY,
  ) {}

  jsRaw(name: string, code: string): this {
    const step = new BlueNode()
      .setName(requireNonEmpty(name, 'step name'))
      .setType(resolveTypeInput('Conversation/JavaScript Code'));
    step.addProperty('code', toBlueNode(code));
    this.steps.push(step);
    return this;
  }

  updateDocument(
    name: string,
    customizer: (changeset: ChangesetBuilderLike) => void,
  ): this {
    if (typeof customizer !== 'function') {
      throw new Error('changeset customizer is required');
    }

    const changeset = new ChangesetBuilder();
    customizer(changeset);
    return this.addUpdateDocumentStep(
      requireNonEmpty(name, 'step name'),
      new BlueNode().setItems(changeset.build()),
    );
  }

  updateDocumentFromExpression(name: string, expression: string): this {
    return this.addUpdateDocumentStep(
      requireNonEmpty(name, 'step name'),
      toBlueNode(wrapExpression(expression)),
    );
  }

  replaceValue(name: string, path: string, value: BlueValueInput): this {
    return this.updateDocument(name, (changeset) =>
      changeset.replaceValue(path, value),
    );
  }

  replaceExpression(name: string, path: string, expression: string): this {
    return this.updateDocument(name, (changeset) =>
      changeset.replaceExpression(path, expression),
    );
  }

  triggerEvent(name: string, eventNode: BlueNode): this {
    const step = new BlueNode()
      .setName(requireNonEmpty(name, 'step name'))
      .setType(resolveTypeInput('Conversation/Trigger Event'));
    step.addProperty('event', toBlueNode(eventNode));
    this.steps.push(step);
    return this;
  }

  emit(name: string, event: BlueValueInput): this {
    return this.triggerEvent(name, toBlueNode(event));
  }

  emitType(
    name: string,
    typeInput: TypeInput,
    payloadCustomizer?: (eventNode: StepPayloadBuilder) => void,
  ): this {
    const eventNode = NodeObjectBuilder.create().type(typeInput);
    payloadCustomizer?.(eventNode);
    return this.triggerEvent(name, eventNode.build());
  }

  namedEvent(name: string, eventName: string): this;
  namedEvent(
    name: string,
    eventName: string,
    payloadCustomizer: (payload: StepPayloadBuilder) => void,
  ): this;
  namedEvent(
    name: string,
    eventName: string,
    payloadCustomizer?: (payload: StepPayloadBuilder) => void,
  ): this {
    if (isBlank(eventName)) {
      throw new Error('eventName cannot be blank');
    }

    const eventNode = NodeObjectBuilder.create()
      .type('Common/Named Event')
      .put('name', eventName.trim());

    if (payloadCustomizer) {
      const payload = NodeObjectBuilder.create();
      payloadCustomizer(payload);
      const payloadNode = payload.build();
      if (hasMeaningfulContent(payloadNode)) {
        eventNode.putNode('payload', payloadNode);
      }
    }

    return this.triggerEvent(name, eventNode.build());
  }

  bootstrapDocument(
    stepName: string,
    documentNode: BlueValueInput,
    channelBindings: Record<string, string> | ReadonlyMap<string, string>,
  ): this;
  bootstrapDocument(
    stepName: string,
    documentNode: BlueValueInput,
    channelBindings: Record<string, string> | ReadonlyMap<string, string>,
    optionsCustomizer: (options: BootstrapOptionsBuilderLike) => void,
  ): this;
  bootstrapDocument(
    stepName: string,
    documentNode: BlueValueInput,
    channelBindings: Record<string, string> | ReadonlyMap<string, string>,
    optionsCustomizer?: (options: BootstrapOptionsBuilderLike) => void,
  ): this {
    const eventNode = NodeObjectBuilder.create()
      .type('Conversation/Document Bootstrap Requested')
      .putNode('document', documentNode)
      .putStringMap('channelBindings', channelBindings);

    applyBootstrapOptions(eventNode, optionsCustomizer);
    return this.triggerEvent(stepName, eventNode.build());
  }

  bootstrapDocumentExpr(
    stepName: string,
    documentExpression: string,
    channelBindings: Record<string, string> | ReadonlyMap<string, string>,
    optionsCustomizer?: (options: BootstrapOptionsBuilderLike) => void,
  ): this {
    if (isBlank(documentExpression)) {
      throw new Error('documentExpression cannot be blank');
    }

    const eventNode = NodeObjectBuilder.create()
      .type('Conversation/Document Bootstrap Requested')
      .putExpression('document', documentExpression)
      .putStringMap('channelBindings', channelBindings);

    applyBootstrapOptions(eventNode, optionsCustomizer);
    return this.triggerEvent(stepName, eventNode.build());
  }

  ext<TExtension>(
    extensionFactory: (steps: StepsBuilder) => TExtension,
  ): TExtension {
    if (extensionFactory == null) {
      throw new Error('extensionFactory cannot be null');
    }

    const extension = extensionFactory(this);
    if (extension == null) {
      throw new Error('extensionFactory cannot return null');
    }

    return extension;
  }

  myOs(): MyOsSteps {
    return this.ext((steps) => new MyOsSteps(steps));
  }

  access(accessName: string): AccessSteps {
    const normalized = requireNonEmpty(accessName, 'access name');
    const config = this.interactionConfigs.accessConfigs.get(normalized);
    if (!config) {
      throw new Error(
        `Unknown access: '${normalized}'. Define it with .access("${normalized}")...done().`,
      );
    }
    return new AccessSteps(this, config);
  }

  viaAgency(agencyName: string): AgencySteps {
    const normalized = requireNonEmpty(agencyName, 'agency name');
    const config = this.interactionConfigs.agencyConfigs.get(normalized);
    if (!config) {
      throw new Error(
        `Unknown agency: '${normalized}'. Define it with .agency("${normalized}")...done().`,
      );
    }
    return new AgencySteps(this, config);
  }

  raw(stepNode: BlueNode): this {
    this.steps.push(toBlueNode(stepNode));
    return this;
  }

  build(): BlueNode[] {
    return this.steps.map((step) => step.clone());
  }

  private addUpdateDocumentStep(name: string, changesetNode: BlueNode): this {
    const step = new BlueNode()
      .setName(name)
      .setType(resolveTypeInput('Conversation/Update Document'));
    step.addProperty('changeset', changesetNode);
    this.steps.push(step);
    return this;
  }
}

export class MyOsSteps {
  constructor(
    private readonly parent: StepsBuilder,
    private readonly adminChannelKey = 'myOsAdminChannel',
  ) {}

  singleDocumentPermissionGrantRequested(
    onBehalfOf: string,
    targetSessionId: BlueValueInput,
    permissions: BlueValueInput,
    options?: MyOsSingleDocumentPermissionGrantRequestedOptions,
  ): StepsBuilder {
    return this.requestSingleDocPermission(
      onBehalfOf,
      options?.requestId,
      targetSessionId,
      permissions,
      options,
    );
  }

  requestSingleDocPermission(
    onBehalfOf: string,
    requestId: string | null | undefined,
    targetSessionId: BlueValueInput,
    permissions: BlueValueInput,
    options?: SimpleStepOptions,
  ): StepsBuilder {
    requireValueInput(targetSessionId, 'targetSessionId');
    if (permissions == null) {
      throw new Error('permissions is required');
    }

    const eventNode = NodeObjectBuilder.create()
      .type('MyOS/Single Document Permission Grant Requested')
      .put('onBehalfOf', requireNonEmpty(onBehalfOf, 'onBehalfOf'))
      .putNode('targetSessionId', targetSessionId)
      .putNode('permissions', permissions);

    putOptionalStepMetadata(eventNode, options);
    putOptionalString(eventNode, 'requestId', requestId);

    return this.parent.triggerEvent(
      resolveStepName(options?.stepName, 'RequestSingleDocumentPermission'),
      eventNode.build(),
    );
  }

  requestLinkedDocsPermission(
    onBehalfOf: string,
    requestId: string | null | undefined,
    targetSessionId: BlueValueInput,
    links: BlueValueInput,
    options?: SimpleStepOptions,
  ): StepsBuilder {
    requireValueInput(targetSessionId, 'targetSessionId');
    if (links == null) {
      throw new Error('links is required');
    }

    const eventNode = NodeObjectBuilder.create()
      .type('MyOS/Linked Documents Permission Grant Requested')
      .put('onBehalfOf', requireNonEmpty(onBehalfOf, 'onBehalfOf'))
      .putNode('targetSessionId', targetSessionId)
      .putNode('links', links);

    putOptionalStepMetadata(eventNode, options);
    putOptionalString(eventNode, 'requestId', requestId);

    return this.parent.triggerEvent(
      resolveStepName(options?.stepName, 'RequestLinkedDocumentsPermission'),
      eventNode.build(),
    );
  }

  revokeSingleDocPermission(
    requestId: string | null | undefined,
    options?: RevokeRequestOptions,
  ): StepsBuilder {
    return this.emitRevokeRequested(
      'MyOS/Single Document Permission Revoke Requested',
      requestId,
      resolveStepName(options?.stepName, 'RevokeSingleDocumentPermission'),
      options,
    );
  }

  revokeLinkedDocsPermission(
    requestId: string | null | undefined,
    options?: RevokeRequestOptions,
  ): StepsBuilder {
    return this.emitRevokeRequested(
      'MyOS/Linked Documents Permission Revoke Requested',
      requestId,
      resolveStepName(options?.stepName, 'RevokeLinkedDocumentsPermission'),
      options,
    );
  }

  grantWorkerAgencyPermission(
    onBehalfOf: string,
    requestId: string | null | undefined,
    allowedWorkerAgencyPermissions: BlueValueInput,
    options?: SimpleStepOptions,
  ): StepsBuilder {
    if (allowedWorkerAgencyPermissions == null) {
      throw new Error('allowedWorkerAgencyPermissions is required');
    }

    const eventNode = NodeObjectBuilder.create()
      .type('MyOS/Worker Agency Permission Grant Requested')
      .put('onBehalfOf', requireNonEmpty(onBehalfOf, 'onBehalfOf'));

    const permissionsNode = toBlueNode(allowedWorkerAgencyPermissions);
    if (hasMeaningfulContent(permissionsNode)) {
      eventNode.putNode('allowedWorkerAgencyPermissions', permissionsNode);
    }

    putOptionalStepMetadata(eventNode, options);
    putOptionalString(eventNode, 'requestId', requestId);

    return this.parent.triggerEvent(
      resolveStepName(options?.stepName, 'RequestWorkerAgencyPermission'),
      eventNode.build(),
    );
  }

  revokeWorkerAgencyPermission(
    requestId: string | null | undefined,
    options?: RevokeRequestOptions,
  ): StepsBuilder {
    return this.emitRevokeRequested(
      'MyOS/Worker Agency Permission Revoke Requested',
      requestId,
      resolveStepName(options?.stepName, 'RevokeWorkerAgencyPermission'),
      options,
    );
  }

  subscribeToSessionRequested(
    targetSessionId: BlueValueInput,
    subscriptionId: string,
    options?: MyOsSubscribeToSessionRequestedOptions,
  ): StepsBuilder {
    requireValueInput(targetSessionId, 'targetSessionId');

    const subscription = NodeObjectBuilder.create().put(
      'id',
      requireNonEmpty(subscriptionId, 'subscriptionId'),
    );
    if (options?.events != null && options.events.length > 0) {
      subscription.putNode(
        'events',
        new BlueNode().setItems(
          options.events.map((eventPattern) =>
            toEventPatternNode(eventPattern),
          ),
        ),
      );
    }

    const eventNode = NodeObjectBuilder.create()
      .type('MyOS/Subscribe to Session Requested')
      .putNode('targetSessionId', targetSessionId)
      .putNode('subscription', subscription.build());

    putOptionalStepMetadata(eventNode, options);
    putOptionalString(eventNode, 'requestId', options?.requestId);

    return this.parent.triggerEvent(
      resolveStepName(options?.stepName, 'SubscribeToSession'),
      eventNode.build(),
    );
  }

  subscribeToSession(
    targetSessionId: BlueValueInput,
    subscriptionId: string,
    ...eventPatterns: EventPatternInput[]
  ): StepsBuilder {
    return this.subscribeToSessionRequested(targetSessionId, subscriptionId, {
      events: eventPatterns,
    });
  }

  callOperationRequested(
    onBehalfOf: string,
    targetSessionId: BlueValueInput,
    operation: string,
    request?: BlueValueInput,
    options?: MyOsCallOperationRequestedOptions,
  ): StepsBuilder {
    requireValueInput(targetSessionId, 'targetSessionId');

    const eventNode = NodeObjectBuilder.create()
      .type('MyOS/Call Operation Requested')
      .put('onBehalfOf', requireNonEmpty(onBehalfOf, 'onBehalfOf'))
      .putNode('targetSessionId', targetSessionId)
      .put('operation', requireNonEmpty(operation, 'operation'));

    if (request != null) {
      eventNode.putNode('request', request);
    }

    putOptionalStepMetadata(eventNode, options);
    putOptionalString(eventNode, 'requestId', options?.requestId);

    return this.parent.triggerEvent(
      resolveStepName(options?.stepName, 'CallOperation'),
      eventNode.build(),
    );
  }

  callOperation(
    onBehalfOf: string,
    targetSessionId: BlueValueInput,
    operation: string,
    request?: BlueValueInput,
  ): StepsBuilder {
    return this.callOperationRequested(
      onBehalfOf,
      targetSessionId,
      operation,
      request,
    );
  }

  startWorkerSession(
    onBehalfOf: string,
    document: BlueValueInput,
    channelBindings?: WorkerSessionBindingInput,
    optionsCustomizer?: WorkerSessionOptionsCustomizer,
    stepName?: string,
  ): StepsBuilder {
    if (document == null) {
      throw new Error('document is required');
    }

    const eventNode = NodeObjectBuilder.create()
      .type('MyOS/Start Worker Session Requested')
      .put('onBehalfOf', requireNonEmpty(onBehalfOf, 'onBehalfOf'))
      .putNode('document', document);

    const bindingsNode = buildBlueValueMapNode(channelBindings);
    if (bindingsNode) {
      eventNode.putNode('channelBindings', bindingsNode);
    }

    const options = new AgencySessionOptionsBuilder();
    optionsCustomizer?.(options);
    options.applyTo(eventNode);

    return this.parent.triggerEvent(
      resolveStepName(stepName, 'StartWorkerSession'),
      eventNode.build(),
    );
  }

  bootstrapDocument(
    stepName: string,
    documentNode: BlueValueInput,
    channelBindings: Record<string, string> | ReadonlyMap<string, string>,
    optionsCustomizer?: (options: BootstrapOptionsBuilderLike) => void,
  ): StepsBuilder {
    return this.parent.bootstrapDocument(
      stepName,
      documentNode,
      channelBindings,
      (options) => {
        options.assignee(this.adminChannelKey);
        optionsCustomizer?.(options);
      },
    );
  }

  private emitRevokeRequested(
    typeInput: TypeInput,
    requestId: string | null | undefined,
    stepName: string,
    options?: RevokeRequestOptions,
  ): StepsBuilder {
    const eventNode = NodeObjectBuilder.create().type(typeInput);
    putOptionalStepMetadata(eventNode, options);
    putOptionalString(eventNode, 'requestId', requestId);
    putOptionalString(eventNode, 'reason', options?.reason);
    return this.parent.triggerEvent(stepName, eventNode.build());
  }
}

export class AccessSteps {
  constructor(
    private readonly parent: StepsBuilder,
    private readonly config: AccessConfig,
  ) {}

  call(operation: string, request: BlueValueInput | null): StepsBuilder {
    return this.parent
      .myOs()
      .callOperationRequested(
        this.config.onBehalfOfChannel,
        this.config.targetSessionId.clone(),
        operation,
        request ?? undefined,
      );
  }

  callExpr(operation: string, requestExpression: string): StepsBuilder {
    return this.call(operation, wrapExpression(requestExpression));
  }

  requestPermission(stepName = 'RequestPermission'): StepsBuilder {
    return this.parent
      .myOs()
      .requestSingleDocPermission(
        this.config.onBehalfOfChannel,
        this.config.requestId,
        this.config.targetSessionId.clone(),
        this.config.permissions.clone(),
        {
          stepName,
        },
      );
  }

  subscribe(stepName = 'Subscribe'): StepsBuilder {
    return this.parent
      .myOs()
      .subscribeToSessionRequested(
        this.config.targetSessionId.clone(),
        this.config.subscriptionId,
        {
          stepName,
          events: this.config.subscriptionEvents,
        },
      );
  }

  revokePermission(stepName = 'RevokePermission'): StepsBuilder {
    return this.parent.myOs().revokeSingleDocPermission(this.config.requestId, {
      stepName,
    });
  }
}

export class AgencySteps {
  constructor(
    private readonly parent: StepsBuilder,
    private readonly config: AgencyConfig,
  ) {}

  requestPermission(stepName = 'RequestAgencyPermission'): StepsBuilder {
    return this.parent
      .myOs()
      .grantWorkerAgencyPermission(
        this.config.onBehalfOfChannel,
        this.config.requestId,
        new BlueNode().setItems(
          this.config.allowedWorkerAgencyPermissions.map((permission) =>
            permission.clone(),
          ),
        ),
        {
          stepName,
        },
      );
  }

  startSession(
    stepName: string,
    document: BlueValueInput,
    bindingsCustomizer?: (bindings: AgencyBindingsBuilder) => void,
    optionsCustomizer?: (options: AgencySessionOptionsBuilder) => void,
  ): StepsBuilder {
    const bindings = new AgencyBindingsBuilder();
    bindingsCustomizer?.(bindings);

    return this.parent
      .myOs()
      .startWorkerSession(
        this.config.onBehalfOfChannel,
        document,
        bindings.build(),
        optionsCustomizer,
        stepName,
      );
  }
}

export class AgencyBindingsBuilder {
  private readonly bindings = new Map<string, BlueNode>();

  bind(channelKey: string, email: string): this {
    return this.putBinding(channelKey, {
      email: requireNonEmpty(email, 'email'),
    });
  }

  bindAccount(channelKey: string, accountId: string): this {
    return this.putBinding(channelKey, {
      accountId: requireNonEmpty(accountId, 'accountId'),
    });
  }

  bindNode(channelKey: string, binding: BlueValueInput): this {
    return this.putBinding(channelKey, binding);
  }

  bindExpr(channelKey: string, expression: string): this {
    if (isBlank(expression)) {
      throw new Error('expression is required');
    }
    return this.putBinding(channelKey, wrapExpression(expression));
  }

  bindFromCurrentDoc(targetKey: string, sourceKey?: string): this {
    const resolvedSource = requireNonEmpty(
      sourceKey ?? targetKey,
      'source channel key',
    );
    return this.bindExpr(
      requireNonEmpty(targetKey, 'channel key'),
      `document('/contracts/${resolvedSource}')`,
    );
  }

  build(): Record<string, BlueNode> {
    return Object.fromEntries(
      [...this.bindings.entries()].map(([key, value]) => [key, value.clone()]),
    );
  }

  private putBinding(channelKey: string, binding: BlueValueInput): this {
    this.bindings.set(
      requireNonEmpty(channelKey, 'channel key'),
      toBlueNode(binding),
    );
    return this;
  }
}

export class AgencySessionOptionsBuilder {
  private defaultMessageText: string | null = null;
  private readonly channelMessages = new Map<string, string>();
  private readonly capabilityValues = new Map<string, boolean>();
  private requestIdValue: string | null = null;
  private eventNameValue: string | null = null;
  private eventDescriptionValue: string | null = null;

  requestId(requestId: string | null | undefined): this {
    this.requestIdValue = normalizeOptional(requestId);
    return this;
  }

  name(name: string | null | undefined): this {
    this.eventNameValue = normalizeOptional(name);
    return this;
  }

  description(description: string | null | undefined): this {
    this.eventDescriptionValue = normalizeOptional(description);
    return this;
  }

  defaultMessage(text: string | null | undefined): this {
    this.defaultMessageText = normalizeOptional(text);
    return this;
  }

  channelMessage(
    channelKey: string | null | undefined,
    text: string | null | undefined,
  ): this {
    const normalizedKey = normalizeOptional(channelKey);
    const normalizedText = normalizeOptional(text);
    if (normalizedKey && normalizedText) {
      this.channelMessages.set(normalizedKey, normalizedText);
    }
    return this;
  }

  capabilities(
    customizer: (capabilities: AgencySessionCapabilitiesBuilder) => void,
  ): this {
    if (typeof customizer !== 'function') {
      throw new Error('capabilities customizer is required');
    }

    const builder = new AgencySessionCapabilitiesBuilder();
    customizer(builder);
    for (const [key, value] of builder.build().entries()) {
      this.capabilityValues.set(key, value);
    }
    return this;
  }

  applyTo(payload: NodeObjectBuilder): void {
    if (this.requestIdValue) {
      payload.put('requestId', this.requestIdValue);
    }

    if (this.eventNameValue) {
      payload.setName(this.eventNameValue);
    }

    if (this.eventDescriptionValue) {
      payload.setDescription(this.eventDescriptionValue);
    }

    if (this.defaultMessageText || this.channelMessages.size > 0) {
      const initialMessages = NodeObjectBuilder.create();
      if (this.defaultMessageText) {
        initialMessages.put('defaultMessage', this.defaultMessageText);
      }
      if (this.channelMessages.size > 0) {
        initialMessages.putNode(
          'perChannel',
          buildStringRecordNode(this.channelMessages),
        );
      }
      payload.putNode('initialMessages', initialMessages.build());
    }

    if (this.capabilityValues.size > 0) {
      payload.putNode(
        'capabilities',
        buildBooleanRecordNode(this.capabilityValues),
      );
    }
  }
}

export class AgencySessionCapabilitiesBuilder {
  private readonly capabilities = new Map<string, boolean>();

  set(name: string, enabled: boolean): this {
    this.capabilities.set(requireNonEmpty(name, 'capability name'), enabled);
    return this;
  }

  participantsOrchestration(enabled: boolean): this {
    return this.set('participantsOrchestration', enabled);
  }

  build(): ReadonlyMap<string, boolean> {
    return new Map(this.capabilities);
  }
}

function applyBootstrapOptions(
  payload: NodeObjectBuilder,
  optionsCustomizer?: (options: BootstrapOptionsBuilderLike) => void,
): void {
  if (!optionsCustomizer) {
    return;
  }

  const options = new BootstrapOptionsBuilder();
  optionsCustomizer(options);
  options.applyTo(payload);
}

function buildBlueValueMapNode(
  input: WorkerSessionBindingInput | undefined,
): BlueNode | null {
  if (!input) {
    return null;
  }

  const dictionary = new BlueNode();
  const properties: Record<string, BlueNode> = {};
  for (const [rawKey, value] of iterateBlueValueMap(input)) {
    const normalizedKey = rawKey.trim();
    if (normalizedKey.length === 0 || value == null) {
      continue;
    }
    properties[normalizedKey] = toBlueNode(value);
  }

  if (Object.keys(properties).length === 0) {
    return null;
  }

  dictionary.setProperties(properties);
  return dictionary;
}

function buildStringRecordNode(values: ReadonlyMap<string, string>): BlueNode {
  const dictionary = new BlueNode();
  const properties: Record<string, BlueNode> = {};
  for (const [key, value] of values.entries()) {
    properties[key] = toBlueNode(value);
  }
  dictionary.setProperties(properties);
  return dictionary;
}

function buildBooleanRecordNode(
  values: ReadonlyMap<string, boolean>,
): BlueNode {
  const dictionary = new BlueNode();
  const properties: Record<string, BlueNode> = {};
  for (const [key, value] of values.entries()) {
    properties[key] = toBlueNode(value);
  }
  dictionary.setProperties(properties);
  return dictionary;
}

function hasMeaningfulContent(node: BlueNode): boolean {
  return (
    node.getValue() !== undefined ||
    node.getBlueId() !== undefined ||
    node.getType() != null ||
    node.getName() != null ||
    node.getDescription() != null ||
    (node.getItems()?.length ?? 0) > 0 ||
    Object.keys(node.getProperties() ?? {}).length > 0
  );
}

function putOptionalStepMetadata(
  node: NodeObjectBuilder,
  options: SimpleStepOptions | undefined,
): void {
  const name = normalizeOptional(options?.name);
  if (name) {
    node.setName(name);
  }

  const description = normalizeOptional(options?.description);
  if (description) {
    node.setDescription(description);
  }
}

function putOptionalString(
  node: NodeObjectBuilder,
  key: string,
  value: string | null | undefined,
): void {
  const normalized = normalizeOptional(value);
  if (normalized) {
    node.put(key, normalized);
  }
}

function toEventPatternNode(eventPattern: EventPatternInput): BlueNode {
  if (eventPattern == null) {
    throw new Error('eventPattern cannot be null');
  }

  if (typeof eventPattern === 'string') {
    return new BlueNode().setType(resolveTypeInput(eventPattern));
  }

  if (eventPattern instanceof BlueNode) {
    return eventPattern.clone();
  }

  if (isBlueIdObject(eventPattern) || isLikelyZodSchema(eventPattern)) {
    return new BlueNode().setType(resolveTypeInput(eventPattern));
  }

  return toBlueNode(eventPattern as BlueValueInput);
}

function iterateBlueValueMap(
  map: WorkerSessionBindingInput,
): Iterable<[string, BlueValueInput]> {
  return map instanceof Map ? map.entries() : Object.entries(map);
}

function resolveStepName(
  provided: string | null | undefined,
  fallback: string,
): string {
  return normalizeOptional(provided) ?? fallback;
}

function normalizeOptional(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function requireValueInput(value: BlueValueInput, label: string): void {
  if (value == null) {
    throw new Error(`${label} is required`);
  }

  if (typeof value === 'string' && isBlank(value)) {
    throw new Error(`${label} is required`);
  }
}

function isBlueIdObject(value: unknown): value is { blueId: string } {
  return (
    value != null &&
    typeof value === 'object' &&
    'blueId' in value &&
    typeof (value as { blueId?: unknown }).blueId === 'string'
  );
}

function isLikelyZodSchema(value: unknown): value is ZodTypeAny {
  return (
    value != null &&
    typeof value === 'object' &&
    typeof (value as { safeParse?: unknown }).safeParse === 'function' &&
    '_def' in value
  );
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
