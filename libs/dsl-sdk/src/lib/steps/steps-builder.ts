import { ensureExpression } from '../core/serialization.js';
import { toTypeAlias, type TypeLike } from '../core/type-alias.js';
import type { JsonObject, JsonValue } from '../core/types.js';
import {
  assertRepositoryTypeAliasAvailable,
  RuntimeEventTypes,
} from '../core/runtime-type-support.js';
import type { AIIntegrationConfig } from '../ai/ai-types.js';
import type {
  AccessConfig,
  AgencyConfig,
  LinkedAccessConfig,
} from '../interactions/types.js';
import { AccessSteps, LinkedAccessSteps } from './access-steps.js';
import { AgencySteps } from './agency-steps.js';
import { MyOsSteps } from './myos-steps.js';
import { MyOsPermissions } from './myos-permissions.js';

export class ChangesetBuilder {
  private readonly entries: JsonObject[] = [];

  replaceValue(path: string, value: JsonValue): this {
    this.entries.push({ op: 'replace', path, val: value });
    return this;
  }

  replaceExpression(path: string, expression: string): this {
    this.entries.push({
      op: 'replace',
      path,
      val: ensureExpression(expression),
    });
    return this;
  }

  addValue(path: string, value: JsonValue): this {
    this.entries.push({ op: 'add', path, val: value });
    return this;
  }

  remove(path: string): this {
    this.entries.push({ op: 'remove', path });
    return this;
  }

  build(): JsonObject[] {
    return structuredClone(this.entries);
  }
}

export class EventPayloadBuilder {
  private readonly payload: JsonObject = {};

  put(key: string, value: JsonValue): this {
    this.payload[key] = value;
    return this;
  }

  putExpression(key: string, expression: string): this {
    this.payload[key] = ensureExpression(expression);
    return this;
  }

  build(): JsonObject {
    return structuredClone(this.payload);
  }
}

function requireStepName(name: string): string {
  const normalized = name.trim();
  if (normalized.length === 0) {
    throw new Error('step name is required');
  }
  return normalized;
}

function step(name: string, type: string, extra: JsonObject): JsonObject {
  return { name: requireStepName(name), type, ...extra };
}

function toEventNode(type: TypeLike, payload: JsonObject): JsonObject {
  return {
    type: toTypeAlias(type),
    ...payload,
  };
}

function ensureProcessor(payloadBuilder: PaymentRequestPayloadBuilder): void {
  const processor = payloadBuilder.processorName();
  if (!processor) {
    throw new Error('payment payload requires processor');
  }
}

function copyEntries(source: JsonObject): JsonObject {
  return structuredClone(source);
}

type BootstrapPayloadCustomizer = (payload: EventPayloadBuilder) => void;

function requireText(value: unknown, message: string): string {
  if (typeof value !== 'string') {
    throw new Error(message);
  }
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(message);
  }
  return normalized;
}

type RailKey =
  | 'routingNumber'
  | 'accountNumber'
  | 'accountType'
  | 'network'
  | 'companyEntryDescription'
  | 'ibanFrom'
  | 'ibanTo'
  | 'bicTo'
  | 'remittanceInformation'
  | 'bankSwift'
  | 'bankName'
  | 'beneficiaryName'
  | 'beneficiaryAddress'
  | 'cardOnFileRef'
  | 'merchantDescriptor'
  | 'networkToken'
  | 'tokenProvider'
  | 'cryptogram'
  | 'creditLineId'
  | 'merchantAccountId'
  | 'cardholderAccountId'
  | 'ledgerAccountFrom'
  | 'ledgerAccountTo'
  | 'memo'
  | 'asset'
  | 'chain'
  | 'fromWalletRef'
  | 'toAddress'
  | 'txPolicy';

class RailBuilderBase<P> {
  constructor(protected readonly parent: P) {}

  done(): P {
    return this.parent;
  }
}

class PutRailBuilder<P> extends RailBuilderBase<P> {
  constructor(
    parent: P,
    private readonly putValue: (key: RailKey, value: JsonValue) => void,
  ) {
    super(parent);
  }

  put(key: RailKey, value: JsonValue): this {
    this.putValue(key, value);
    return this;
  }
}

export class PaymentRequestPayloadBuilder {
  private readonly payload: JsonObject = {};
  private processorValue: string | undefined;

  processor(processor: string): this {
    this.processorValue = processor.trim();
    this.payload.processor = this.processorValue;
    return this;
  }

  payer(payer: JsonValue): this {
    this.payload.payer = payer;
    return this;
  }

  payee(payee: JsonValue): this {
    this.payload.payee = payee;
    return this;
  }

