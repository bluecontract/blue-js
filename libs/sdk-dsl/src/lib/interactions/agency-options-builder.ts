import type { JsonObject } from '../core/types.js';

export class AgencyOptionsBuilder {
  private bootstrapAssigneeValue: string | undefined;
  private defaultMessageValue: string | undefined;
  private readonly perChannelMessages: Record<string, string> = {};

  bootstrapAssignee(channelKey: string): this {
    const normalized = channelKey.trim();
    if (normalized.length === 0) {
      throw new Error('bootstrapAssignee channelKey is required');
    }
    this.bootstrapAssigneeValue = normalized;
    return this;
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

  build(): JsonObject {
    const result: JsonObject = {};
    if (this.bootstrapAssigneeValue) {
      result.bootstrapAssignee = this.bootstrapAssigneeValue;
    }
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
    return result;
  }
}
