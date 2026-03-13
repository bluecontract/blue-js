import type {
  AccessConfig,
  LinkedAccessConfig,
} from '../interactions/types.js';
import type { JsonObject, JsonValue } from '../core/types.js';
import { toTypeAlias, type TypeLike } from '../core/type-alias.js';
import {
  MyOsPermissions,
  normalizeMyOsPermissionObject,
} from './myos-permissions.js';
import type { StepsBuilder } from './steps-builder.js';

function toPermissionNode(
  value: JsonValue | MyOsPermissions | JsonObject | null | undefined,
): JsonValue {
  if (value instanceof MyOsPermissions) {
    return value.build();
  }
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value === 'object') {
    return normalizeMyOsPermissionObject(value as JsonObject);
  }
  return value;
}

function normalizeLinkedPermissionLinks(
  links: Record<string, JsonObject | JsonValue>,
): JsonObject {
  const normalized: JsonObject = {};
  for (const [linkName, linkValue] of Object.entries(links)) {
    normalized[linkName] =
      typeof linkValue === 'object' && linkValue !== null
        ? normalizeMyOsPermissionObject(linkValue as JsonObject)
        : linkValue;
  }
  return normalized;
}

function resolveOnBehalfOf(
  config: Pick<AccessConfig, 'onBehalfOf' | 'permissionFrom'>,
): string {
  return config.onBehalfOf ?? config.permissionFrom ?? 'ownerChannel';
}

function resolveLinkedOnBehalfOf(
  config: Pick<LinkedAccessConfig, 'onBehalfOf' | 'permissionFrom'>,
): string {
  return config.onBehalfOf ?? config.permissionFrom ?? 'ownerChannel';
}

export class AccessSteps {
  constructor(
    private readonly parent: StepsBuilder,
    private readonly config: AccessConfig,
  ) {}

  private defaultPermissions(): JsonObject {
    const permissions: JsonObject = {};
    if (this.config.read) {
      permissions.read = true;
    }
    if (this.config.operations.length > 0) {
      permissions.singleOps = [...this.config.operations];
    }
    return permissions;
  }

  private emitRequestPermission(
    stepName: string,
    targetSessionId: JsonValue,
    permissions: JsonValue | MyOsPermissions | JsonObject,
  ): StepsBuilder {
    return this.parent.emitType(
      stepName,
      'MyOS/Single Document Permission Grant Requested',
      (payload) => {
        payload.put('onBehalfOf', resolveOnBehalfOf(this.config));
        payload.put('requestId', this.config.requestId);
        payload.put('targetSessionId', targetSessionId);
        payload.put('permissions', toPermissionNode(permissions));
      },
    );
  }

  requestPermission(): StepsBuilder;
  requestPermission(stepName: string): StepsBuilder;
  requestPermission(
    permissions: JsonValue | MyOsPermissions | JsonObject,
  ): StepsBuilder;
  requestPermission(
    arg1?: string | JsonValue | MyOsPermissions | JsonObject,
  ): StepsBuilder {
    if (typeof arg1 === 'string') {
      return this.emitRequestPermission(
        arg1,
        this.config.targetSessionId,
        this.defaultPermissions(),
      );
    }
    const permissions = arg1 ?? this.defaultPermissions();
    return this.parent
      .myOs()
      .requestSingleDocPermission(
        resolveOnBehalfOf(this.config),
        this.config.requestId,
        this.config.targetSessionId,
        permissions,
      );
  }

  requestPermissionForTarget(
    targetSessionId: JsonValue,
    permissions: JsonValue | MyOsPermissions | JsonObject = { read: true },
  ): StepsBuilder {
    return this.parent
      .myOs()
      .requestSingleDocPermission(
        resolveOnBehalfOf(this.config),
        this.config.requestId,
        targetSessionId,
        permissions,
      );
  }

  revokePermission(): StepsBuilder {
    return this.parent
      .myOs()
      .revokeSingleDocPermission(
        resolveOnBehalfOf(this.config),
        this.config.requestId,
        this.config.targetSessionId,
      );
  }

  revokePermissionForTarget(targetSessionId: JsonValue): StepsBuilder {
    return this.parent
      .myOs()
      .revokeSingleDocPermission(
        resolveOnBehalfOf(this.config),
        this.config.requestId,
        targetSessionId,
      );
  }

  subscribe(): StepsBuilder;
  subscribe(stepName: string): StepsBuilder;
  subscribe(stepName = 'SubscribeToSession'): StepsBuilder {
    const eventTypes =
      this.config.subscriptionEvents.length > 0
        ? this.config.subscriptionEvents
        : ['Conversation/Event'];
    return this.parent.emitType(
      stepName,
      'MyOS/Subscribe to Session Requested',
      (payload) => {
        payload.put('targetSessionId', this.config.targetSessionId);
        payload.put('subscription', {
          id: this.config.subscriptionId,
          events: eventTypes.map((eventType) => ({
            type: toTypeAlias(eventType),
          })),
        });
      },
    );
  }

  call(operation: string, request?: JsonValue): StepsBuilder {
    return this.parent
      .myOs()
      .callOperation(
        resolveOnBehalfOf(this.config),
        this.config.targetSessionId,
        operation,
        request,
      );
  }

  callOnTarget(
    targetSessionId: JsonValue,
    operation: string,
    request?: JsonValue,
  ): StepsBuilder {
    return this.parent
      .myOs()
      .callOperation(
        resolveOnBehalfOf(this.config),
        targetSessionId,
        operation,
        request,
      );
  }

  callExpr(
    targetSessionIdExpression: string,
    operation: string,
    request?: JsonValue,
  ): StepsBuilder {
    return this.callOnTarget(
      { $eval: targetSessionIdExpression },
      operation,
      request,
    );
  }

