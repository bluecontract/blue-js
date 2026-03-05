import type { AgencyConfig, AgencyConfigRegistrationHost } from './types.js';

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

export class AgencyBuilder<P> {
  private permissionFromValue = 'ownerChannel';
  private requestIdValue: string | undefined;
  private targetSessionIdValue: string | undefined;

  constructor(
    private readonly parent: AgencyConfigRegistrationHost<P>,
    private readonly name: string,
  ) {}

  permissionFrom(channelKey: string): this {
    this.permissionFromValue = requireText(channelKey, 'permissionFrom');
    return this;
  }

  requestId(requestId: string): this {
    this.requestIdValue = requireText(requestId, 'requestId');
    return this;
  }

  targetSessionId(targetSessionId: string): this {
    this.targetSessionIdValue = requireText(targetSessionId, 'targetSessionId');
    return this;
  }

  done(): P {
    const baseToken = token(this.name);
    const config: AgencyConfig = {
      name: this.name,
      permissionFrom: this.permissionFromValue,
      requestId: this.requestIdValue ?? `REQ_AGENCY_${baseToken}`,
      ...(this.targetSessionIdValue
        ? { targetSessionId: this.targetSessionIdValue }
        : {}),
    };
    return this.parent.registerAgencyConfig(config);
  }
}
