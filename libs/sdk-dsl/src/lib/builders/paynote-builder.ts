import { BlueNode } from '@blue-labs/language';

import type {
  BlueValueInput,
  PaymentMandateAllowedPayNoteInput,
  PaymentMandateCounterpartyInput,
  TypeInput,
} from '../types';
import { wrapExpression } from '../internal/expression';
import { resolveTypeInput } from '../internal/type-input';
import { DocBuilder } from './doc-builder';
import { StepsBuilder } from './steps-builder';

const TOTAL_AMOUNT_EXPRESSION = "document('/amount/total')";

type PayNoteActionName = 'capture' | 'reserve' | 'release';

type PayNoteActionState = {
  locked: boolean;
  unlockPaths: number;
};

type PayNoteActionConfig = {
  readonly name: PayNoteActionName;
  readonly requestEventType: TypeInput;
  readonly requestStepName: string;
  readonly lockEventType: TypeInput | null;
  readonly lockStepName: string;
  readonly unlockEventType: TypeInput | null;
  readonly unlockStepName: string;
};

const CAPTURE_ACTION_CONFIG: PayNoteActionConfig = {
  name: 'capture',
  requestEventType: 'PayNote/Capture Funds Requested',
  requestStepName: 'CaptureFundsRequested',
  lockEventType: 'PayNote/Card Transaction Capture Lock Requested',
  lockStepName: 'RequestCaptureLock',
  unlockEventType: 'PayNote/Card Transaction Capture Unlock Requested',
  unlockStepName: 'RequestCaptureUnlock',
};

const RESERVE_ACTION_CONFIG: PayNoteActionConfig = {
  name: 'reserve',
  requestEventType: 'PayNote/Reserve Funds Requested',
  requestStepName: 'ReserveFundsRequested',
  lockEventType: null,
  lockStepName: 'RequestReserveLock',
  unlockEventType: null,
  unlockStepName: 'RequestReserveUnlock',
};

const RELEASE_ACTION_CONFIG: PayNoteActionConfig = {
  name: 'release',
  requestEventType: 'PayNote/Reservation Release Requested',
  requestStepName: 'RequestRelease',
  lockEventType: null,
  lockStepName: 'RequestReleaseLock',
  unlockEventType: null,
  unlockStepName: 'RequestReleaseUnlock',
};

export class PayNotes {
  static payNote(name: string): PayNoteBuilder {
    return new PayNoteBuilder(name);
  }

  static cardTransactionPayNote(name: string): CardTransactionPayNoteBuilder {
    return new CardTransactionPayNoteBuilder(name);
  }

  static merchantToCustomerPayNote(
    name: string,
  ): MerchantToCustomerPayNoteBuilder {
    return new MerchantToCustomerPayNoteBuilder(name);
  }

  static payNoteDelivery(name: string): PayNoteDeliveryBuilder {
    return new PayNoteDeliveryBuilder(name);
  }

  static paymentMandate(name: string): PaymentMandateBuilder {
    return new PaymentMandateBuilder(name);
  }
}

abstract class AbstractPayNoteBuilder<
  TSelf extends AbstractPayNoteBuilder<TSelf>,