  subscribeForTarget(
    targetSessionId: JsonValue,
    subscriptionId: string,
    ...eventTypes: TypeLike[]
  ): StepsBuilder {
    const resolvedEventTypes =
      eventTypes.length > 0 ? eventTypes : ['Conversation/Event'];
    return this.parent
      .myOs()
      .subscribeToSession(
        targetSessionId,
        subscriptionId,
        ...resolvedEventTypes,
      );
  }
}

export class LinkedAccessSteps {
  constructor(
    private readonly parent: StepsBuilder,
    private readonly config: LinkedAccessConfig,
  ) {}

  private defaultLinks(): Record<string, JsonObject> {
    const links: Record<string, JsonObject> = {};
    for (const [linkName, linkConfig] of Object.entries(this.config.links)) {
      const permissions: JsonObject = {};
      if (linkConfig.read) {
        permissions.read = true;
      }
      if (linkConfig.operations.length > 0) {
        permissions.singleOps = [...linkConfig.operations];
      }
      links[linkName] = permissions;
    }
    return links;
  }

  private emitRequestLinkedPermission(
    stepName: string,
    targetSessionId: JsonValue,
    links: Record<string, JsonObject | JsonValue>,
  ): StepsBuilder {
    return this.parent.emitType(
      stepName,
      'MyOS/Linked Documents Permission Grant Requested',
      (payload) => {
        payload.put('onBehalfOf', resolveLinkedOnBehalfOf(this.config));
        payload.put('requestId', this.config.requestId);
        payload.put('targetSessionId', targetSessionId);
        payload.put('links', normalizeLinkedPermissionLinks(links));
      },
    );
  }

  requestPermission(): StepsBuilder;
  requestPermission(stepName: string): StepsBuilder;
  requestPermission(
    links: Record<string, JsonObject | JsonValue>,
  ): StepsBuilder;
  requestPermission(
    arg?: string | Record<string, JsonObject | JsonValue>,
  ): StepsBuilder {
    if (typeof arg === 'string') {
      return this.emitRequestLinkedPermission(
        arg,
        this.config.targetSessionId,
        this.defaultLinks(),
      );
    }
    if (arg === undefined) {
      return this.parent
        .myOs()
        .requestLinkedDocsPermission(
          resolveLinkedOnBehalfOf(this.config),
          this.config.requestId,
          this.config.targetSessionId,
          this.defaultLinks(),
        );
    }
    return this.parent
      .myOs()
      .requestLinkedDocsPermission(
        resolveLinkedOnBehalfOf(this.config),
        this.config.requestId,
        this.config.targetSessionId,
        arg,
      );
  }

  requestPermissionForTarget(
    targetSessionId: JsonValue,
    links: Record<string, JsonObject | JsonValue>,
  ): StepsBuilder {
    return this.parent
      .myOs()
      .requestLinkedDocsPermission(
        resolveLinkedOnBehalfOf(this.config),
        this.config.requestId,
        targetSessionId,
        links,
      );
  }

  revokePermission(): StepsBuilder {
    return this.parent
      .myOs()
      .revokeLinkedDocsPermission(
        resolveLinkedOnBehalfOf(this.config),
        this.config.requestId,
        this.config.targetSessionId,
      );
  }

  revokePermissionForTarget(targetSessionId: JsonValue): StepsBuilder {
    return this.parent
      .myOs()
      .revokeLinkedDocsPermission(
        resolveLinkedOnBehalfOf(this.config),
        this.config.requestId,
        targetSessionId,
      );
  }

  subscribe(): StepsBuilder;
  subscribe(stepName: string): StepsBuilder;
  subscribe(stepName = 'SubscribeToSession'): StepsBuilder {
    const subscriptionId =
      this.config.subscriptionId ?? `SUB_LINKED_${this.config.token}`;
    const eventTypes =
      (this.config.subscriptionEvents?.length ?? 0) > 0
        ? (this.config.subscriptionEvents as readonly string[])
        : ['Conversation/Event'];
    return this.parent.emitType(
      stepName,
      'MyOS/Subscribe to Session Requested',
      (payload) => {
        payload.put('targetSessionId', this.config.targetSessionId);
        payload.put('subscription', {
          id: subscriptionId,
          events: eventTypes.map((eventType) => ({
            type: toTypeAlias(eventType),
          })),
        });
      },
    );
  }

  call(operation: string, request?: JsonValue): StepsBuilder {
    return this.parent
      .myOs()
      .callOperation(
        resolveLinkedOnBehalfOf(this.config),
        this.config.targetSessionId,
        operation,
        request,
      );
  }

  callOnTarget(
    targetSessionId: JsonValue,
    operation: string,
    request?: JsonValue,
  ): StepsBuilder {
    return this.parent
      .myOs()
      .callOperation(
        resolveLinkedOnBehalfOf(this.config),
        targetSessionId,
        operation,
        request,
      );
  }

  callExpr(
    targetSessionIdExpression: string,
    operation: string,
    request?: JsonValue,
  ): StepsBuilder {
    return this.callOnTarget(
      { $eval: targetSessionIdExpression },
      operation,
      request,
    );
  }

  subscribeForTarget(
    targetSessionId: JsonValue,
    subscriptionId: string,
    ...eventTypes: TypeLike[]
  ): StepsBuilder {
    const resolvedEventTypes =
      eventTypes.length > 0 ? eventTypes : ['Conversation/Event'];
    return this.parent
      .myOs()
      .subscribeToSession(
        targetSessionId,
        subscriptionId,
        ...resolvedEventTypes,
      );
  }
}
