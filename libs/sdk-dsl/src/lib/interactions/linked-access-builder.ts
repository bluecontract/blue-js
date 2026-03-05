import type {
  LinkedAccessConfig,
  LinkedAccessConfigRegistrationHost,
} from './types.js';

function requireText(value: string | undefined, field: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${field} is required`);
  }
  return normalized;
}

function token(name: string): string {
  return name
    .replace(/[^A-Za-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .toUpperCase();
}

export class LinkedAccessBuilder<P> {
  private permissionFromValue = 'ownerChannel';
  private targetSessionIdValue: string | undefined;
  private requestIdValue: string | undefined;

  constructor(
    private readonly parent: LinkedAccessConfigRegistrationHost<P>,
    private readonly name: string,
  ) {}

  permissionFrom(channelKey: string): this {
    this.permissionFromValue = requireText(channelKey, 'permissionFrom');
    return this;
  }

  targetSessionId(sessionId: string): this {
    this.targetSessionIdValue = requireText(sessionId, 'targetSessionId');
    return this;
  }

  requestId(requestId: string): this {
    this.requestIdValue = requireText(requestId, 'requestId');
    return this;
  }

  done(): P {
    const baseToken = token(this.name);
    const config: LinkedAccessConfig = {
      name: this.name,
      permissionFrom: this.permissionFromValue,
      targetSessionId: requireText(
        this.targetSessionIdValue,
        'targetSessionId',
      ),
      requestId: this.requestIdValue ?? `REQ_LINKED_${baseToken}`,
    };
    return this.parent.registerLinkedAccessConfig(config);
  }
}