> extends DocBuilder {
  private currencyCode: string | null = null;
  private readonly actionStates = new Map<
    PayNoteActionName,
    PayNoteActionState
  >([
    ['capture', createActionState()],
    ['reserve', createActionState()],
    ['release', createActionState()],
  ]);

  protected constructor(typeInput: TypeInput, name: string) {
    super(new BlueNode());
    this.type(typeInput);
    this.name(name);
  }

  currency(code: string): this {
    const normalized = normalizeCurrencyCode(code);
    this.currencyCode = normalized;
    return this.field('/currency', normalized);
  }

  amountMinor(totalMinor: number): this {
    if (!Number.isFinite(totalMinor) || totalMinor < 0) {
      throw new Error('amount cannot be negative');
    }
    return this.field('/amount/total', totalMinor);
  }

  amountMajor(totalMajor: string | number): this {
    if (totalMajor == null) {
      throw new Error('amount is required');
    }
    if (!this.currencyCode) {
      throw new Error('call currency() before amountMajor()');
    }
    return this.amountMinor(
      parseMajorAmountToMinor(totalMajor, this.currencyCode),
    );
  }

  amountReserved(amountMinor: number): this {
    return this.field('/amount/reserved', amountMinor);
  }

  amountCaptured(amountMinor: number): this {
    return this.field('/amount/captured', amountMinor);
  }

  status(value: BlueValueInput): this {
    return this.field('/status', value);
  }

  transactionStatus(value: BlueValueInput): this {
    return this.field('/transactionStatus', value);
  }

  capture(): PayNoteActionBuilder<this> {
    return new PayNoteActionBuilder(
      this,
      CAPTURE_ACTION_CONFIG,
      this.requireActionState('capture'),
    );
  }

  reserve(): PayNoteActionBuilder<this> {
    return new PayNoteActionBuilder(
      this,
      RESERVE_ACTION_CONFIG,
      this.requireActionState('reserve'),
    );
  }

  release(): PayNoteActionBuilder<this> {
    return new PayNoteActionBuilder(
      this,
      RELEASE_ACTION_CONFIG,
      this.requireActionState('release'),
    );
  }

  override buildDocument(): BlueNode {
    validateActionState('capture', this.requireActionState('capture'));
    validateActionState('reserve', this.requireActionState('reserve'));
    validateActionState('release', this.requireActionState('release'));
    return super.buildDocument();
  }

  private requireActionState(name: PayNoteActionName): PayNoteActionState {
    const state = this.actionStates.get(name);
    if (!state) {
      throw new Error(`Unknown PayNote action: ${name}`);
    }
    return state;
  }
}

export class PayNoteBuilder extends AbstractPayNoteBuilder<PayNoteBuilder> {
  constructor(name: string) {
    super('PayNote/PayNote', name);
  }
}

export class CardTransactionPayNoteBuilder extends AbstractPayNoteBuilder<CardTransactionPayNoteBuilder> {
  constructor(name: string) {
    super('PayNote/Card Transaction PayNote', name);
  }

  cardTransactionDetails(details: BlueValueInput): this {
    return this.field('/cardTransactionDetails', details);
  }
}

export class MerchantToCustomerPayNoteBuilder extends AbstractPayNoteBuilder<MerchantToCustomerPayNoteBuilder> {
  constructor(name: string) {
    super('PayNote/Merchant To Customer PayNote', name);
  }
}

export class PayNoteDeliveryBuilder extends DocBuilder {
  constructor(name: string) {
    super(new BlueNode());
    this.type('PayNote/PayNote Delivery');
    this.name(name);
  }

  cardTransactionDetails(details: BlueValueInput): this {
    return this.field('/cardTransactionDetails', details);
  }

  payNoteBootstrapRequest(request: BlueValueInput): this {
    return this.field('/payNoteBootstrapRequest', request);
  }

  paymentMandateBootstrapRequest(request: BlueValueInput): this {
    return this.field('/paymentMandateBootstrapRequest', request);
  }

  deliveryStatus(status: BlueValueInput): this {
    return this.field('/deliveryStatus', status);
  }

  transactionIdentificationStatus(status: BlueValueInput): this {
    return this.field('/transactionIdentificationStatus', status);
  }

  clientDecisionStatus(status: BlueValueInput): this {
    return this.field('/clientDecisionStatus', status);
  }

  clientAcceptedAt(timestamp: BlueValueInput): this {
    return this.field('/clientAcceptedAt', timestamp);
  }

  clientRejectedAt(timestamp: BlueValueInput): this {
    return this.field('/clientRejectedAt', timestamp);
  }

  deliveryError(message: BlueValueInput): this {
    return this.field('/deliveryError', message);
  }
}

export class PaymentMandateBuilder extends DocBuilder {
  constructor(name: string) {
    super(new BlueNode());
    this.type('PayNote/Payment Mandate');
    this.name(name);
  }

  granterType(value: string): this {
    return this.field('/granterType', requireNonEmpty(value, 'granterType'));
  }

  granterId(value: string): this {
    return this.field('/granterId', requireNonEmpty(value, 'granterId'));
  }

  granteeType(value: string): this {
    return this.field('/granteeType', requireNonEmpty(value, 'granteeType'));
  }

  granteeId(value: string): this {
    return this.field('/granteeId', requireNonEmpty(value, 'granteeId'));
  }

  amountLimit(value: number): this {
    return this.field('/amountLimit', value);
  }

  currency(code: string): this {
    return this.field('/currency', normalizeCurrencyCode(code));
  }

  sourceAccount(value: string): this {
    return this.field(
      '/sourceAccount',
      requireNonEmpty(value, 'sourceAccount'),
    );
  }

