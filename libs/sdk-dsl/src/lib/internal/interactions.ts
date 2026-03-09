import { BlueNode } from '@blue-labs/language';

import type { TypeInput } from '../types';
import { resolveTypeInput } from './type-input';
import { toBlueNode } from './value-to-node';

export type PermissionTiming =
  | { readonly kind: 'onInit' }
  | { readonly kind: 'onEvent'; readonly eventType: TypeInput }
  | { readonly kind: 'onDocChange'; readonly path: string }
  | { readonly kind: 'manual' };

export interface AccessConfig {
  readonly name: string;
  readonly token: string;
  readonly targetSessionId: BlueNode;
  readonly onBehalfOfChannel: string;
  readonly requestId: string;
  readonly subscriptionId: string;
  readonly permissions: BlueNode;
  readonly statusPath: string | null;
  readonly subscribeAfterGranted: boolean;
  readonly subscriptionEvents: readonly TypeInput[];
  readonly permissionTiming: PermissionTiming;
}

export interface LinkedAccessConfig {
  readonly name: string;
  readonly token: string;
  readonly targetSessionId: BlueNode;
  readonly onBehalfOfChannel: string;
  readonly requestId: string;
  readonly subscriptionId: string;
  readonly statusPath: string | null;
  readonly links: Readonly<Record<string, BlueNode>>;
  readonly permissionTiming: PermissionTiming;
}

export interface AgencyConfig {
  readonly name: string;
  readonly token: string;
  readonly onBehalfOfChannel: string;
  readonly requestId: string;
  readonly subscriptionId: string;
  readonly targetSessionId: BlueNode | null;
  readonly allowedWorkerAgencyPermissions: readonly BlueNode[];
  readonly statusPath: string | null;
  readonly permissionTiming: PermissionTiming;
}

export interface AINamedEventExpectationField {
  readonly name: string;
  readonly description: string | null;
}

export interface AINamedEventExpectation {
  readonly name: string;
  readonly fields: readonly AINamedEventExpectationField[];
}

export interface AITaskTemplate {
  readonly name: string;
  readonly instructions: readonly string[];
  readonly expectedResponses: readonly BlueNode[];
  readonly expectedNamedEvents: readonly AINamedEventExpectation[];
}

export interface AIIntegrationConfig {
  readonly name: string;
  readonly token: string;
  readonly sessionId: BlueNode;
  readonly permissionFromChannel: string;
  readonly statusPath: string;
  readonly contextPath: string;
  readonly requesterId: string;
  readonly requestId: string;
  readonly subscriptionId: string;
  readonly permissionTiming: PermissionTiming;
  readonly tasks: ReadonlyMap<string, AITaskTemplate>;
}

export interface InteractionConfigRegistry {
  readonly accessConfigs: ReadonlyMap<string, AccessConfig>;
  readonly linkedAccessConfigs: ReadonlyMap<string, LinkedAccessConfig>;
  readonly agencyConfigs: ReadonlyMap<string, AgencyConfig>;
  readonly aiConfigs: ReadonlyMap<string, AIIntegrationConfig>;
}

const EMPTY_MAP = new Map();

export const EMPTY_INTERACTION_CONFIG_REGISTRY: InteractionConfigRegistry = {
  accessConfigs: EMPTY_MAP,
  linkedAccessConfigs: EMPTY_MAP,
  agencyConfigs: EMPTY_MAP,
  aiConfigs: EMPTY_MAP,
};

export function tokenOf(
  input: string | null | undefined,
  fallback: string,
): string {
  if (!input) {
    return fallback;
  }

  let token = '';
  for (const char of input) {
    if (/^[a-z0-9]$/i.test(char)) {
      token += char.toUpperCase();
    }
  }

  return token.length === 0 ? fallback : token;
}

export function normalizeStringList(
  values: readonly (string | null | undefined)[],
): string[] {
  const normalized: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim() ?? '';
    if (trimmed.length > 0) {
      normalized.push(trimmed);
    }
  }
  return normalized;
}

export function createSingleDocumentPermissionSet(
  options: {
    readonly read?: boolean;
    readonly share?: boolean;
    readonly allOps?: boolean;
    readonly operations?: readonly string[];
  } = {},
): BlueNode {
  const permissionSet = new BlueNode().setType(
    resolveTypeInput('MyOS/Single Document Permission Set'),
  );

  return applyPermissionFlags(permissionSet, options);
}

export function createLinkedDocumentsPermissionSet(
  links: Readonly<Record<string, BlueNode>>,
): BlueNode {
  const linkedSet = new BlueNode().setType(
    resolveTypeInput('MyOS/Linked Documents Permission Set'),
  );

  for (const [anchorKey, permissionNode] of Object.entries(links)) {
    linkedSet.addProperty(anchorKey, permissionNode.clone());
  }

  return linkedSet;
}

export function createPermissionFlagsNode(
  options: {
    readonly read?: boolean;
    readonly share?: boolean;
    readonly allOps?: boolean;
    readonly operations?: readonly string[];
  } = {},
): BlueNode {
  return applyPermissionFlags(new BlueNode(), options);
}

export function createWorkerAgencyPermissionList(options: {
  readonly allowedTypes?: readonly TypeInput[];
  readonly allowedOperations?: readonly string[];
}): BlueNode[] {
  const operations = normalizeStringList(options.allowedOperations ?? []);
  const permissionSet =
    operations.length > 0
      ? createSingleDocumentPermissionSet({
          operations,
        })
      : null;

  const normalizedTypes = (options.allowedTypes ?? []).filter(
    (typeInput): typeInput is TypeInput => typeInput != null,
  );

  if (normalizedTypes.length === 0) {
    if (!permissionSet) {
      return [];
    }

    return [
      new BlueNode()
        .setType(resolveTypeInput('MyOS/Worker Agency Permission'))
        .addProperty('permissions', permissionSet),
    ];
  }

  return normalizedTypes.map((allowedType) => {
    const permission = new BlueNode().setType(
      resolveTypeInput('MyOS/Worker Agency Permission'),
    );
    permission.addProperty(
      'workerType',
      new BlueNode().setType(resolveTypeInput(allowedType)),
    );
    if (permissionSet) {
      permission.addProperty('permissions', permissionSet.clone());
    }
    return permission;
  });
}

function applyPermissionFlags(
  node: BlueNode,
  options: {
    readonly read?: boolean;
    readonly share?: boolean;
    readonly allOps?: boolean;
    readonly operations?: readonly string[];
  },
): BlueNode {
  if (options.read === true) {
    node.addProperty('read', toBlueNode(true));
  }

  if (options.share === true) {
    node.addProperty('share', toBlueNode(true));
  }

  if (options.allOps === true) {
    node.addProperty('allOps', toBlueNode(true));
  }

  const operations = normalizeStringList(options.operations ?? []);
  if (operations.length > 0) {
    node.addProperty(
      'singleOps',
      new BlueNode().setItems(
        operations.map((operation) => toBlueNode(operation)),
      ),
    );
  }

  return node;
}
