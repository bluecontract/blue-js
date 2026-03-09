import { BlueNode } from '@blue-labs/language';

import type {
  AITaskTemplate,
  PermissionTiming,
} from '../internal/interactions';
import { normalizeStringList, tokenOf } from '../internal/interactions';
import { resolveTypeInput } from '../internal/type-input';
import type { BlueValueInput, TypeInput } from '../types';
import { AINamedEventFieldsBuilder } from './steps-builder';
import type { DocBuilder } from './doc-builder';

type AccessBuilderState = {
  readonly name: string;
  readonly targetSessionId: BlueValueInput | null;
  readonly onBehalfOfChannel: string | null;
  readonly read: boolean;
  readonly operations: readonly string[];
  readonly statusPath: string | null;
  readonly subscribeAfterGranted: boolean;
  readonly subscriptionEvents: readonly TypeInput[];
  readonly permissionTiming: PermissionTiming;
};

type LinkBuilderState = {
  readonly read: boolean;
  readonly operations: readonly string[];
};

type LinkedAccessBuilderState = {
  readonly name: string;
  readonly targetSessionId: BlueValueInput | null;
  readonly onBehalfOfChannel: string | null;
  readonly statusPath: string | null;
  readonly links: Readonly<Record<string, LinkBuilderState>>;
  readonly permissionTiming: PermissionTiming;
};

type AgencyBuilderState = {
  readonly name: string;
  readonly onBehalfOfChannel: string | null;
  readonly targetSessionId: BlueValueInput | null;
  readonly allowedTypes: readonly TypeInput[];
  readonly allowedOperations: readonly string[];
  readonly statusPath: string | null;
  readonly permissionTiming: PermissionTiming;
};

type AIBuilderState = {
  readonly name: string;
  readonly sessionId: BlueValueInput | null;
  readonly permissionFromChannel: string | null;
  readonly statusPath: string | null;
  readonly contextPath: string | null;
  readonly requesterId: string | null;
  readonly permissionTiming: PermissionTiming;
  readonly tasks: ReadonlyMap<string, AITaskTemplate>;
};

export class AccessBuilder<P extends DocBuilder> {
  private targetSessionIdValue: BlueValueInput | null = null;
  private onBehalfOfChannel: string | null = null;
  private readValue = false;
  private readonly operationsList: string[] = [];
  private statusPathValue: string | null = null;
  private subscribeAfterGrantedValue = false;
  private readonly subscriptionEventTypes: TypeInput[] = [];
  private permissionTiming: PermissionTiming = { kind: 'onInit' };

  constructor(
    private readonly config: {
      readonly parent: P;
      readonly name: string;
      readonly applyState: (state: AccessBuilderState) => P;
    },
  ) {}

  targetSessionId(targetSessionId: BlueValueInput): AccessBuilder<P> {
    this.targetSessionIdValue = targetSessionId;
    return this;
  }

  onBehalfOf(channelKey: string): AccessBuilder<P> {
    this.onBehalfOfChannel = channelKey;
    return this;
  }

  read(read: boolean): AccessBuilder<P> {
    this.readValue = read;
    return this;
  }

  operations(...operations: string[]): AccessBuilder<P> {
    this.operationsList.push(...operations);
    return this;
  }

  statusPath(statusPath: string): AccessBuilder<P> {
    this.statusPathValue = requireNonEmpty(statusPath, 'statusPath');
    return this;
  }

  subscribeAfterGranted(): AccessBuilder<P> {
    this.subscribeAfterGrantedValue = true;
    return this;
  }

  subscriptionEvents(...eventTypes: TypeInput[]): AccessBuilder<P> {
    this.subscriptionEventTypes.push(
      ...eventTypes.filter(
        (eventType): eventType is TypeInput => eventType != null,
      ),
    );
    return this;
  }

  subscribeToCreatedSessions(enabled: boolean): AccessBuilder<P> {
    if (enabled) {
      throw new Error(
        'access(...).subscribeToCreatedSessions(true) is not supported on the current public runtime',
      );
    }
    return this;
  }

  requestPermissionOnInit(): AccessBuilder<P> {
    this.permissionTiming = { kind: 'onInit' };
    return this;
  }