  from(from: JsonValue): this {
    this.payload.from = from;
    return this;
  }

  to(to: JsonValue): this {
    this.payload.to = to;
    return this;
  }

  currency(currency: string): this {
    this.payload.currency = currency;
    return this;
  }

  amountMinor(amountMinor: number): this {
    this.payload.amount = amountMinor;
    return this;
  }

  amountMinorExpression(expression: string): this {
    this.payload.amount = ensureExpression(expression);
    return this;
  }

  attachPayNote(payNote: JsonObject): this {
    this.payload.attachedPayNote = copyEntries(payNote);
    return this;
  }

  reason(reason: string): this {
    this.payload.reason = reason;
    return this;
  }

  putCustom(key: string, value: JsonValue): this {
    if (key === 'processor') {
      throw new Error('use processor(...) to set processor');
    }
    this.payload[key] = value;
    return this;
  }

  putCustomExpression(key: string, expression: string): this {
    return this.putCustom(key, ensureExpression(expression));
  }

  viaAch(): PutRailBuilder<this> {
    return new PutRailBuilder<this>(this, (key, value) => {
      if (
        key === 'routingNumber' ||
        key === 'accountNumber' ||
        key === 'accountType' ||
        key === 'network' ||
        key === 'companyEntryDescription'
      ) {
        this.payload[key] = value;
      }
    });
  }

  viaSepa(): PutRailBuilder<this> {
    return new PutRailBuilder<this>(this, (key, value) => {
      if (
        key === 'ibanFrom' ||
        key === 'ibanTo' ||
        key === 'bicTo' ||
        key === 'remittanceInformation'
      ) {
        this.payload[key] = value;
      }
    });
  }

  viaWire(): PutRailBuilder<this> {
    return new PutRailBuilder<this>(this, (key, value) => {
      if (
        key === 'bankSwift' ||
        key === 'bankName' ||
        key === 'accountNumber' ||
        key === 'beneficiaryName' ||
        key === 'beneficiaryAddress'
      ) {
        this.payload[key] = value;
      }
    });
  }

  viaCard(): PutRailBuilder<this> {
    return new PutRailBuilder<this>(this, (key, value) => {
      if (key === 'cardOnFileRef' || key === 'merchantDescriptor') {
        this.payload[key] = value;
      }
    });
  }

  viaTokenizedCard(): PutRailBuilder<this> {
    return new PutRailBuilder<this>(this, (key, value) => {
      if (
        key === 'networkToken' ||
        key === 'tokenProvider' ||
        key === 'cryptogram'
      ) {
        this.payload[key] = value;
      }
    });
  }

  viaCreditLine(): PutRailBuilder<this> {
    return new PutRailBuilder<this>(this, (key, value) => {
      if (
        key === 'creditLineId' ||
        key === 'merchantAccountId' ||
        key === 'cardholderAccountId'
      ) {
        this.payload[key] = value;
      }
    });
  }

  viaLedger(): PutRailBuilder<this> {
    return new PutRailBuilder<this>(this, (key, value) => {
      if (
        key === 'ledgerAccountFrom' ||
        key === 'ledgerAccountTo' ||
        key === 'memo'
      ) {
        this.payload[key] = value;
      }
    });
  }

  viaCrypto(): PutRailBuilder<this> {
    return new PutRailBuilder<this>(this, (key, value) => {
      if (
        key === 'asset' ||
        key === 'chain' ||
        key === 'fromWalletRef' ||
        key === 'toAddress' ||
        key === 'txPolicy'
      ) {
        this.payload[key] = value;
      }
    });
  }

  build(): JsonObject {
    return copyEntries(this.payload);
  }

  processorName(): string | undefined {
    return this.processorValue;
  }
}

export class CaptureStepBuilder {
  constructor(private readonly parent: StepsBuilder) {}

  lock(): StepsBuilder {
    return this.parent.triggerEvent('RequestCaptureLock', {
      type: 'PayNote/Card Transaction Capture Lock Requested',
    });
  }

  unlock(): StepsBuilder {
    return this.parent.triggerEvent('RequestCaptureUnlock', {
      type: 'PayNote/Card Transaction Capture Unlock Requested',
    });
  }

  markLocked(): StepsBuilder {
    return this.parent.triggerEvent('CaptureLocked', {
      type: 'PayNote/Card Transaction Capture Locked',
    });
  }

  markUnlocked(): StepsBuilder {
    return this.parent.triggerEvent('CaptureUnlocked', {
      type: 'PayNote/Card Transaction Capture Unlocked',
    });
  }

