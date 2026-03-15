import { toTypeAlias, type TypeLike } from '../core/type-alias.js';

export type PermissionTiming = 'onInit' | 'onEvent' | 'onDocChange' | 'manual';

export interface AITaskTemplate {
  readonly name: string;
  readonly instructions: readonly string[];
  readonly expectedResponses: readonly string[];
}

export interface AIIntegrationConfig {
  readonly name: string;
  readonly sessionId: string;
  readonly permissionFrom: string;
  readonly statusPath: string;
  readonly contextPath: string;
  readonly requesterId: string;
  readonly requestId: string;
  readonly subscriptionId: string;
  readonly permissionTiming: PermissionTiming;
  readonly permissionTriggerEventType?: string;
  readonly permissionTriggerDocPath?: string;
  readonly tasks: Readonly<Record<string, AITaskTemplate>>;
}

export interface AiIntegrationDefinition {
  name: string;
  sessionId?: string;
  permissionFrom?: string;
  statusPath: string;
  contextPath: string;
  requesterId: string;
  requestId: string;
  subscriptionId: string;
  permissionTiming: PermissionTiming;
  permissionTriggerEventType?: string;
  permissionTriggerDocPath?: string;
  tasks: Record<string, AITaskTemplate>;
}

export interface AiIntegrationRegistrationHost<P> {
  registerAiIntegration(definition: AiIntegrationDefinition): P;
}

export function normalizeTypeLike(typeLike: TypeLike): string {
  return toTypeAlias(typeLike);
}
