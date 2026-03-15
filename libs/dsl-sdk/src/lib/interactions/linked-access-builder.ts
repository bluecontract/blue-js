import { toTypeAlias, type TypeLike } from '../core/type-alias.js';
import type {
  LinkedAccessConfig,
  LinkedAccessConfigRegistrationHost,
  LinkedAccessLinkConfig,
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
  return normalized.length > 0 ? normalized : 'LINKED_ACCESS';
}

type StepsCustomizer = (steps: {
  myOs: (adminChannelKey?: string) => {
    requestLinkedDocsPermission: (
      onBehalfOf: string,
      requestId: string,
      targetSessionId: string,
      linkedPermissions: Record<string, unknown>,
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

interface LinkedAccessLinkDraft {
  read: boolean;
  operations: string[];
}

export class LinkedAccessBuilder<P> {
  private onBehalfOfValue: string | undefined;
  private targetSessionIdValue: string | undefined;
  private requestIdValue: string | undefined;
  private subscriptionIdValue: string | undefined;
  private statusPathValue: string | undefined;
  private readonly linksValue = new Map<string, LinkedAccessLinkDraft>();
  private permissionTimingValue: InteractionPermissionTiming = 'onInit';
  private permissionTriggerEventTypeValue: string | undefined;
  private permissionTriggerDocPathValue: string | undefined;
  private readonly subscriptionEventsValue: string[] = [];

  constructor(
    private readonly parent: LinkedAccessConfigRegistrationHost<P>,
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

  statusPath(statusPath: string): this {
    this.statusPathValue = requireText(statusPath, 'statusPath');
    return this;
  }

  link(name: string): LinkedAccessLinkBuilder<P> {
    const normalizedName = requireText(name, 'link name');
    const draft = this.linksValue.get(normalizedName) ?? {
      read: true,
      operations: [],
    };
    this.linksValue.set(normalizedName, draft);
    return new LinkedAccessLinkBuilder(this, draft);
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

  subscriptionEvents(...eventTypes: TypeLike[]): this {
    this.subscriptionEventsValue.length = 0;
    this.subscriptionEventsValue.push(
      ...eventTypes.map((eventType) => toTypeAlias(eventType)),
    );
    return this;
  }

  done(): P {
    const baseToken = token(this.name);
    if (this.linksValue.size === 0) {
      throw new Error('At least one linked access link must be configured');
    }
    const links: Record<string, LinkedAccessLinkConfig> = {};
    for (const [linkName, linkValue] of this.linksValue.entries()) {
      links[linkName] = {
        read: linkValue.read,
        operations: [...new Set(linkValue.operations)],
      };
    }
    const config: LinkedAccessConfig = {
      name: this.name,
      token: baseToken,
      targetSessionId: requireText(
        this.targetSessionIdValue,
        'targetSessionId',
      ),
      onBehalfOf: requireText(this.onBehalfOfValue, 'onBehalfOf'),
      requestId: this.requestIdValue ?? `REQ_LINKED_${baseToken}`,
      subscriptionId: this.subscriptionIdValue ?? `SUB_LINKED_${baseToken}`,
      ...(this.statusPathValue ? { statusPath: this.statusPathValue } : {}),
      links,
      permissionTiming: this.permissionTimingValue,
      ...(this.permissionTriggerEventTypeValue
        ? { permissionTriggerEventType: this.permissionTriggerEventTypeValue }
        : {}),
      ...(this.permissionTriggerDocPathValue
        ? { permissionTriggerDocPath: this.permissionTriggerDocPathValue }
        : {}),
      permissionFrom: this.onBehalfOfValue,
      subscriptionEvents: [...this.subscriptionEventsValue],
    };
    const registered = this.parent.registerLinkedAccessConfig(config);
    this.applyAutoWiring(config, registered as unknown as DocBuilderLike);
    return registered;
  }

  private applyAutoWiring(
    config: LinkedAccessConfig,
    parent: DocBuilderLike,
  ): void {
    if (config.statusPath) {
      parent.field(config.statusPath, 'pending');
    }

    const workflowPrefix = `linkedAccess${config.token}`;
    const requestPermissionWorkflow: StepsCustomizer = (steps) => {
      const linkedPermissions: Record<string, unknown> = {};
      for (const [linkName, linkConfig] of Object.entries(config.links)) {
        const permission: Record<string, unknown> = {};
        if (linkConfig.read) {
          permission.read = true;
        }
        if (linkConfig.operations.length > 0) {
          permission.singleOps = [...linkConfig.operations];
        }
        linkedPermissions[linkName] = permission;
      }
      steps
        .myOs()
        .requestLinkedDocsPermission(
          config.onBehalfOf,
          config.requestId,
          config.targetSessionId,
          linkedPermissions,
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
      'MyOS/Linked Documents Permission Granted',
      config.requestId,
      (steps) => {
        if (config.statusPath) {
          steps.replaceValue(
            'MarkLinkedAccessGranted',
            config.statusPath,
            'granted',
          );
        }
      },
    );

    parent.onMyOsResponse(
      `${workflowPrefix}Rejected`,
      'MyOS/Linked Documents Permission Rejected',
      config.requestId,
      (steps) => {
        if (config.statusPath) {
          steps.replaceValue(
            'MarkLinkedAccessRejected',
            config.statusPath,
            'rejected',
          );
        }
      },
    );

    parent.onMyOsResponse(
      `${workflowPrefix}Revoked`,
      'MyOS/Linked Documents Permission Revoked',
      config.requestId,
      (steps) => {
        if (config.statusPath) {
          steps.replaceValue(
            'MarkLinkedAccessRevoked',
            config.statusPath,
            'revoked',
          );
        }
      },
    );
  }
}

class LinkedAccessLinkBuilder<P> {
  constructor(
    private readonly parent: LinkedAccessBuilder<P>,
    private readonly draft: LinkedAccessLinkDraft,
  ) {}

  read(read: boolean): this {
    if (read === false) {
      throw new Error(
        'accessLinked(...).link(...).read(false) is not supported; MyOS linked-document permissions require read=true',
      );
    }
    this.draft.read = read;
    return this;
  }

  operations(...operations: string[]): this {
    this.draft.operations = operations
      .map((operation) => operation?.trim())
      .filter((operation): operation is string => Boolean(operation));
    return this;
  }

  done(): LinkedAccessBuilder<P> {
    return this.parent;
  }
}