  amountReserved(value: number): this {
    return this.field('/amountReserved', value);
  }

  amountCaptured(value: number): this {
    return this.field('/amountCaptured', value);
  }

  allowLinkedPayNote(enabled: boolean): this {
    return this.field('/allowLinkedPayNote', enabled);
  }

  allowedPayNotes(items: readonly PaymentMandateAllowedPayNoteInput[]): this {
    return this.field('/allowedPayNotes', items as BlueValueInput);
  }

  allowedPaymentCounterparties(
    items: readonly PaymentMandateCounterpartyInput[],
  ): this {
    return this.field('/allowedPaymentCounterparties', items as BlueValueInput);
  }

  expiresAt(timestamp: string): this {
    return this.field('/expiresAt', requireNonEmpty(timestamp, 'expiresAt'));
  }

  revokedAt(timestamp: string): this {
    return this.field('/revokedAt', requireNonEmpty(timestamp, 'revokedAt'));
  }

  chargeAttempts(attempts: Record<string, BlueValueInput>): this {
    return this.field('/chargeAttempts', attempts as BlueValueInput);
  }
}

export class PayNoteActionBuilder<P extends AbstractPayNoteBuilder<P>> {
  constructor(
    private readonly parent: P,
    private readonly config: PayNoteActionConfig,
    private readonly state: PayNoteActionState,
  ) {}

  lockOnInit(): PayNoteActionBuilder<P> {
    const lockEventType = requireSupportedEventType(
      this.config,
      'lockOnInit',
      this.config.lockEventType,
    );
    if (!this.state.locked) {
      this.parent.onInit(`${this.config.name}LockOnInit`, (steps) =>
        this.emitTypedEvent(steps, lockEventType, this.config.lockStepName),
      );
      this.state.locked = true;
    }
    return this;
  }

  unlockOnEvent(eventType: TypeInput): PayNoteActionBuilder<P>;
  unlockOnEvent(
    channelKey: string,
    eventType: TypeInput,
  ): PayNoteActionBuilder<P>;
  unlockOnEvent(
    channelKeyOrEventType: string | TypeInput,
    maybeEventType?: TypeInput,
  ): PayNoteActionBuilder<P> {
    const unlockEventType = requireSupportedEventType(
      this.config,
      'unlockOnEvent',
      this.config.unlockEventType,
    );
    const { channelKey, eventType } = resolveEventBinding(
      channelKeyOrEventType,
      maybeEventType,
    );
    this.bindEventTriggeredWorkflow(
      `${this.config.name}UnlockOn${tokenizeTypeInput(eventType)}`,
      eventType,
      (steps) =>
        this.emitTypedEvent(steps, unlockEventType, this.config.unlockStepName),
      channelKey,
    );
    this.state.unlockPaths += 1;
    return this;
  }

  unlockOnDocPathChange(path: string): PayNoteActionBuilder<P> {
    const unlockEventType = requireSupportedEventType(
      this.config,
      'unlockOnDocPathChange',
      this.config.unlockEventType,
    );
    const normalizedPath = requireNonEmpty(path, 'path');
    this.parent.onDocChange(
      `${this.config.name}UnlockOnDoc${sanitize(normalizedPath)}`,
      normalizedPath,
      (steps) =>
        this.emitTypedEvent(steps, unlockEventType, this.config.unlockStepName),
    );
    this.state.unlockPaths += 1;
    return this;
  }

  unlockOnOperation(
    operationKey: string,
    channelKey: string,
    description: string,
  ): PayNoteActionBuilder<P>;
  unlockOnOperation(
    operationKey: string,
    channelKey: string,
    description: string,
    extraSteps: (steps: StepsBuilder) => void,
  ): PayNoteActionBuilder<P>;
  unlockOnOperation(
    operationKey: string,
    channelKey: string,
    description: string,
    extraSteps?: (steps: StepsBuilder) => void,
  ): PayNoteActionBuilder<P> {
    const unlockEventType = requireSupportedEventType(
      this.config,
      'unlockOnOperation',
      this.config.unlockEventType,
    );
    this.parent
      .operation(operationKey)
      .channel(channelKey)
      .description(description)
      .steps((steps) => {
        extraSteps?.(steps);
        this.emitTypedEvent(steps, unlockEventType, this.config.unlockStepName);
      })
      .done();
    this.state.unlockPaths += 1;
    return this;
  }