  requestPermissionOnEvent(eventType: TypeInput): AccessBuilder<P> {
    this.permissionTiming = {
      kind: 'onEvent',
      eventType,
    };
    return this;
  }

  requestPermissionOnDocChange(path: string): AccessBuilder<P> {
    this.permissionTiming = {
      kind: 'onDocChange',
      path: requireNonEmpty(path, 'path'),
    };
    return this;
  }

  requestPermissionManually(): AccessBuilder<P> {
    this.permissionTiming = { kind: 'manual' };
    return this;
  }

  done(): P {
    return this.config.applyState({
      name: this.config.name,
      targetSessionId: this.targetSessionIdValue,
      onBehalfOfChannel: this.onBehalfOfChannel,
      read: this.readValue,
      operations: normalizeStringList(this.operationsList),
      statusPath: this.statusPathValue,
      subscribeAfterGranted: this.subscribeAfterGrantedValue,
      subscriptionEvents: this.subscriptionEventTypes,
      permissionTiming: this.permissionTiming,
    });
  }
}

export class LinkedAccessBuilder<P extends DocBuilder> {
  private targetSessionIdValue: BlueValueInput | null = null;
  private onBehalfOfChannel: string | null = null;
  private statusPathValue: string | null = null;
  private readonly linkStates = new Map<string, LinkBuilderState>();
  private permissionTiming: PermissionTiming = { kind: 'onInit' };

  constructor(
    private readonly config: {
      readonly parent: P;
      readonly name: string;
      readonly applyState: (state: LinkedAccessBuilderState) => P;
    },
  ) {}

  targetSessionId(targetSessionId: BlueValueInput): LinkedAccessBuilder<P> {
    this.targetSessionIdValue = targetSessionId;
    return this;
  }

  onBehalfOf(channelKey: string): LinkedAccessBuilder<P> {
    this.onBehalfOfChannel = channelKey;
    return this;
  }

  statusPath(statusPath: string): LinkedAccessBuilder<P> {
    this.statusPathValue = requireNonEmpty(statusPath, 'statusPath');
    return this;
  }

  link(linkName: string): LinkedAccessLinkBuilder<P> {
    const normalized = requireNonEmpty(linkName, 'link name');
    const existing = this.linkStates.get(normalized) ?? {
      read: false,
      operations: [],
    };

    return new LinkedAccessLinkBuilder({
      parent: this,
      name: normalized,
      initial: existing,
      commit: (state) => {
        this.linkStates.set(normalized, state);
        return this;
      },
    });
  }

  requestPermissionOnInit(): LinkedAccessBuilder<P> {
    this.permissionTiming = { kind: 'onInit' };
    return this;
  }

  requestPermissionOnEvent(eventType: TypeInput): LinkedAccessBuilder<P> {
    this.permissionTiming = {
      kind: 'onEvent',
      eventType,
    };
    return this;
  }

  requestPermissionOnDocChange(path: string): LinkedAccessBuilder<P> {
    this.permissionTiming = {
      kind: 'onDocChange',
      path: requireNonEmpty(path, 'path'),
    };
    return this;
  }

  requestPermissionManually(): LinkedAccessBuilder<P> {
    this.permissionTiming = { kind: 'manual' };
    return this;
  }

  done(): P {
    return this.config.applyState({
      name: this.config.name,
      targetSessionId: this.targetSessionIdValue,
      onBehalfOfChannel: this.onBehalfOfChannel,
      statusPath: this.statusPathValue,
      links: Object.fromEntries(this.linkStates.entries()),
      permissionTiming: this.permissionTiming,
    });
  }
}

export class LinkedAccessLinkBuilder<P extends DocBuilder> {
  private readValue: boolean;
  private readonly operationsList: string[];

  constructor(
    private readonly config: {
      readonly parent: LinkedAccessBuilder<P>;
      readonly name: string;
      readonly initial: LinkBuilderState;
      readonly commit: (state: LinkBuilderState) => LinkedAccessBuilder<P>;
    },
  ) {
    this.readValue = config.initial.read;
    this.operationsList = [...config.initial.operations];
  }

  read(read: boolean): LinkedAccessLinkBuilder<P> {
    this.readValue = read;
    return this;
  }

