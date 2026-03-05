import type { AgencyConfig } from '../interactions/types.js';
import type { JsonObject } from '../core/types.js';
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

  revokePermission(targetSessionId?: string): StepsBuilder {
    return this.parent
      .myOs()
      .revokeWorkerAgencyPermission(
        this.config.permissionFrom,
        this.config.requestId,
        targetSessionId ?? this.config.targetSessionId,
      );
  }

  startWorkerSession(
    agentChannelKey: string,
    document: JsonObject,
  ): StepsBuilder {
    return this.parent.myOs().startWorkerSession(agentChannelKey, document);
  }
}
