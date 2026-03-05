import type { AgencyConfig } from '../interactions/types.js';
import type { JsonObject } from '../core/types.js';
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
}