  requestNow(): StepsBuilder {
    return this.parent.triggerEvent('RequestCapture', {
      type: 'PayNote/Capture Funds Requested',
      amount: ensureExpression("document('/amount/total')"),
    });
  }

  requestPartial(amountExpression: string): StepsBuilder {
    return this.parent.triggerEvent('RequestCapture', {
      type: 'PayNote/Capture Funds Requested',
      amount: ensureExpression(amountExpression),
    });
  }

  releaseFull(): StepsBuilder {
    return this.parent.triggerEvent('RequestRelease', {
      type: 'PayNote/Reservation Release Requested',
      amount: ensureExpression("document('/amount/total')"),
    });
  }
}

type AskAICustomizer = (ask: AskAIBuilder) => void;

class AskAIBuilder {
  private readonly instructions: string[] = [];
  private readonly expectedResponses: string[] = [];
  private taskName: string | undefined;

  constructor(
    private readonly parent: StepsBuilder,
    private readonly integration: AIIntegrationConfig,
    private readonly stepName: string,
  ) {}

  task(taskName: string): this {
    this.taskName = taskName.trim();
    return this;
  }

  instruction(instruction: string): this {
    const normalized = instruction.trim();
    if (normalized.length > 0) {
      this.instructions.push(normalized);
    }
    return this;
  }

  expects(typeLike: TypeLike): this {
    this.expectedResponses.push(toTypeAlias(typeLike));
    return this;
  }

  done(): StepsBuilder {
    const taskTemplate = this.taskName
      ? this.integration.tasks[this.taskName]
      : undefined;
    const mergedInstructions = [
      ...(taskTemplate?.instructions ?? []),
      ...this.instructions,
    ];
    if (mergedInstructions.length === 0) {
      throw new Error(
        `askAI('${this.integration.name}') requires instructions`,
      );
    }
    const mergedResponses = [
      ...(taskTemplate?.expectedResponses ?? []),
      ...this.expectedResponses,
    ];

    return this.parent.emitType(
      this.stepName,
      'MyOS/Call Operation Requested',
      (payload) => {
        payload.put('onBehalfOf', this.integration.permissionFrom);
        payload.put('targetSessionId', this.integration.sessionId);
        payload.put('operation', 'provideInstructions');
        payload.put('request', {
          requester: this.integration.requesterId,
          instructions: mergedInstructions.join('\n'),
          context: ensureExpression(
            `document('${this.integration.contextPath}')`,
          ),
          ...(this.taskName ? { taskName: this.taskName } : {}),
          ...(mergedResponses.length > 0
            ? {
                expectedResponses: mergedResponses.map((response) => ({
                  type: response,
                })),
              }
            : {}),
        });
      },
    );
  }
}

export class AISteps {
  constructor(
    private readonly parent: StepsBuilder,
    private readonly integration: AIIntegrationConfig,
  ) {}

  requestPermission(stepName = 'RequestPermission'): StepsBuilder {
    return this.parent.emitType(
      stepName,
      'MyOS/Single Document Permission Grant Requested',
      (payload) => {
        payload.put('onBehalfOf', this.integration.permissionFrom);
        payload.put('requestId', this.integration.requestId);
        payload.put('targetSessionId', this.integration.sessionId);
        payload.put(
          'permissions',
          MyOsPermissions.create()
            .read(true)
            .singleOps('provideInstructions')
            .build(),
        );
      },
    );
  }

  subscribe(stepName = 'Subscribe'): StepsBuilder {
    return this.parent.emitType(
      stepName,
      'MyOS/Subscribe to Session Requested',
      (payload) => {
        payload.put('onBehalfOf', this.integration.permissionFrom);
        payload.put('targetSessionId', this.integration.sessionId);
        payload.put('subscription', {
          id: this.integration.subscriptionId,
        });
      },
    );
  }
}

export interface StepsBuilderOptions {
  readonly aiIntegrations?: Record<string, AIIntegrationConfig>;
  readonly accessConfigs?: Record<string, AccessConfig>;
  readonly linkedAccessConfigs?: Record<string, LinkedAccessConfig>;
  readonly agencyConfigs?: Record<string, AgencyConfig>;
}

export class StepsBuilder {
  private readonly steps: JsonObject[] = [];
  private readonly aiIntegrations: Record<string, AIIntegrationConfig>;
  private readonly accessConfigs: Record<string, AccessConfig>;
  private readonly linkedAccessConfigs: Record<string, LinkedAccessConfig>;
  private readonly agencyConfigs: Record<string, AgencyConfig>;

