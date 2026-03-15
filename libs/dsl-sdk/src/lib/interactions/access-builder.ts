import { toTypeAlias, type TypeLike } from '../core/type-alias.js';
import type {
  AccessConfig,
  AccessConfigRegistrationHost,
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
  return normalized.length > 0 ? normalized : 'ACCESS';
}

type StepsCustomizer = (steps: {
  myOs: (adminChannelKey?: string) => {
    requestSingleDocPermission: (
      onBehalfOf: string,
      requestId: string,
      targetSessionId: string,
      permissions: unknown,
    ) => unknown;
    subscribeToSession: (
      targetSessionId: string,
      subscriptionId: string,
      ...eventTypes: string[]
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
    requestIdOrMatcher: string | Record<string, unknown>,
    customizer: StepsCustomizer,
  ): unknown;
  onSubscriptionUpdate(
    workflowKey: string,
    subscriptionId: string,
    updateType: string,
    customizer: StepsCustomizer,
  ): unknown;
};

export class AccessBuilder<P> {
  private onBehalfOfValue: string | undefined;
  private targetSessionIdValue: string | undefined;
  private requestIdValue: string | undefined;
  private subscriptionIdValue: string | undefined;
  private readValue = true;
  private readonly operationsValue: string[] = [];
  private statusPathValue: string | undefined;
  private subscribeAfterGrantedValue = false;
  private readonly subscriptionEventsValue: string[] = [];
  private subscribeToCreatedSessionsValue = false;
  private permissionTimingValue: InteractionPermissionTiming = 'onInit';
  private permissionTriggerEventTypeValue: string | undefined;
  private permissionTriggerDocPathValue: string | undefined;

  constructor(
    private readonly parent: AccessConfigRegistrationHost<P>,
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

  targetSessionId(sessionId: string): this {
    this.targetSessionIdValue = requireText(sessionId, 'targetSessionId');
    return this;
  }

  requestId(requestId: string): this {
    this.requestIdValue = requireText(requestId, 'requestId');
    return this;
  }

  subscriptionId(subscriptionId: string): this {
    this.subscriptionIdValue = requireText(subscriptionId, 'subscriptionId');
    return this;
  }

  read(read: boolean): this {
    if (read === false) {
      throw new Error(
        'access(...).read(false) is not supported; MyOS single-document permissions require read=true',
      );
    }
    this.readValue = read;
    return this;
  }

  operations(...operations: string[]): this {
    for (const operation of operations) {
      const normalized = operation?.trim();
      if (!normalized) {
        continue;
      }
      this.operationsValue.push(normalized);
    }
    return this;
  }

  statusPath(statusPath: string): this {
    this.statusPathValue = requireText(statusPath, 'statusPath');
    return this;
  }

  subscribeAfterGranted(): this {
    this.subscribeAfterGrantedValue = true;
    return this;
  }

  subscriptionEvents(...eventTypes: TypeLike[]): this {
    this.subscriptionEventsValue.length = 0;
    this.subscriptionEventsValue.push(
      ...eventTypes.map((eventType) => toTypeAlias(eventType)),
    );
    return this;
  }

  subscribeToCreatedSessions(enabled = true): this {
    if (enabled) {
      throw new Error(
        'access(...).subscribeToCreatedSessions(true) is not supported on the current public runtime',
      );
    }
    this.subscribeToCreatedSessionsValue = enabled;
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
    const config: AccessConfig = {
      name: this.name,
      token: baseToken,
      targetSessionId: requireText(
        this.targetSessionIdValue,
        'targetSessionId',
      ),
      onBehalfOf: requireText(this.onBehalfOfValue, 'onBehalfOf'),
      requestId: this.requestIdValue ?? `REQ_ACCESS_${baseToken}`,
      subscriptionId: this.subscriptionIdValue ?? `SUB_ACCESS_${baseToken}`,
      read: this.readValue,
      operations: [...new Set(this.operationsValue)],
      ...(this.statusPathValue ? { statusPath: this.statusPathValue } : {}),
      subscribeAfterGranted: this.subscribeAfterGrantedValue,
      subscriptionEvents: [...this.subscriptionEventsValue],
      subscribeToCreatedSessions: this.subscribeToCreatedSessionsValue,
      permissionTiming: this.permissionTimingValue,
      ...(this.permissionTriggerEventTypeValue
        ? { permissionTriggerEventType: this.permissionTriggerEventTypeValue }
        : {}),
      ...(this.permissionTriggerDocPathValue
        ? { permissionTriggerDocPath: this.permissionTriggerDocPathValue }
        : {}),
      permissionFrom: this.onBehalfOfValue,
    };
    const registered = this.parent.registerAccessConfig(config);
    this.applyAutoWiring(config, registered as unknown as DocBuilderLike);
    return registered;
  }

  private applyAutoWiring(config: AccessConfig, parent: DocBuilderLike): void {
    if (config.statusPath) {
      parent.field(config.statusPath, 'pending');
    }

    const workflowPrefix = `access${config.token}`;
    const requestPermissionWorkflow: StepsCustomizer = (steps) => {
      const permissions: Record<string, unknown> = {};
      if (config.read) {
        permissions.read = true;
      }
      if (config.operations.length > 0) {
        permissions.singleOps = [...config.operations];
      }
      steps
        .myOs()
        .requestSingleDocPermission(
          config.onBehalfOf,
          config.requestId,
          config.targetSessionId,
          permissions,
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
      'MyOS/Single Document Permission Granted',
      config.requestId,
      (steps) => {
        if (config.statusPath) {
          steps.replaceValue('MarkAccessGranted', config.statusPath, 'granted');
        }
        if (config.subscribeAfterGranted) {
          steps
            .myOs()
            .subscribeToSession(
              config.targetSessionId,
              config.subscriptionId,
              ...config.subscriptionEvents,
            );
        }
      },
    );

    parent.onMyOsResponse(
      `${workflowPrefix}Rejected`,
      'MyOS/Single Document Permission Rejected',
      config.requestId,
      (steps) => {
        if (config.statusPath) {
          steps.replaceValue(
            'MarkAccessRejected',
            config.statusPath,
            'rejected',
          );
        }
      },
    );

    parent.onMyOsResponse(
      `${workflowPrefix}Revoked`,
      'MyOS/Single Document Permission Revoked',
      config.requestId,
      (steps) => {
        if (config.statusPath) {
          steps.replaceValue('MarkAccessRevoked', config.statusPath, 'revoked');
        }
      },
    );

    if (!config.subscribeAfterGranted) {
      return;
    }

    parent.onMyOsResponse(
      `${workflowPrefix}SubscriptionReady`,
      'MyOS/Subscription to Session Initiated',
      {
        subscriptionId: config.subscriptionId,
      },
      (steps) => {
        if (config.statusPath) {
          steps.replaceValue(
            'MarkAccessSubscribed',
            config.statusPath,
            'subscribed',
          );
        }
      },
    );

    parent.onMyOsResponse(
      `${workflowPrefix}SubscriptionFailed`,
      'MyOS/Subscription to Session Failed',
      {
        subscriptionId: config.subscriptionId,
      },
      (steps) => {
        if (config.statusPath) {
          steps.replaceValue(
            'MarkAccessSubscriptionFailed',
            config.statusPath,
            'subscription-failed',
          );
        }
      },
    );
  }
}
