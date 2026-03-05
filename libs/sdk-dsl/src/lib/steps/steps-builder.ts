import { ensureExpression } from '../core/serialization.js';
import { toTypeAlias, type TypeLike } from '../core/type-alias.js';
import type { JsonObject, JsonValue } from '../core/types.js';
import { MyOsSteps } from './myos-steps.js';

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
    this.payload.amountMinor = amountMinor;
    return this;
  }

  amountMinorExpression(expression: string): this {
    this.payload.amountMinor = ensureExpression(expression);
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

export class StepsBuilder {
  private readonly steps: JsonObject[] = [];

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
          type: 'Conversation/Event',
          name: eventName,
          ...(Object.keys(payloadObject).length > 0
            ? { payload: payloadObject }
            : {}),
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
    channelBindings: Record<string, string>,
    options?: (payload: EventPayloadBuilder) => void,
  ): this {
    return this.emitType(
      stepName,
      'Conversation/Document Bootstrap Requested',
      (payload) => {
        payload.put('document', copyEntries(document));
        payload.put('channelBindings', structuredClone(channelBindings));
        options?.(payload);
      },
    );
  }

  bootstrapDocumentExpr(
    stepName: string,
    documentExpression: string,
    channelBindings: Record<string, string>,
    options?: (payload: EventPayloadBuilder) => void,
  ): this {
    return this.emitType(
      stepName,
      'Conversation/Document Bootstrap Requested',
      (payload) => {
        payload.putExpression('document', documentExpression);
        payload.put('channelBindings', structuredClone(channelBindings));
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
}
