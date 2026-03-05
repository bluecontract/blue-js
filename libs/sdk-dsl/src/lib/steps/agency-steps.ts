import type { AgencyConfig } from '../interactions/types.js';
import type { TypeLike } from '../core/type-alias.js';
import type { JsonObject, JsonValue } from '../core/types.js';
import { AgencyBindingsBuilder } from '../interactions/agency-bindings-builder.js';
import { AgencyOptionsBuilder } from '../interactions/agency-options-builder.js';
import type { StepsBuilder } from './steps-builder.js';

export class AgencySteps {
  constructor(
    private readonly parent: StepsBuilder,
    private readonly config: AgencyConfig,
  ) {}

  requestPermission(
    workerAgencyPermissions: JsonObject,
    targetSessionId?: string,
  ): StepsBuilder {
    return this.parent
      .myOs()
      .grantWorkerAgencyPermission(
        this.config.permissionFrom,
        this.config.requestId,
        workerAgencyPermissions,
        targetSessionId ?? this.config.targetSessionId,
      );
  }

  requestPermissionForTarget(
    targetSessionId: string,
    workerAgencyPermissions: JsonObject,
  ): StepsBuilder {
    return this.requestPermission(workerAgencyPermissions, targetSessionId);
  }

  revokePermission(targetSessionId?: string): StepsBuilder {
    return this.parent
      .myOs()
      .revokeWorkerAgencyPermission(
        this.config.permissionFrom,
        this.config.requestId,
        targetSessionId ?? this.config.targetSessionId,
      );
  }

  revokePermissionForTarget(targetSessionId: string): StepsBuilder {
    return this.revokePermission(targetSessionId);
  }

  call(operation: string, request?: JsonValue): StepsBuilder {
    return this.parent
      .myOs()
      .callOperation(
        this.config.permissionFrom,
        this.requireTargetSessionId(),
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

  subscribe(subscriptionId: string, ...eventTypes: TypeLike[]): StepsBuilder {
    const resolvedEventTypes =
      eventTypes.length > 0 ? eventTypes : ['Conversation/Event'];
    return this.parent
      .myOs()
      .subscribeToSession(
        this.config.permissionFrom,
        this.requireTargetSessionId(),
        subscriptionId,
        ...resolvedEventTypes,
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

  startWorkerSession(
    agentChannelKey: string,
    document: JsonObject,
  ): StepsBuilder {
    return this.parent.myOs().startWorkerSession(agentChannelKey, document);
  }

  startWorkerSessionWith(
    agentChannelKey: string,
    document: JsonObject,
    configureBindings?: (bindings: AgencyBindingsBuilder) => void,
    configureOptions?: (options: AgencyOptionsBuilder) => void,
  ): StepsBuilder {
    const bindingsBuilder = new AgencyBindingsBuilder();
    configureBindings?.(bindingsBuilder);
    const optionsBuilder = new AgencyOptionsBuilder();
    configureOptions?.(optionsBuilder);

    return this.parent
      .myOs()
      .startWorkerSession(
        agentChannelKey,
        document,
        bindingsBuilder.build(),
        optionsBuilder.build(),
      );
  }

  private requireTargetSessionId(): string {
    if (!this.config.targetSessionId) {
      throw new Error(
        `agency('${this.config.name}') requires targetSessionId for this step helper`,
      );
    }
    return this.config.targetSessionId;
  }
}
