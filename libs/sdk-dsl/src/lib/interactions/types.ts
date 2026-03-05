export interface AccessConfig {
  readonly name: string;
  readonly permissionFrom: string;
  readonly targetSessionId: string;
  readonly requestId: string;
  readonly subscriptionId: string;
}

export interface LinkedAccessConfig {
  readonly name: string;
  readonly permissionFrom: string;
  readonly targetSessionId: string;
  readonly requestId: string;
}

export interface AgencyConfig {
  readonly name: string;
  readonly permissionFrom: string;
  readonly requestId: string;
  readonly targetSessionId?: string;
}

export interface AccessConfigRegistrationHost<P> {
  registerAccessConfig(config: AccessConfig): P;
}

export interface LinkedAccessConfigRegistrationHost<P> {
  registerLinkedAccessConfig(config: LinkedAccessConfig): P;
}

export interface AgencyConfigRegistrationHost<P> {
  registerAgencyConfig(config: AgencyConfig): P;
}