  requestOnInit(): PayNoteActionBuilder<P> {
    this.parent.onInit(`${this.config.name}RequestOnInit`, (steps) =>
      this.emitRequestEvent(steps),
    );
    return this;
  }

  requestOnEvent(eventType: TypeInput): PayNoteActionBuilder<P>;
  requestOnEvent(
    channelKey: string,
    eventType: TypeInput,
  ): PayNoteActionBuilder<P>;
  requestOnEvent(
    channelKeyOrEventType: string | TypeInput,
    maybeEventType?: TypeInput,
  ): PayNoteActionBuilder<P> {
    const { channelKey, eventType } = resolveEventBinding(
      channelKeyOrEventType,
      maybeEventType,
    );
    this.bindEventTriggeredWorkflow(
      `${this.config.name}RequestOn${tokenizeTypeInput(eventType)}`,
      eventType,
      (steps) => this.emitRequestEvent(steps),
      channelKey,
    );
    return this;
  }

  requestOnDocPathChange(path: string): PayNoteActionBuilder<P> {
    const normalizedPath = requireNonEmpty(path, 'path');
    this.parent.onDocChange(
      `${this.config.name}RequestOnDoc${sanitize(normalizedPath)}`,
      normalizedPath,
      (steps) => this.emitRequestEvent(steps),
    );
    return this;
  }

  requestOnOperation(
    operationKey: string,
    channelKey: string,
    description: string,
  ): PayNoteActionBuilder<P> {
    this.parent
      .operation(operationKey)
      .channel(channelKey)
      .description(description)
      .steps((steps) => this.emitRequestEvent(steps))
      .done();
    return this;
  }

  requestPartialOnOperation(
    operationKey: string,
    channelKey: string,
    description: string,
    amountExpression: string,
  ): PayNoteActionBuilder<P> {
    this.parent
      .operation(operationKey)
      .channel(channelKey)
      .description(description)
      .steps((steps) => this.emitRequestEvent(steps, amountExpression))
      .done();
    return this;
  }

  requestPartialOnEvent(
    eventType: TypeInput,
    amountExpression: string,
  ): PayNoteActionBuilder<P>;
  requestPartialOnEvent(
    channelKey: string,
    eventType: TypeInput,
    amountExpression: string,
  ): PayNoteActionBuilder<P>;
  requestPartialOnEvent(
    channelKeyOrEventType: string | TypeInput,
    eventTypeOrAmountExpression: TypeInput | string,
    maybeAmountExpression?: string,
  ): PayNoteActionBuilder<P> {
    const { channelKey, eventType, amountExpression } =
      resolvePartialEventBinding(
        channelKeyOrEventType,
        eventTypeOrAmountExpression,
        maybeAmountExpression,
      );
    this.bindEventTriggeredWorkflow(
      `${this.config.name}PartialOn${tokenizeTypeInput(eventType)}`,
      eventType,
      (steps) => this.emitRequestEvent(steps, amountExpression),
      channelKey,
    );
    return this;
  }

  done(): P {
    return this.parent;
  }

  private emitTypedEvent(
    steps: StepsBuilder,
    typeInput: TypeInput,
    stepName: string,
  ): void {
    switch (this.config.name) {
      case 'capture':
        if (
          resolveTypeInput(typeInput).getBlueId() ===
          resolveTypeInput(
            'PayNote/Card Transaction Capture Lock Requested',
          ).getBlueId()
        ) {
          steps.paynote().cardTransactionCaptureLockRequested(stepName);
          return;
        }

        steps.paynote().cardTransactionCaptureUnlockRequested(stepName);
        return;
      case 'reserve':
      case 'release':
        steps.emitType(stepName, typeInput);
        return;
    }
  }

  private emitRequestEvent(
    steps: StepsBuilder,
    amountExpression?: string,
  ): void {
    const amount = wrapExpression(amountExpression ?? TOTAL_AMOUNT_EXPRESSION);

    switch (this.config.name) {
      case 'capture':
        steps.paynote().captureFundsRequested(this.config.requestStepName, {
          amount,
        });
        return;
      case 'reserve':
        steps.paynote().reserveFundsRequested(this.config.requestStepName, {
          amount,
        });
        return;
      case 'release':
        steps
          .paynote()
          .reservationReleaseRequested(this.config.requestStepName, {
            amount,
          });
        return;
    }
  }