  constructor(options: StepsBuilderOptions = {}) {
    this.aiIntegrations = structuredClone(options.aiIntegrations ?? {});
    this.accessConfigs = structuredClone(options.accessConfigs ?? {});
    this.linkedAccessConfigs = structuredClone(
      options.linkedAccessConfigs ?? {},
    );
    this.agencyConfigs = structuredClone(options.agencyConfigs ?? {});
  }

  jsRaw(name: string, code: string): this {
    this.steps.push(step(name, 'Conversation/JavaScript Code', { code }));
    return this;
  }

  updateDocument(
    name: string,
    customizer: (changeset: ChangesetBuilder) => void,
  ): this {
    const builder = new ChangesetBuilder();
    customizer(builder);
    this.steps.push(
      step(name, 'Conversation/Update Document', {
        changeset: builder.build(),
      }),
    );
    return this;
  }

  updateDocumentFromExpression(name: string, expression: string): this {
    this.steps.push(
      step(name, 'Conversation/Update Document', {
        changeset: ensureExpression(expression),
      }),
    );
    return this;
  }

  triggerEvent(name: string, event: JsonObject): this {
    this.steps.push(step(name, 'Conversation/Trigger Event', { event }));
    return this;
  }

  emit(name: string, event: JsonObject): this {
    return this.triggerEvent(name, event);
  }

  emitType(
    name: string,
    eventType: TypeLike,
    payloadCustomizer?: (payload: EventPayloadBuilder) => void,
  ): this {
    const payload = new EventPayloadBuilder();
    payloadCustomizer?.(payload);
    this.steps.push(
      step(name, 'Conversation/Trigger Event', {
        event: toEventNode(eventType, payload.build()),
      }),
    );
    return this;
  }

  namedEvent(
    name: string,
    eventName: string,
    payloadCustomizer?: (payload: EventPayloadBuilder) => void,
  ): this {
    const payload = new EventPayloadBuilder();
    payloadCustomizer?.(payload);
    const payloadObject = payload.build();
    this.steps.push(
      step(name, 'Conversation/Trigger Event', {
        event: {
          ...payloadObject,
          type: RuntimeEventTypes.NamedEvent,
          name: eventName,
        },
      }),
    );
    return this;
  }

  replaceValue(name: string, path: string, value: JsonValue): this {
    return this.updateDocument(name, (changeset) =>
      changeset.replaceValue(path, value),
    );
  }

  replaceExpression(name: string, path: string, expression: string): this {
    return this.updateDocument(name, (changeset) =>
      changeset.replaceExpression(path, expression),
    );
  }

  triggerPayment(
    name: string,
    paymentEventType: TypeLike,
    payloadCustomizer: (payload: PaymentRequestPayloadBuilder) => void,
  ): this;
  triggerPayment(
    paymentEventType: TypeLike,
    payloadCustomizer: (payload: PaymentRequestPayloadBuilder) => void,
  ): this;
  triggerPayment(
    nameOrType: string | TypeLike,
    typeOrCustomizer:
      | TypeLike
      | ((payload: PaymentRequestPayloadBuilder) => void),
    payloadCustomizerMaybe?: (payload: PaymentRequestPayloadBuilder) => void,
  ): this {
    if (payloadCustomizerMaybe === undefined) {
      return this.emitPaymentRequest(
        'TriggerPayment',
        nameOrType as TypeLike,
        typeOrCustomizer as (payload: PaymentRequestPayloadBuilder) => void,
      );
    }
    return this.emitPaymentRequest(
      nameOrType as string,
      typeOrCustomizer as TypeLike,
      payloadCustomizerMaybe,
    );
  }

  requestBackwardPayment(
    name: string,
    payloadCustomizer: (payload: PaymentRequestPayloadBuilder) => void,
  ): this;
  requestBackwardPayment(
    payloadCustomizer: (payload: PaymentRequestPayloadBuilder) => void,
  ): this;
  requestBackwardPayment(
    nameOrCustomizer:
      | string
      | ((payload: PaymentRequestPayloadBuilder) => void),
    payloadCustomizer?: (payload: PaymentRequestPayloadBuilder) => void,
  ): this {
    assertRepositoryTypeAliasAvailable(
      'PayNote/Backward Payment Requested',
      'steps.requestBackwardPayment(...)',
    );
    if (typeof nameOrCustomizer === 'function') {
      return this.emitPaymentRequest(
        'RequestBackwardPayment',
        'PayNote/Backward Payment Requested',
        nameOrCustomizer,
      );
    }
    return this.emitPaymentRequest(
      nameOrCustomizer,
      'PayNote/Backward Payment Requested',
      payloadCustomizer as (payload: PaymentRequestPayloadBuilder) => void,
    );
  }

