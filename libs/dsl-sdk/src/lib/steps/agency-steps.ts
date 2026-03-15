import type { AgencyConfig } from '../interactions/types.js';
import type { TypeLike } from '../core/type-alias.js';
import type { JsonObject, JsonValue } from '../core/types.js';
import { AgencyBindingsBuilder } from '../interactions/agency-bindings-builder.js';
import { AgencyOptionsBuilder } from '../interactions/agency-options-builder.js';
import type { StepsBuilder } from './steps-builder.js';

function resolveOnBehalfOf(config: AgencyConfig): string {
  return config.onBehalfOf ?? config.permissionFrom ?? 'ownerChannel';
}

function buildAllowedWorkerAgencyPermissions(
  workerTypes: readonly string[],
  allowedOperations: readonly string[],
): JsonObject[] {
  return workerTypes.map((workerType) => ({
    type: 'MyOS/Worker Agency Permission',
    workerType,
    permissions: {
      read: true,
      ...(allowedOperations.length > 0
        ? { singleOps: [...allowedOperations] }
        : {}),
    },
  }));
}

function normalizeWorkerAgencyPermissionsInput(
  input: JsonObject,
): JsonObject[] | JsonValue {
  if (Array.isArray(input.allowedWorkerAgencyPermissions)) {
    return input.allowedWorkerAgencyPermissions as JsonObject[];
  }
  if (
    typeof input.workerType === 'string' ||
    input.type === 'MyOS/Worker Agency Permission'
  ) {
    return [input];
  }
  return input;
}

export class AgencySteps {
  constructor(
    private readonly parent: StepsBuilder,
    private readonly config: AgencyConfig,
  ) {}

  private defaultPermissions(): JsonObject[] {
    return buildAllowedWorkerAgencyPermissions(
      this.config.allowedTypes,
      this.config.allowedOperations,
    );
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
          payload.put(
            'allowedWorkerAgencyPermissions',
            this.defaultPermissions(),
          );
        },
      );
    }
    const workerAgencyPermissions =
      arg1 === undefined
        ? this.defaultPermissions()
        : normalizeWorkerAgencyPermissionsInput(arg1);
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
        this.config.requestId,
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
        this.config.requestId,
      );
  }

  subscribe(subscriptionId: string, ...eventTypes: TypeLike[]): StepsBuilder {
    return this.parent
      .myOs()
      .subscribeToSession(
        this.requireTargetSessionId(),
        subscriptionId,
        ...eventTypes,
      );
  }

  subscribeForTarget(
    targetSessionId: JsonValue,
    subscriptionId: string,
    ...eventTypes: TypeLike[]
  ): StepsBuilder {
    return this.parent
      .myOs()
      .subscribeToSession(
        targetSessionId,
        subscriptionId,
        ...eventTypes,
      );
  }

  startSession(_agentChannelKey: string, _document: JsonObject): StepsBuilder {
    throw new Error(
      'viaAgency(...).startSession(...) requires channel bindings; use startSessionWith(...)',
    );
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
