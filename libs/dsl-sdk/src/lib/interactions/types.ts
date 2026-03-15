export type InteractionPermissionTiming =
  | 'onInit'
  | 'onEvent'
  | 'onDocChange'
  | 'manual';

export interface AccessConfig {
  readonly name: string;
  readonly token: string;
  readonly targetSessionId: string;
  readonly onBehalfOf: string;
  readonly requestId: string;
  readonly subscriptionId: string;
  readonly read: boolean;
  readonly operations: readonly string[];
  readonly statusPath?: string;
  readonly subscribeAfterGranted: boolean;
  readonly subscriptionEvents: readonly string[];
  readonly subscribeToCreatedSessions: boolean;
  readonly permissionTiming: InteractionPermissionTiming;
  readonly permissionTriggerEventType?: string;
  readonly permissionTriggerDocPath?: string;
  readonly permissionFrom?: string;
}

export interface LinkedAccessLinkConfig {
  readonly read: boolean;
  readonly operations: readonly string[];
}

export interface LinkedAccessConfig {
  readonly name: string;
  readonly token: string;
  readonly targetSessionId: string;
  readonly onBehalfOf: string;
  readonly requestId: string;
  readonly statusPath?: string;
  readonly links: Readonly<Record<string, LinkedAccessLinkConfig>>;
  readonly permissionTiming: InteractionPermissionTiming;
  readonly permissionTriggerEventType?: string;
  readonly permissionTriggerDocPath?: string;
  readonly permissionFrom?: string;
  readonly subscriptionId?: string;
  readonly subscriptionEvents?: readonly string[];
}

export interface AgencyConfig {
  readonly name: string;
  readonly token: string;
  readonly onBehalfOf: string;
  readonly requestId: string;
  readonly allowedTypes: readonly string[];
  readonly allowedOperations: readonly string[];
  readonly statusPath?: string;
  readonly permissionTiming: InteractionPermissionTiming;
  readonly permissionTriggerEventType?: string;
  readonly permissionTriggerDocPath?: string;
  readonly permissionFrom?: string;
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
