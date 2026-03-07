import type { BootstrapOptionsBuilderLike } from '../types';
import { NodeObjectBuilder } from './node-object-builder';

export class BootstrapOptionsBuilder implements BootstrapOptionsBuilderLike {
  private assigneeChannel: string | null = null;
  private defaultMessageText: string | null = null;
  private readonly perChannelMessages = new Map<string, string | null>();

  assignee(channelKey: string | null | undefined): this {
    this.assigneeChannel = normalizeOptional(channelKey);
    return this;
  }

  defaultMessage(text: string | null | undefined): this {
    this.defaultMessageText = text ?? null;
    return this;
  }

  channelMessage(
    channelKey: string | null | undefined,
    text: string | null | undefined,
  ): this {
    const normalizedKey = normalizeOptional(channelKey);
    if (!normalizedKey) {
      return this;
    }

    this.perChannelMessages.set(normalizedKey, text ?? null);
    return this;
  }

  applyTo(payload: NodeObjectBuilder): void {
    if (this.assigneeChannel) {
      payload.put('bootstrapAssignee', this.assigneeChannel);
    }

    if (this.defaultMessageText == null && this.perChannelMessages.size === 0) {
      return;
    }

    const messages = NodeObjectBuilder.create();
    if (this.defaultMessageText != null) {
      messages.put('defaultMessage', this.defaultMessageText);
    }

    if (this.perChannelMessages.size > 0) {
      messages.putStringMap(
        'perChannel',
        Object.fromEntries(this.perChannelMessages.entries()),
      );
    }

    payload.putNode('initialMessages', messages.build());
  }
}

function normalizeOptional(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