  operations(...operations: string[]): LinkedAccessLinkBuilder<P> {
    this.operationsList.push(...operations);
    return this;
  }

  done(): LinkedAccessBuilder<P> {
    return this.config.commit({
      read: this.readValue,
      operations: normalizeStringList(this.operationsList),
    });
  }
}

export class AgencyBuilder<P extends DocBuilder> {
  private onBehalfOfChannel: string | null = null;
  private targetSessionIdValue: BlueValueInput | null = null;
  private readonly allowedTypeInputs: TypeInput[] = [];
  private readonly allowedOperationKeys: string[] = [];
  private statusPathValue: string | null = null;
  private permissionTiming: PermissionTiming = { kind: 'onInit' };

  constructor(
    private readonly config: {
      readonly parent: P;
      readonly name: string;
      readonly applyState: (state: AgencyBuilderState) => P;
    },
  ) {}

  onBehalfOf(channelKey: string): AgencyBuilder<P> {
    this.onBehalfOfChannel = channelKey;
    return this;
  }

  targetSessionId(targetSessionId: BlueValueInput): AgencyBuilder<P> {
    this.targetSessionIdValue = targetSessionId;
    return this;
  }

  allowedTypes(...allowedTypes: TypeInput[]): AgencyBuilder<P> {
    this.allowedTypeInputs.push(
      ...allowedTypes.filter(
        (allowedType): allowedType is TypeInput => allowedType != null,
      ),
    );
    return this;
  }

  allowedOperations(...allowedOperations: string[]): AgencyBuilder<P> {
    this.allowedOperationKeys.push(...allowedOperations);
    return this;
  }

  statusPath(statusPath: string): AgencyBuilder<P> {
    this.statusPathValue = requireNonEmpty(statusPath, 'statusPath');
    return this;
  }

  requestPermissionOnInit(): AgencyBuilder<P> {
    this.permissionTiming = { kind: 'onInit' };
    return this;
  }

  requestPermissionOnEvent(eventType: TypeInput): AgencyBuilder<P> {
    this.permissionTiming = {
      kind: 'onEvent',
      eventType,
    };
    return this;
  }

  requestPermissionOnDocChange(path: string): AgencyBuilder<P> {
    this.permissionTiming = {
      kind: 'onDocChange',
      path: requireNonEmpty(path, 'path'),
    };
    return this;
  }

  requestPermissionManually(): AgencyBuilder<P> {
    this.permissionTiming = { kind: 'manual' };
    return this;
  }

  done(): P {
    return this.config.applyState({
      name: this.config.name,
      onBehalfOfChannel: this.onBehalfOfChannel,
      targetSessionId: this.targetSessionIdValue,
      allowedTypes: this.allowedTypeInputs,
      allowedOperations: normalizeStringList(this.allowedOperationKeys),
      statusPath: this.statusPathValue,
      permissionTiming: this.permissionTiming,
    });
  }
}

export class AiIntegrationBuilder<P extends DocBuilder> {
  private sessionIdValue: BlueValueInput | null = null;
  private permissionFromChannel: string | null = null;
  private statusPathValue: string;
  private contextPathValue: string;
  private requesterIdValue: string;
  private permissionTiming: PermissionTiming = { kind: 'onInit' };
  private readonly tasks = new Map<string, AITaskTemplate>();

  constructor(
    private readonly config: {
      readonly parent: P;
      readonly name: string;
      readonly applyState: (state: AIBuilderState) => P;
    },
  ) {
    this.statusPathValue = `/ai/${config.name}/status`;
    this.contextPathValue = `/ai/${config.name}/context`;
    this.requesterIdValue = tokenOf(config.name, 'AI');
  }

  sessionId(sessionId: BlueValueInput): AiIntegrationBuilder<P> {
    this.sessionIdValue = sessionId;
    return this;
  }

  permissionFrom(channelKey: string): AiIntegrationBuilder<P> {
    this.permissionFromChannel = requireNonEmpty(channelKey, 'permissionFrom');
    return this;
  }

  statusPath(pointer: string): AiIntegrationBuilder<P> {
    this.statusPathValue = requireNonEmpty(pointer, 'statusPath');
    return this;
  }

