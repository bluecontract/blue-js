import { toTypeAlias, type TypeLike } from '../core/type-alias.js';
import type {
  AgencyConfig,
  AgencyConfigRegistrationHost,
  InteractionPermissionTiming,
} from './types.js';

function requireText(value: string | undefined, field: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${field} is required`);
  }
  return normalized;
}

function token(name: string): string {
  const normalized = name
    .replace(/[^A-Za-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .toUpperCase();
  return normalized.length > 0 ? normalized : 'AGENCY';
}

type StepsCustomizer = (steps: {
  myOs: (adminChannelKey?: string) => {
    grantWorkerAgencyPermission: (
      onBehalfOf: string,
      requestId: string,
      workerAgencyPermissions: Record<string, unknown>,
      targetSessionId?: string,
    ) => unknown;
  };
  replaceValue: (name: string, path: string, value: unknown) => unknown;
}) => void;

type DocBuilderLike = {
  field(path: string, value: unknown): unknown;
  onInit(workflowKey: string, customizer: StepsCustomizer): unknown;
  onEvent(
    workflowKey: string,
    eventType: string,
    customizer: StepsCustomizer,
  ): unknown;
  onDocChange(
    workflowKey: string,
    path: string,
    customizer: StepsCustomizer,
  ): unknown;
  onMyOsResponse(
    workflowKey: string,
    responseType: string,
    requestId: string,
    customizer: StepsCustomizer,
  ): unknown;
};

export class AgencyBuilder<P> {
  private onBehalfOfValue: string | undefined;
  private requestIdValue: string | undefined;
  private targetSessionIdValue: string | undefined;
  private readonly allowedTypesValue: string[] = [];
  private readonly allowedOperationsValue: string[] = [];
  private statusPathValue: string | undefined;
  private permissionTimingValue: InteractionPermissionTiming = 'onInit';
  private permissionTriggerEventTypeValue: string | undefined;
  private permissionTriggerDocPathValue: string | undefined;

  constructor(
    private readonly parent: AgencyConfigRegistrationHost<P>,
    private readonly name: string,
  ) {}

  onBehalfOf(channelKey: string): this {
    this.onBehalfOfValue = requireText(channelKey, 'onBehalfOf');
    return this;
  }

  permissionFrom(channelKey: string): this {
    this.onBehalfOf(channelKey);
    return this;
  }

  requestId(requestId: string): this {
    this.requestIdValue = requireText(requestId, 'requestId');
    return this;
  }

  targetSessionId(targetSessionId: string): this {
    this.targetSessionIdValue = requireText(targetSessionId, 'targetSessionId');
    return this;
  }

  allowedTypes(...types: TypeLike[]): this {
    this.allowedTypesValue.length = 0;
    this.allowedTypesValue.push(...types.map((value) => toTypeAlias(value)));
    return this;
  }

  allowedOperations(...operations: string[]): this {
    this.allowedOperationsValue.length = 0;
    this.allowedOperationsValue.push(
      ...operations
        .map((operation) => operation?.trim())
        .filter((operation): operation is string => Boolean(operation)),
    );
    return this;
  }

  statusPath(statusPath: string): this {
    this.statusPathValue = requireText(statusPath, 'statusPath');
    return this;
  }

  requestPermissionOnInit(): this {
    this.permissionTimingValue = 'onInit';
    this.permissionTriggerEventTypeValue = undefined;
    this.permissionTriggerDocPathValue = undefined;
    return this;
  }

  requestPermissionOnEvent(eventType: TypeLike): this {
    this.permissionTimingValue = 'onEvent';
    this.permissionTriggerEventTypeValue = toTypeAlias(eventType);
    this.permissionTriggerDocPathValue = undefined;
    return this;
  }

  requestPermissionOnDocChange(path: string): this {
    this.permissionTimingValue = 'onDocChange';
    this.permissionTriggerDocPathValue = requireText(path, 'permission path');
    this.permissionTriggerEventTypeValue = undefined;
    return this;
  }

  requestPermissionManually(): this {
    this.permissionTimingValue = 'manual';
    this.permissionTriggerDocPathValue = undefined;
    this.permissionTriggerEventTypeValue = undefined;
    return this;
  }

  done(): P {
    const baseToken = token(this.name);
    const config: AgencyConfig = {
      name: this.name,
      token: baseToken,
      onBehalfOf: requireText(this.onBehalfOfValue, 'onBehalfOf'),
      requestId: this.requestIdValue ?? `REQ_AGENCY_${baseToken}`,
      allowedTypes: [...new Set(this.allowedTypesValue)],
      allowedOperations: [...new Set(this.allowedOperationsValue)],
      ...(this.statusPathValue ? { statusPath: this.statusPathValue } : {}),
      permissionTiming: this.permissionTimingValue,
      ...(this.permissionTriggerEventTypeValue
        ? { permissionTriggerEventType: this.permissionTriggerEventTypeValue }
        : {}),
      ...(this.permissionTriggerDocPathValue
        ? { permissionTriggerDocPath: this.permissionTriggerDocPathValue }
        : {}),
      permissionFrom: this.onBehalfOfValue,
      ...(this.targetSessionIdValue
        ? { targetSessionId: this.targetSessionIdValue }
        : {}),
    };
    const registered = this.parent.registerAgencyConfig(config);
    this.applyAutoWiring(config, registered as unknown as DocBuilderLike);
    return registered;
  }

  private applyAutoWiring(config: AgencyConfig, parent: DocBuilderLike): void {
    if (config.statusPath) {
      parent.field(config.statusPath, 'pending');
    }

    const workflowPrefix = `agency${config.token}`;
    const requestPermissionWorkflow: StepsCustomizer = (steps) => {
      const workerAgencyPermissions: Record<string, unknown> = {};
      if (config.allowedTypes.length > 0) {
        workerAgencyPermissions.allowedDocumentTypes = config.allowedTypes.map(
          (type) => ({ type }),
        );
      }
      if (config.allowedOperations.length > 0) {
        workerAgencyPermissions.allowedOperations = [
          ...config.allowedOperations,
        ];
      }
      steps
        .myOs()
        .grantWorkerAgencyPermission(
          config.onBehalfOf,
          config.requestId,
          workerAgencyPermissions,
          config.targetSessionId,
        );
    };

    if (config.permissionTiming === 'onInit') {
      parent.onInit(
        `${workflowPrefix}RequestPermission`,
        requestPermissionWorkflow,
      );
    } else if (config.permissionTiming === 'onEvent') {
      parent.onEvent(
        `${workflowPrefix}RequestPermission`,
        config.permissionTriggerEventType ?? 'Conversation/Event',
        requestPermissionWorkflow,
      );
    } else if (config.permissionTiming === 'onDocChange') {
      parent.onDocChange(
        `${workflowPrefix}RequestPermission`,
        config.permissionTriggerDocPath ?? '/',
        requestPermissionWorkflow,
      );
    }

    parent.onMyOsResponse(
      `${workflowPrefix}Granted`,
      'MyOS/Worker Agency Permission Granted',
      config.requestId,
      (steps) => {
        if (config.statusPath) {
          steps.replaceValue('MarkAgencyGranted', config.statusPath, 'granted');
        }
      },
    );

    parent.onMyOsResponse(
      `${workflowPrefix}Rejected`,
      'MyOS/Worker Agency Permission Rejected',
      config.requestId,
      (steps) => {
        if (config.statusPath) {
          steps.replaceValue(
            'MarkAgencyRejected',
            config.statusPath,
            'rejected',
          );
        }
      },
    );

    parent.onMyOsResponse(
      `${workflowPrefix}Revoked`,
      'MyOS/Worker Agency Permission Revoked',
      config.requestId,
      (steps) => {
        if (config.statusPath) {
          steps.replaceValue('MarkAgencyRevoked', config.statusPath, 'revoked');
        }
      },
    );
  }
}
