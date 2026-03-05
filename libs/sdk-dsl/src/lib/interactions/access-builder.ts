import type { AccessConfig, AccessConfigRegistrationHost } from './types.js';

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

export class AccessBuilder<P> {
  private permissionFromValue = 'ownerChannel';
  private targetSessionIdValue: string | undefined;
  private requestIdValue: string | undefined;
  private subscriptionIdValue: string | undefined;

  constructor(
    private readonly parent: AccessConfigRegistrationHost<P>,
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

  subscriptionId(subscriptionId: string): this {
    this.subscriptionIdValue = requireText(subscriptionId, 'subscriptionId');
    return this;
  }

  done(): P {
    const baseToken = token(this.name);
    const config: AccessConfig = {
      name: this.name,
      permissionFrom: this.permissionFromValue,
      targetSessionId: requireText(
        this.targetSessionIdValue,
        'targetSessionId',
      ),
      requestId: this.requestIdValue ?? `REQ_ACCESS_${baseToken}`,
      subscriptionId: this.subscriptionIdValue ?? `SUB_ACCESS_${baseToken}`,
    };
    return this.parent.registerAccessConfig(config);
  }
}
