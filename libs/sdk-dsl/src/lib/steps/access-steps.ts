import type {
  AccessConfig,
  LinkedAccessConfig,
} from '../interactions/types.js';
import type { JsonObject, JsonValue } from '../core/types.js';
import type { TypeLike } from '../core/type-alias.js';
import { MyOsPermissions } from './myos-permissions.js';
import type { StepsBuilder } from './steps-builder.js';

export class AccessSteps {
  constructor(
    private readonly parent: StepsBuilder,
    private readonly config: AccessConfig,
  ) {}

  requestPermission(
    permissions: JsonValue | MyOsPermissions | JsonObject = { read: true },
    grantSessionSubscriptionOnResult = false,
  ): StepsBuilder {
    return this.parent
      .myOs()
      .requestSingleDocPermission(
        this.config.permissionFrom,
        this.config.requestId,
        this.config.targetSessionId,
        permissions,
        grantSessionSubscriptionOnResult,
      );
  }

  revokePermission(): StepsBuilder {
    return this.parent
      .myOs()
      .revokeSingleDocPermission(
        this.config.permissionFrom,
        this.config.requestId,
        this.config.targetSessionId,
      );
  }

  subscribe(...eventTypes: TypeLike[]): StepsBuilder {
    const resolvedEventTypes =
      eventTypes.length > 0 ? eventTypes : ['Conversation/Event'];
    return this.parent
      .myOs()
      .subscribeToSession(
        this.config.permissionFrom,
        this.config.targetSessionId,
        this.config.subscriptionId,
        ...resolvedEventTypes,
      );
  }

  call(operation: string, request?: JsonValue): StepsBuilder {
    return this.parent
      .myOs()
      .callOperation(
        this.config.permissionFrom,
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
        this.config.permissionFrom,
        targetSessionId,
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
        this.config.permissionFrom,
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

  requestPermission(
    links: Record<string, JsonObject | JsonValue>,
  ): StepsBuilder {
    return this.parent
      .myOs()
      .requestLinkedDocsPermission(
        this.config.permissionFrom,
        this.config.requestId,
        this.config.targetSessionId,
        links,
      );
  }

  revokePermission(): StepsBuilder {
    return this.parent
      .myOs()
      .revokeLinkedDocsPermission(
        this.config.permissionFrom,
        this.config.requestId,
        this.config.targetSessionId,
      );
  }

  subscribe(...eventTypes: TypeLike[]): StepsBuilder {
    const resolvedEventTypes =
      eventTypes.length > 0 ? eventTypes : ['Conversation/Event'];
    return this.parent
      .myOs()
      .subscribeToSession(
        this.config.permissionFrom,
        this.config.targetSessionId,
        this.config.subscriptionId,
        ...resolvedEventTypes,
      );
  }

  call(operation: string, request?: JsonValue): StepsBuilder {
    return this.parent
      .myOs()
      .callOperation(
        this.config.permissionFrom,
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
        this.config.permissionFrom,
        targetSessionId,
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
        this.config.permissionFrom,
        targetSessionId,
        subscriptionId,
        ...resolvedEventTypes,
      );
  }
}
