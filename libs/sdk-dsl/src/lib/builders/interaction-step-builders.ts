import { BlueNode } from '@blue-labs/language';

import {
  createLinkedDocumentsPermissionSet,
  type AccessConfig,
  type AgencyConfig,
  type LinkedAccessConfig,
} from '../internal/interactions';
import { isBlank, wrapExpression } from '../internal/expression';
import { NodeObjectBuilder } from '../internal/node-object-builder';
import { toBlueNode } from '../internal/value-to-node';
import type { BlueValueInput, EventPatternInput } from '../types';
import type { StepsBuilder } from './steps-builder';

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

  subscribe(
    ...args: [stepName?: string, ...events: EventPatternInput[]]
  ): StepsBuilder {
    const { stepName, events } = resolveSubscribeArgs(
      args,
      this.config.subscriptionEvents,
    );

    return this.parent
      .myOs()
      .subscribeToSessionRequested(
        this.config.targetSessionId.clone(),
        this.config.subscriptionId,
        {
          stepName,
          events,
        },
      );
  }

  revokePermission(stepName = 'RevokePermission'): StepsBuilder {
    return this.parent.myOs().revokeSingleDocPermission(this.config.requestId, {
      stepName,
    });
  }
}

export class LinkedAccessSteps {
  constructor(
    private readonly parent: StepsBuilder,
    private readonly config: LinkedAccessConfig,
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
      .requestLinkedDocsPermission(
        this.config.onBehalfOfChannel,
        this.config.requestId,
        this.config.targetSessionId.clone(),
        createLinkedDocumentsPermissionSet(this.config.links),
        {
          stepName,
        },
      );
  }

  subscribe(
    ...args: [stepName?: string, ...events: EventPatternInput[]]
  ): StepsBuilder {
    const { stepName, events } = resolveSubscribeArgs(args);

    return this.parent
      .myOs()
      .subscribeToSessionRequested(
        this.config.targetSessionId.clone(),
        this.config.subscriptionId,
        {
          stepName,
          events,
        },
      );
  }

  revokePermission(stepName = 'RevokePermission'): StepsBuilder {
    return this.parent
      .myOs()
      .revokeLinkedDocsPermission(this.config.requestId, {
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

  call(operation: string, request: BlueValueInput | null): StepsBuilder {
    return this.parent
      .myOs()
      .callOperationRequested(
        this.config.onBehalfOfChannel,
        this.requireTargetSessionId(),
        operation,
        request ?? undefined,
      );
  }

  callExpr(operation: string, requestExpression: string): StepsBuilder {
    return this.call(operation, wrapExpression(requestExpression));
  }

  subscribe(
    ...args: [stepName?: string, ...events: EventPatternInput[]]
  ): StepsBuilder {
    const { stepName, events } = resolveSubscribeArgs(args);

    return this.parent
      .myOs()
      .subscribeToSessionRequested(
        this.requireTargetSessionId(),
        this.config.subscriptionId,
        {
          stepName,
          events,
        },
      );
  }

  revokePermission(stepName = 'RevokeAgencyPermission'): StepsBuilder {
    return this.parent
      .myOs()
      .revokeWorkerAgencyPermission(this.config.requestId, {
        stepName,
      });
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

  private requireTargetSessionId(): BlueNode {
    if (this.config.targetSessionId) {
      return this.config.targetSessionId.clone();
    }

    throw new Error(
      `agency('${this.config.name}'): targetSessionId is required for this step helper`,
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

function resolveSubscribeArgs(
  args: readonly [string?, ...EventPatternInput[]],
  fallbackEvents: readonly EventPatternInput[] = [],
): {
  stepName: string;
  events: readonly EventPatternInput[] | undefined;
} {
  if (args.length === 0) {
    return {
      stepName: 'Subscribe',
      events: fallbackEvents.length > 0 ? fallbackEvents : undefined,
    };
  }

  const [first, ...rest] = args;
  if (
    first != null &&
    (typeof first !== 'string' || looksLikeEventPatternString(first))
  ) {
    return {
      stepName: 'Subscribe',
      events: [first, ...rest],
    };
  }

  return {
    stepName: requireNonEmpty(first ?? 'Subscribe', 'step name'),
    events:
      rest.length > 0
        ? rest
        : fallbackEvents.length > 0
          ? fallbackEvents
          : undefined,
  };
}

function looksLikeEventPatternString(value: string): boolean {
  return value.includes('/');
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

function normalizeOptional(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function buildStringRecordNode(values: ReadonlyMap<string, string>): BlueNode {
  const node = new BlueNode();
  for (const [key, value] of values.entries()) {
    node.addProperty(key, toBlueNode(value));
  }
  return node;
}

function buildBooleanRecordNode(
  values: ReadonlyMap<string, boolean>,
): BlueNode {
  const node = new BlueNode();
  for (const [key, value] of values.entries()) {
    node.addProperty(key, toBlueNode(value));
  }
  return node;
}
