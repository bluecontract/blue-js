import type { AgencyConfig } from '../interactions/types.js';
import type { TypeLike } from '../core/type-alias.js';
import type { JsonObject, JsonValue } from '../core/types.js';
import { AgencyBindingsBuilder } from '../interactions/agency-bindings-builder.js';
import { AgencyOptionsBuilder } from '../interactions/agency-options-builder.js';
import type { StepsBuilder } from './steps-builder.js';

function resolveOnBehalfOf(config: AgencyConfig): string {
  return config.onBehalfOf ?? config.permissionFrom ?? 'ownerChannel';
}

export class AgencySteps {
  constructor(
    private readonly parent: StepsBuilder,
    private readonly config: AgencyConfig,
  ) {}

  private defaultPermissions(): JsonObject {
    const permissions: JsonObject = {};
    if (this.config.allowedTypes.length > 0) {
      permissions.allowedDocumentTypes = this.config.allowedTypes.map(
        (type) => ({
          type,
        }),
      );
    }
    if (this.config.allowedOperations.length > 0) {
      permissions.allowedOperations = [...this.config.allowedOperations];
    }
    return permissions;
  }

  requestPermission(): StepsBuilder;
  requestPermission(stepName: string): StepsBuilder;
  requestPermission(
    workerAgencyPermissions: JsonObject,
    targetSessionId?: string,
  ): StepsBuilder;
  requestPermission(arg1?: string | JsonObject, arg2?: string): StepsBuilder {
    if (typeof arg1 === 'string') {
      return this.parent.emitType(
        arg1,
        'MyOS/Worker Agency Permission Grant Requested',
        (payload) => {
          payload.put('onBehalfOf', resolveOnBehalfOf(this.config));
          payload.put('requestId', this.config.requestId);
          payload.put('workerAgencyPermissions', this.defaultPermissions());
          if (this.config.targetSessionId) {
            payload.put('targetSessionId', this.config.targetSessionId);
          }
        },
      );
    }
    const workerAgencyPermissions = arg1 ?? this.defaultPermissions();
    const targetSessionId = arg2;
    return this.parent
      .myOs()
      .grantWorkerAgencyPermission(
        resolveOnBehalfOf(this.config),
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
        resolveOnBehalfOf(this.config),
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
        resolveOnBehalfOf(this.config),
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
        resolveOnBehalfOf(this.config),
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
        targetSessionId,
        subscriptionId,
        ...resolvedEventTypes,
      );
  }

  startSession(agentChannelKey: string, document: JsonObject): StepsBuilder {
    return this.parent.myOs().startWorkerSession(agentChannelKey, document);
  }

  startSessionWith(
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

  startWorkerSession(
    agentChannelKey: string,
    document: JsonObject,
  ): StepsBuilder {
    return this.startSession(agentChannelKey, document);
  }

  startWorkerSessionWith(
    agentChannelKey: string,
    document: JsonObject,
    configureBindings?: (bindings: AgencyBindingsBuilder) => void,
    configureOptions?: (options: AgencyOptionsBuilder) => void,
  ): StepsBuilder {
    return this.startSessionWith(
      agentChannelKey,
      document,
      configureBindings,
      configureOptions,
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
