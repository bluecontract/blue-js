import { DocBuilder } from '../doc-builder/doc-builder.js';
import type { TypeLike } from '../core/type-alias.js';
import type { JsonObject } from '../core/types.js';
import { assertRepositoryTypeAliasAvailable } from '../core/runtime-type-support.js';
import type { StepsBuilder } from '../steps/steps-builder.js';

function sanitizeTypeLabel(typeLike: TypeLike): string {
  if (typeof typeLike === 'string') {
    return typeLike
      .replace(/[^A-Za-z0-9]+/gu, ' ')
      .trim()
      .replace(/\s+/gu, '');
  }
  return typeLike.name.replace(/[^A-Za-z0-9]+/gu, '');
}

function toMinor(amountMajor: string): number {
  const parsed = Number(amountMajor);
  if (Number.isNaN(parsed)) {
    throw new Error(`invalid major amount: ${amountMajor}`);
  }
  return Math.round(parsed * 100);
}

type ActionMode = 'capture' | 'reserve' | 'release';

function eventType(
  mode: ActionMode,
  action: 'lock' | 'unlock' | 'request',
): string {
  const ensureAvailable = (typeAlias: string): string => {
    assertRepositoryTypeAliasAvailable(
      typeAlias,
      `payNotes.${mode}().${action} helper`,
    );
    return typeAlias;
  };
  if (mode === 'capture') {
    if (action === 'lock') {
      return ensureAvailable('PayNote/Card Transaction Capture Lock Requested');
    }
    if (action === 'unlock') {
      return ensureAvailable(
        'PayNote/Card Transaction Capture Unlock Requested',
      );
    }
    return ensureAvailable('PayNote/Capture Funds Requested');
  }
  if (mode === 'reserve') {
    if (action === 'lock') {
      return ensureAvailable('PayNote/Reserve Lock Requested');
    }
    if (action === 'unlock') {
      return ensureAvailable('PayNote/Reserve Unlock Requested');
    }
    return ensureAvailable('PayNote/Reserve Funds Requested');
  }
  if (action === 'lock') {
    return ensureAvailable('PayNote/Reservation Release Lock Requested');
  }
  if (action === 'unlock') {
    return ensureAvailable('PayNote/Reservation Release Unlock Requested');
  }
  return ensureAvailable('PayNote/Reservation Release Requested');
}

export class PayNoteActionBuilder {
  constructor(
    private readonly parent: PayNoteBuilder,
    private readonly mode: ActionMode,
  ) {}

  lockOnInit(): this {
    this.parent.onInit(`${this.mode}LockOnInit`, (steps) =>
      steps.triggerEvent('Lock', { type: eventType(this.mode, 'lock') }),
    );
    return this;
  }

  unlockOnEvent(eventTypeRef: TypeLike): this {
    const eventSuffix = sanitizeTypeLabel(eventTypeRef);
    this.parent.onEvent(
      `${this.mode}UnlockOn${eventSuffix}`,
      typeof eventTypeRef === 'string' ? eventTypeRef : eventTypeRef.name,
      (steps) =>
        steps.triggerEvent('Unlock', { type: eventType(this.mode, 'unlock') }),
    );
    return this;
  }

  requestOnInit(): this {
    this.parent.onInit(`${this.mode}RequestOnInit`, (steps) =>
      steps.triggerEvent('Request', {
        type: eventType(this.mode, 'request'),
        amount: "${document('/amount/total')}",
      }),
    );
    return this;
  }

  requestPartialOnOperation(
    operationKey: string,
    channelKey: string,
    amountExpression: string,
    description?: string,
  ): this;
  requestPartialOnOperation(
    operationKey: string,
    channelKey: string,
    description: string,
    amountExpression: string,
  ): this;
  requestPartialOnOperation(
    operationKey: string,
    channelKey: string,
    amountExpressionOrDescription: string,
    descriptionOrAmountExpression?: string,
  ): this {
    const isExpressionLike = (value: string): boolean =>
      /^\d+([.]\d+)?$/u.test(value) ||
      value.includes('event.') ||
      value.includes("document('") ||
      value.startsWith('${');
    const amountExpression =
      descriptionOrAmountExpression === undefined
        ? amountExpressionOrDescription
        : isExpressionLike(amountExpressionOrDescription)
          ? amountExpressionOrDescription
          : descriptionOrAmountExpression;
    const description =
      descriptionOrAmountExpression === undefined
        ? undefined
        : isExpressionLike(amountExpressionOrDescription)
          ? descriptionOrAmountExpression
          : amountExpressionOrDescription;
    this.parent.operationTrigger(
      operationKey,
      channelKey,
      undefined,
      description,
      {
        type: eventType(this.mode, 'request'),
        amount: DocBuilder.expr(amountExpression),
      },
    );
    return this;
  }

