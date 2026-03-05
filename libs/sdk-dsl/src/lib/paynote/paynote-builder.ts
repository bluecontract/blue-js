import type { BlueNode } from '@blue-labs/language';
import { DocBuilder } from '../doc-builder/doc-builder.js';
import type { TypeLike } from '../core/type-alias.js';
import type { JsonObject } from '../core/types.js';

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
  if (mode === 'capture') {
    if (action === 'lock') {
      return 'PayNote/Card Transaction Capture Lock Requested';
    }
    if (action === 'unlock') {
      return 'PayNote/Card Transaction Capture Unlock Requested';
    }
    return 'PayNote/Capture Funds Requested';
  }
  if (mode === 'reserve') {
    if (action === 'lock') {
      return 'PayNote/Reserve Lock Requested';
    }
    if (action === 'unlock') {
      return 'PayNote/Reserve Unlock Requested';
    }
    return 'PayNote/Reserve Funds Requested';
  }
  if (action === 'lock') {
    return 'PayNote/Reservation Release Lock Requested';
  }
  if (action === 'unlock') {
    return 'PayNote/Reservation Release Unlock Requested';
  }
  return 'PayNote/Reservation Release Requested';
}

export class PayNoteActionBuilder {
  constructor(
    private readonly parent: PayNoteBuilder,
    private readonly mode: ActionMode,
  ) {}

  lockOnInit(): this {
    this.parent.onInitWorkflow(`${this.mode}LockOnInit`, (steps) =>
      steps.triggerEvent('Lock', { type: eventType(this.mode, 'lock') }),
    );
    return this;
  }

  unlockOnEvent(eventTypeRef: TypeLike): this {
    const eventSuffix = sanitizeTypeLabel(eventTypeRef);
    this.parent.onEventWorkflow(
      `${this.mode}UnlockOn${eventSuffix}`,
      typeof eventTypeRef === 'string' ? eventTypeRef : eventTypeRef.name,
      (steps) =>
        steps.triggerEvent('Unlock', { type: eventType(this.mode, 'unlock') }),
    );
    return this;
  }

  requestOnInit(): this {
    this.parent.onInitWorkflow(`${this.mode}RequestOnInit`, (steps) =>
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
  ): this {
    this.parent.operationTrigger(
      operationKey,
      channelKey,
      {
        type: 'Text',
      },
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
  ): this {
    this.parent.operationTrigger(
      operationKey,
      channelKey,
      undefined,
      description,
      {
        type: eventType(this.mode, 'unlock'),
      },
    );
    return this;
  }

  requestOnOperation(
    operationKey: string,
    channelKey: string,
    description?: string,
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
    );
    return this;
  }

  done(): PayNoteBuilder {
    return this.parent;
  }
}

export class PayNoteBuilder {
  private constructor(private readonly builder: DocBuilder) {}

  static create(name: string): PayNoteBuilder {
    const builder = DocBuilder.doc()
      .name(name)
      .type('PayNote/PayNote')
      .channel('payerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'payer-timeline',
      })
      .channel('payeeChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'payee-timeline',
      })
      .channel('guarantorChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'guarantor-timeline',
      });
    return new PayNoteBuilder(builder);
  }

  description(description: string): this {
    this.builder.description(description);
    return this;
  }

  currency(currency: string): this {
    this.builder.field('/currency', currency);
    return this;
  }

  amountMinor(amountMinor: number): this {
    this.builder.field('/amount/total', amountMinor);
    return this;
  }

  amountMajor(amountMajor: string): this {
    this.builder.field('/amount/total', toMinor(amountMajor));
    return this;
  }

  section(key: string, title: string, summary?: string): this {
    this.builder.section(key, title, summary);
    return this;
  }

  endSection(): this {
    this.builder.endSection();
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

  buildJson(): JsonObject {
    return this.builder.buildJson();
  }

  buildDocument(): BlueNode {
    return this.builder.buildDocument();
  }

  onInitWorkflow(
    workflowKey: string,
    stepsBuilder: Parameters<DocBuilder['onInit']>[1],
  ): void {
    this.builder.onInit(workflowKey, stepsBuilder);
  }

  onEventWorkflow(
    workflowKey: string,
    eventType: TypeLike,
    stepsBuilder: Parameters<DocBuilder['onEvent']>[2],
  ): void {
    this.builder.onEvent(workflowKey, eventType, stepsBuilder);
  }

  operationTrigger(
    operationKey: string,
    channelKey: string,
    request: JsonObject | undefined,
    description: string | undefined,
    event: JsonObject,
  ): void {
    const operation = this.builder.operation(operationKey).channel(channelKey);
    if (description) {
      operation.description(description);
    }
    if (request) {
      operation.request(request);
    }
    operation.steps((steps) => steps.triggerEvent('Trigger', event)).done();
  }
}
