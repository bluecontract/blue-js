import { NodeObjectBuilder } from './node-object-builder.js';

export class BootstrapOptionsBuilder {
  private bootstrapAssignee?: string;
  private initialDefaultMessage?: string;
  private readonly perChannelMessages = new Map<string, string>();

  assignee(channelKey: string): this {
    const normalized = channelKey.trim();
    this.bootstrapAssignee = normalized.length > 0 ? normalized : undefined;
    return this;
  }

  defaultMessage(text: string): this {
    this.initialDefaultMessage = text;
    return this;
  }

  channelMessage(channelKey: string, text: string): this {
    const normalized = channelKey.trim();
    if (normalized.length === 0) {
      return this;
    }
    this.perChannelMessages.set(normalized, text);
    return this;
  }

  applyTo(payload: NodeObjectBuilder): void {
    if (this.bootstrapAssignee) {
      payload.put('bootstrapAssignee', this.bootstrapAssignee);
    }

    if (
      this.initialDefaultMessage !== undefined ||
      this.perChannelMessages.size > 0
    ) {
      const messages = NodeObjectBuilder.create();
      if (this.initialDefaultMessage !== undefined) {
        messages.put('defaultMessage', this.initialDefaultMessage);
      }
      if (this.perChannelMessages.size > 0) {
        messages.putStringMap('perChannel', this.perChannelMessages);
      }
      payload.putNode('initialMessages', messages.build());
    }
  }
}
