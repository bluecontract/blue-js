import type {
  AccessConfig,
  LinkedAccessConfig,
} from '../interactions/types.js';
import type { JsonObject, JsonValue } from '../core/types.js';
import type { StepsBuilder } from './steps-builder.js';

export class AccessSteps {
  constructor(
    private readonly parent: StepsBuilder,
    private readonly config: AccessConfig,
  ) {}

  requestPermission(): StepsBuilder {
    return this.parent
      .myOs()
      .requestSingleDocPermission(
        this.config.permissionFrom,
        this.config.requestId,
        this.config.targetSessionId,
        {
          read: true,
        },
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

  subscribe(): StepsBuilder {
    return this.parent
      .myOs()
      .subscribeToSession(
        this.config.permissionFrom,
        this.config.targetSessionId,
        this.config.subscriptionId,
        'Conversation/Event',
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
}