  bootstrapDocument(
    stepName: string,
    document: JsonObject,
    channelBindings: Record<string, JsonObject>,
    onBehalfOf: string,
    options?: BootstrapPayloadCustomizer,
  ): this {
    return this.emitType(
      stepName,
      'Conversation/Document Bootstrap Requested',
      (payload) => {
        payload.put('document', copyEntries(document));
        payload.put('channelBindings', structuredClone(channelBindings));
        payload.put(
          'onBehalfOf',
          requireText(onBehalfOf, 'onBehalfOf is required'),
        );
        options?.(payload);
      },
    );
  }

  bootstrapDocumentExpr(
    stepName: string,
    documentExpression: string,
    channelBindings: Record<string, JsonObject>,
    onBehalfOf: string,
    options?: BootstrapPayloadCustomizer,
  ): this {
    return this.emitType(
      stepName,
      'Conversation/Document Bootstrap Requested',
      (payload) => {
        payload.putExpression('document', documentExpression);
        payload.put('channelBindings', structuredClone(channelBindings));
        payload.put(
          'onBehalfOf',
          requireText(onBehalfOf, 'onBehalfOf is required'),
        );
        options?.(payload);
      },
    );
  }

  capture(): CaptureStepBuilder {
    return new CaptureStepBuilder(this);
  }

  myOs(adminChannelKey = 'myOsAdminChannel'): MyOsSteps {
    return new MyOsSteps(this, adminChannelKey);
  }

  askAI(aiName: string, stepName: string, askCustomizer: AskAICustomizer): this;
  askAI(aiName: string, askCustomizer: AskAICustomizer): this;
  askAI(
    aiName: string,
    stepNameOrCustomizer: string | AskAICustomizer,
    askCustomizerMaybe?: AskAICustomizer,
  ): this {
    if (typeof stepNameOrCustomizer === 'function') {
      const askBuilder = new AskAIBuilder(
        this,
        this.requireAiIntegration(aiName),
        'AskAI',
      );
      stepNameOrCustomizer(askBuilder);
      askBuilder.done();
      return this;
    }
    const askBuilder = new AskAIBuilder(
      this,
      this.requireAiIntegration(aiName),
      stepNameOrCustomizer,
    );
    (askCustomizerMaybe as AskAICustomizer)(askBuilder);
    askBuilder.done();
    return this;
  }

  ai(aiName: string): AISteps {
    return new AISteps(this, this.requireAiIntegration(aiName));
  }

  access(accessName: string): AccessSteps {
    return new AccessSteps(this, this.requireAccessConfig(accessName));
  }

  accessLinked(linkedAccessName: string): LinkedAccessSteps {
    return new LinkedAccessSteps(
      this,
      this.requireLinkedAccessConfig(linkedAccessName),
    );
  }

  viaAgency(agencyName: string): AgencySteps {
    return new AgencySteps(this, this.requireAgencyConfig(agencyName));
  }

  raw(stepNode: JsonObject): this {
    this.steps.push(structuredClone(stepNode));
    return this;
  }

  build(): JsonObject[] {
    return structuredClone(this.steps);
  }

  private emitPaymentRequest(
    stepName: string,
    eventType: TypeLike,
    payloadCustomizer: (payload: PaymentRequestPayloadBuilder) => void,
  ): this {
    const payloadBuilder = new PaymentRequestPayloadBuilder();
    payloadCustomizer(payloadBuilder);
    ensureProcessor(payloadBuilder);
    return this.emitType(stepName, eventType, (payload) => {
      for (const [key, value] of Object.entries(payloadBuilder.build())) {
        payload.put(key, value as JsonValue);
      }
    });
  }

  private requireAiIntegration(aiName: string): AIIntegrationConfig {
    const key = aiName.trim();
    const integration = this.aiIntegrations[key];
    if (!integration) {
      throw new Error(`Unknown AI integration: ${aiName}`);
    }
    return integration;
  }

  private requireAccessConfig(accessName: string): AccessConfig {
    const key = accessName.trim();
    const config = this.accessConfigs[key];
    if (!config) {
      throw new Error(`Unknown access: ${accessName}`);
    }
    return config;
  }

  private requireLinkedAccessConfig(accessName: string): LinkedAccessConfig {
    const key = accessName.trim();
    const config = this.linkedAccessConfigs[key];
    if (!config) {
      throw new Error(`Unknown linked access: ${accessName}`);
    }
    return config;
  }

  private requireAgencyConfig(agencyName: string): AgencyConfig {
    const key = agencyName.trim();
    const config = this.agencyConfigs[key];
    if (!config) {
      throw new Error(`Unknown agency: ${agencyName}`);
    }
    return config;
  }
}
