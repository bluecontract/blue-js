import type { JsonObject } from '../core/types.js';

export class AgencyBindingsBuilder {
  private readonly bindings: Record<string, JsonObject> = {};

  bind(
    channelKey: string,
    binding: {
      readonly accountId?: string;
      readonly timelineId?: string;
      readonly documentId?: string;
    },
  ): this {
    const key = channelKey.trim();
    if (key.length === 0) {
      throw new Error('channelKey is required');
    }
    this.bindings[key] = {
      ...(binding.accountId ? { accountId: binding.accountId } : {}),
      ...(binding.timelineId ? { timelineId: binding.timelineId } : {}),
      ...(binding.documentId ? { documentId: binding.documentId } : {}),
    };
    return this;
  }

  build(): Record<string, JsonObject> {
    return structuredClone(this.bindings);
  }
}