  private bindEventTriggeredWorkflow(
    workflowKey: string,
    eventType: TypeInput,
    customizer: (steps: StepsBuilder) => void,
    channelKey?: string | null,
  ): void {
    if (typeof channelKey === 'string' && channelKey.trim().length > 0) {
      this.parent.onChannelEvent(
        workflowKey,
        requireNonEmpty(channelKey, 'channel key'),
        eventType,
        customizer,
      );
      return;
    }

    this.parent.onEvent(workflowKey, eventType, customizer);
  }
}

function createActionState(): PayNoteActionState {
  return {
    locked: false,
    unlockPaths: 0,
  };
}

function validateActionState(
  name: PayNoteActionName,
  state: PayNoteActionState,
): void {
  if (state.locked && state.unlockPaths === 0) {
    throw new Error(`${name} locked on init but no unlock path configured`);
  }
}

function requireSupportedEventType(
  config: PayNoteActionConfig,
  method: string,
  eventType: TypeInput | null,
): TypeInput {
  if (eventType == null) {
    throw new Error(
      `${config.name}().${method}() is not supported by the current public runtime`,
    );
  }
  return eventType;
}

function resolveEventBinding(
  channelKeyOrEventType: string | TypeInput,
  maybeEventType?: TypeInput,
): {
  channelKey: string | null;
  eventType: TypeInput;
} {
  if (maybeEventType === undefined) {
    return {
      channelKey: null,
      eventType: channelKeyOrEventType,
    };
  }

  return {
    channelKey: requireNonEmpty(String(channelKeyOrEventType), 'channel key'),
    eventType: maybeEventType,
  };
}

function resolvePartialEventBinding(
  channelKeyOrEventType: string | TypeInput,
  eventTypeOrAmountExpression: TypeInput | string,
  maybeAmountExpression?: string,
): {
  channelKey: string | null;
  eventType: TypeInput;
  amountExpression: string;
} {
  if (typeof maybeAmountExpression === 'string') {
    return {
      channelKey: requireNonEmpty(String(channelKeyOrEventType), 'channel key'),
      eventType: eventTypeOrAmountExpression as TypeInput,
      amountExpression: maybeAmountExpression,
    };
  }

  return {
    channelKey: null,
    eventType: channelKeyOrEventType,
    amountExpression: requireNonEmpty(
      eventTypeOrAmountExpression as string,
      'amount expression',
    ),
  };
}

function tokenizeTypeInput(typeInput: TypeInput): string {
  if (typeof typeInput === 'string') {
    const short = typeInput.includes('/')
      ? typeInput.slice(typeInput.lastIndexOf('/') + 1)
      : typeInput;
    return sanitize(short) || 'Signal';
  }

  const resolvedType = resolveTypeInput(typeInput);
  const rawValue =
    resolvedType.getValue() ?? resolvedType.getBlueId() ?? 'Signal';
  const alias = String(rawValue);
  const short = alias.includes('/')
    ? alias.slice(alias.lastIndexOf('/') + 1)
    : alias;
  return sanitize(short) || 'Signal';
}

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '');
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

function normalizeCurrencyCode(code: string): string {
  return requireNonEmpty(code, 'currency code').toUpperCase();
}

function parseMajorAmountToMinor(
  value: string | number,
  currencyCode: string,
): number {
  const raw = String(value).trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(raw)) {
    throw new Error('amount is required');
  }

  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [wholePart, fractionalPart = ''] = unsigned.split('.');
  const fractionDigits =
    new Intl.NumberFormat('en', {
      style: 'currency',
      currency: currencyCode,
    }).resolvedOptions().maximumFractionDigits ?? 0;

  if (fractionalPart.length > fractionDigits) {
    throw new Error(
      `amountMajor() requires exact ${currencyCode} currency scale`,
    );
  }

  const paddedFraction = fractionalPart.padEnd(fractionDigits, '0');
  const scale = BigInt(10) ** BigInt(fractionDigits);
  const wholeMinor = BigInt(wholePart || '0') * scale;
  const fractionalMinor =
    paddedFraction.length === 0 ? BigInt(0) : BigInt(paddedFraction);
  const minor = negative
    ? -(wholeMinor + fractionalMinor)
    : wholeMinor + fractionalMinor;
  const numericMinor = Number(minor);

  if (!Number.isSafeInteger(numericMinor)) {
    throw new Error('amount exceeds safe integer range');
  }

  if (numericMinor < 0) {
    throw new Error('amount cannot be negative');
  }

  return numericMinor;
}
