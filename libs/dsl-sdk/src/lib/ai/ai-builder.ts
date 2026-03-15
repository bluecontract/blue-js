import type { TypeLike } from '../core/type-alias.js';
import {
  type AiIntegrationDefinition,
  type AiIntegrationRegistrationHost,
  normalizeTypeLike,
  type AITaskTemplate,
} from './ai-types.js';

function requireText(value: string | undefined, field: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${field} is required`);
  }
  return normalized;
}

function tokenFor(name: string): string {
  return name
    .replace(/[^A-Za-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .toUpperCase();
}

export class AiTaskBuilder<P> {
  private readonly instructions: string[] = [];
  private readonly expectedResponses: string[] = [];

  constructor(
    private readonly parent: AiIntegrationBuilder<P>,
    private readonly taskName: string,
  ) {}

  instruction(instruction: string): this {
    const normalized = instruction.trim();
    if (normalized.length > 0) {
      this.instructions.push(normalized);
    }
    return this;
  }

  expects(typeLike: TypeLike): this {
    this.expectedResponses.push(normalizeTypeLike(typeLike));
    return this;
  }

  done(): AiIntegrationBuilder<P> {
    if (this.instructions.length === 0) {
      throw new Error(
        `Task '${this.taskName}' must define at least one instruction`,
      );
    }
    this.parent.registerTask({
      name: this.taskName,
      instructions: [...this.instructions],
      expectedResponses: [...this.expectedResponses],
    });
    return this.parent;
  }
}

export class AiIntegrationBuilder<P> {
  private readonly definition: AiIntegrationDefinition;

  constructor(
    private readonly parent: AiIntegrationRegistrationHost<P>,
    integrationName: string,
  ) {
    const name = requireText(integrationName, 'ai name');
    this.definition = {
      name,
      statusPath: `/ai/${name}/status`,
      contextPath: `/ai/${name}/context`,
      requesterId: tokenFor(name),
      requestId: `REQ_${tokenFor(name)}`,
      subscriptionId: `SUB_${tokenFor(name)}`,
      permissionTiming: 'onInit',
      tasks: {},
    };
  }

  sessionId(sessionId: string): this {
    this.definition.sessionId = requireText(sessionId, 'sessionId');
    return this;
  }

  permissionFrom(channelKey: string): this {
    this.definition.permissionFrom = requireText(channelKey, 'permissionFrom');
    return this;
  }

  statusPath(path: string): this {
    this.definition.statusPath = requireText(path, 'statusPath');
    return this;
  }

  contextPath(path: string): this {
    this.definition.contextPath = requireText(path, 'contextPath');
    return this;
  }

  requesterId(requesterId: string): this {
    this.definition.requesterId = requireText(requesterId, 'requesterId');
    return this;
  }

  requestId(requestId: string): this {
    this.definition.requestId = requireText(requestId, 'requestId');
    return this;
  }

  subscriptionId(subscriptionId: string): this {
    this.definition.subscriptionId = requireText(
      subscriptionId,
      'subscriptionId',
    );
    return this;
  }

  requestPermissionOnInit(): this {
    this.definition.permissionTiming = 'onInit';
    this.definition.permissionTriggerEventType = undefined;
    this.definition.permissionTriggerDocPath = undefined;
    return this;
  }

  requestPermissionOnEvent(eventType: TypeLike): this {
    this.definition.permissionTiming = 'onEvent';
    this.definition.permissionTriggerEventType = normalizeTypeLike(eventType);
    this.definition.permissionTriggerDocPath = undefined;
    return this;
  }

  requestPermissionOnDocChange(path: string): this {
    this.definition.permissionTiming = 'onDocChange';
    this.definition.permissionTriggerDocPath = requireText(
      path,
      'permission trigger doc path',
    );
    this.definition.permissionTriggerEventType = undefined;
    return this;
  }

  requestPermissionManually(): this {
    this.definition.permissionTiming = 'manual';
    this.definition.permissionTriggerDocPath = undefined;
    this.definition.permissionTriggerEventType = undefined;
    return this;
  }

  task(taskName: string): AiTaskBuilder<P> {
    return new AiTaskBuilder<P>(this, requireText(taskName, 'task name'));
  }

  registerTask(task: AITaskTemplate): void {
    if (this.definition.tasks[task.name]) {
      throw new Error(`Duplicate AI task name: ${task.name}`);
    }
    this.definition.tasks[task.name] = task;
  }

  done(): P {
    requireText(this.definition.sessionId, 'sessionId');
    requireText(this.definition.permissionFrom, 'permissionFrom');
    requireText(this.definition.statusPath, 'statusPath');
    requireText(this.definition.contextPath, 'contextPath');
    requireText(this.definition.requesterId, 'requesterId');
    return this.parent.registerAiIntegration(this.definition);
  }
}