  contextPath(pointer: string): AiIntegrationBuilder<P> {
    this.contextPathValue = requireNonEmpty(pointer, 'contextPath');
    return this;
  }

  requesterId(requesterId: string): AiIntegrationBuilder<P> {
    this.requesterIdValue = requireNonEmpty(requesterId, 'requesterId');
    return this;
  }

  requestPermissionOnInit(): AiIntegrationBuilder<P> {
    this.permissionTiming = { kind: 'onInit' };
    return this;
  }

  requestPermissionOnEvent(eventType: TypeInput): AiIntegrationBuilder<P> {
    this.permissionTiming = {
      kind: 'onEvent',
      eventType,
    };
    return this;
  }

  requestPermissionOnDocChange(path: string): AiIntegrationBuilder<P> {
    this.permissionTiming = {
      kind: 'onDocChange',
      path: requireNonEmpty(path, 'path'),
    };
    return this;
  }

  requestPermissionManually(): AiIntegrationBuilder<P> {
    this.permissionTiming = { kind: 'manual' };
    return this;
  }

  task(taskName: string): AITaskBuilder<P> {
    return new AITaskBuilder({
      parent: this,
      taskName: requireNonEmpty(taskName, 'task name'),
      register: (task) => {
        if (this.tasks.has(task.name)) {
          throw new Error(`Duplicate AI task name: ${task.name}`);
        }
        this.tasks.set(task.name, task);
        return this;
      },
    });
  }

  done(): P {
    return this.config.applyState({
      name: this.config.name,
      sessionId: this.sessionIdValue,
      permissionFromChannel: this.permissionFromChannel,
      statusPath: this.statusPathValue,
      contextPath: this.contextPathValue,
      requesterId: this.requesterIdValue,
      permissionTiming: this.permissionTiming,
      tasks: new Map(this.tasks),
    });
  }
}

export class AITaskBuilder<P extends DocBuilder> {
  private readonly instructions: string[] = [];
  private readonly expectedResponses: BlueNode[] = [];
  private readonly expectedNamedEvents: ReturnType<
    AINamedEventFieldsBuilder['build']
  >[] = [];

  constructor(
    private readonly config: {
      readonly parent: AiIntegrationBuilder<P>;
      readonly taskName: string;
      readonly register: (task: AITaskTemplate) => AiIntegrationBuilder<P>;
    },
  ) {}

  instruction(text: string | null | undefined): AITaskBuilder<P> {
    const normalized = text?.trim() ?? '';
    if (normalized.length > 0) {
      this.instructions.push(normalized);
    }
    return this;
  }

  expects(typeInput: TypeInput): AITaskBuilder<P> {
    this.expectedResponses.push(resolveTypeInput(typeInput).clone());
    return this;
  }

  expectsNamed(eventName: string): AITaskBuilder<P>;
  expectsNamed(
    eventName: string,
    fieldsCustomizer: (fields: AINamedEventFieldsBuilder) => void,
  ): AITaskBuilder<P>;
  expectsNamed(eventName: string, ...fieldNames: string[]): AITaskBuilder<P>;
  expectsNamed(
    eventName: string,
    ...rest:
      | []
      | [fieldsCustomizer: (fields: AINamedEventFieldsBuilder) => void]
      | string[]
  ): AITaskBuilder<P> {
    const builder = new AINamedEventFieldsBuilder(eventName);
    const first = rest[0];
    if (typeof first === 'function') {
      first(builder);
    } else {
      for (const fieldName of rest.filter(
        (value): value is string => typeof value === 'string',
      )) {
        builder.field(fieldName);
      }
    }
    this.expectedNamedEvents.push(builder.build());
    return this;
  }

  done(): AiIntegrationBuilder<P> {
    if (this.instructions.length === 0) {
      throw new Error(
        `Task '${this.config.taskName}': at least one instruction required`,
      );
    }

    return this.config.register({
      name: this.config.taskName,
      instructions: [...this.instructions],
      expectedResponses: this.expectedResponses.map((response) =>
        response.clone(),
      ),
      expectedNamedEvents: this.expectedNamedEvents.map((expectation) => ({
        name: expectation.name,
        fields: expectation.fields.map((field) => ({
          name: field.name,
          description: field.description,
        })),
      })),
    });
  }
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