  unlockOnOperation(
    operationKey: string,
    channelKey: string,
    description?: string,
    customizer?: (steps: StepsBuilder) => void,
  ): this {
    this.parent.operationTrigger(
      operationKey,
      channelKey,
      undefined,
      description,
      {
        type: eventType(this.mode, 'unlock'),
      },
      customizer,
    );
    return this;
  }

  requestOnOperation(
    operationKey: string,
    channelKey: string,
    description?: string,
    customizer?: (steps: StepsBuilder) => void,
  ): this {
    this.parent.operationTrigger(
      operationKey,
      channelKey,
      undefined,
      description,
      {
        type: eventType(this.mode, 'request'),
        amount: "${document('/amount/total')}",
      },
      customizer,
    );
    return this;
  }

  unlockOnDocPathChange(path: string): this {
    this.parent.onDocChange(
      `${this.mode}UnlockOnPath${sanitizeTypeLabel(path)}`,
      path,
      (steps) =>
        steps.triggerEvent('Unlock', { type: eventType(this.mode, 'unlock') }),
    );
    return this;
  }

  requestOnDocPathChange(path: string): this {
    this.parent.onDocChange(
      `${this.mode}RequestOnPath${sanitizeTypeLabel(path)}`,
      path,
      (steps) =>
        steps.triggerEvent('Request', {
          type: eventType(this.mode, 'request'),
          amount: "${document('/amount/total')}",
        }),
    );
    return this;
  }

  requestOnEvent(eventTypeRef: TypeLike): this {
    const eventSuffix = sanitizeTypeLabel(eventTypeRef);
    this.parent.onEvent(
      `${this.mode}RequestOn${eventSuffix}`,
      typeof eventTypeRef === 'string' ? eventTypeRef : eventTypeRef.name,
      (steps) =>
        steps.triggerEvent('Request', {
          type: eventType(this.mode, 'request'),
          amount: "${document('/amount/total')}",
        }),
    );
    return this;
  }

  done(): PayNoteBuilder {
    return this.parent;
  }
}

export class PayNoteBuilder extends DocBuilder {
  private constructor(name: string) {
    super();
    this.name(name).type('PayNote/PayNote');
    this.channel('payerChannel', {
      type: 'MyOS/MyOS Timeline Channel',
    });
    this.channel('payeeChannel', {
      type: 'MyOS/MyOS Timeline Channel',
    });
    this.channel('guarantorChannel', {
      type: 'MyOS/MyOS Timeline Channel',
    });
  }

  static create(name: string): PayNoteBuilder {
    return new PayNoteBuilder(name);
  }

  currency(currency: string): this {
    this.field('/currency', currency);
    return this;
  }

  amountMinor(amountMinor: number): this {
    this.field('/amount/total', amountMinor);
    return this;
  }

  amountMajor(amountMajor: string): this {
    this.field('/amount/total', toMinor(amountMajor));
    return this;
  }

  capture(): PayNoteActionBuilder {
    return new PayNoteActionBuilder(this, 'capture');
  }

  reserve(): PayNoteActionBuilder {
    return new PayNoteActionBuilder(this, 'reserve');
  }

  release(): PayNoteActionBuilder {
    return new PayNoteActionBuilder(this, 'release');
  }

  operationTrigger(
    operationKey: string,
    channelKey: string,
    request: JsonObject | undefined,
    description: string | undefined,
    event: JsonObject,
    additionalSteps?: (steps: StepsBuilder) => void,
  ): void {
    const operation = this.operation(operationKey).channel(channelKey);
    if (description) {
      operation.description(description);
    }
    if (request) {
      operation.request(request);
    }
    operation
      .steps((steps) => {
        steps.triggerEvent('Trigger', event);
        additionalSteps?.(steps);
      })
      .done();
  }
}
