import type { JsonObject } from '../core/types.js';

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${field} is required`);
  }
  return normalized;
}

export class AgencyCapabilitiesBuilder {
  private readonly values: Record<string, boolean> = {};

  set(name: string, enabled: boolean): this {
    this.values[requireText(name, 'capability name')] = enabled;
    return this;
  }

  participantsOrchestration(enabled: boolean): this {
    return this.set('participantsOrchestration', enabled);
  }

  sessionInteraction(enabled: boolean): this {
    return this.set('sessionInteraction', enabled);
  }

  workerAgency(enabled: boolean): this {
    return this.set('workerAgency', enabled);
  }

  build(): JsonObject {
    return structuredClone(this.values);
  }
}

export class AgencyOptionsBuilder {
  private defaultMessageValue: string | undefined;
  private readonly perChannelMessages: Record<string, string> = {};
  private readonly capabilitiesValue: Record<string, boolean> = {};

  bootstrapAssignee(channelKey: string): this {
    requireText(channelKey, 'bootstrapAssignee channelKey');
    throw new Error(
      'agency start worker session options do not support bootstrapAssignee; use the agency onBehalfOf channel plus initialMessages/capabilities',
    );
  }

  defaultMessage(message: string): this {
    this.defaultMessageValue = message;
    return this;
  }

  channelMessage(channelKey: string, message: string): this {
    const normalized = channelKey.trim();
    if (normalized.length === 0) {
      throw new Error('channelKey is required');
    }
    this.perChannelMessages[normalized] = message;
    return this;
  }

  capabilities(
    customizer: (capabilities: AgencyCapabilitiesBuilder) => void,
  ): this {
    if (typeof customizer !== 'function') {
      throw new Error('capabilities customizer is required');
    }
    const builder = new AgencyCapabilitiesBuilder();
    customizer(builder);
    Object.assign(this.capabilitiesValue, builder.build());
    return this;
  }

  build(): JsonObject {
    const result: JsonObject = {};
    if (
      this.defaultMessageValue !== undefined ||
      Object.keys(this.perChannelMessages).length > 0
    ) {
      result.initialMessages = {
        ...(this.defaultMessageValue !== undefined
          ? { defaultMessage: this.defaultMessageValue }
          : {}),
        ...(Object.keys(this.perChannelMessages).length > 0
          ? { perChannel: structuredClone(this.perChannelMessages) }
          : {}),
      };
    }
    if (Object.keys(this.capabilitiesValue).length > 0) {
      result.capabilities = structuredClone(this.capabilitiesValue);
    }
    return result;
  }
}
