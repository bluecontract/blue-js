import { toTypeAlias, type TypeLike } from '../core/type-alias.js';
import type { JsonObject, JsonValue } from '../core/types.js';
import { MyOsPermissions } from './myos-permissions.js';
import type { EventPayloadBuilder, StepsBuilder } from './steps-builder.js';

function requireText(value: string, message: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(message);
  }
  return normalized;
}

function toNodeValue(
  value: JsonValue | MyOsPermissions | JsonObject | null | undefined,
  defaultToPermissions = false,
): JsonValue {
  if (value === null || value === undefined) {
    return defaultToPermissions ? MyOsPermissions.create().build() : null;
  }
  if (value instanceof MyOsPermissions) {
    return value.build();
  }
  if (typeof value === 'object') {
    return structuredClone(value as JsonObject);
  }
  return value;
}

function putOnBehalfOf(
  payload: EventPayloadBuilder,
  onBehalfOf: string,
  targetSessionId?: JsonValue,
): void {
  payload.put('onBehalfOf', requireText(onBehalfOf, 'onBehalfOf is required'));
  if (targetSessionId !== undefined) {
    payload.put('targetSessionId', toNodeValue(targetSessionId));
  }
}

export class MyOsSteps {
  constructor(
    private readonly parent: StepsBuilder,
    private readonly adminChannelKey = 'myOsAdminChannel',
  ) {}

  requestSingleDocPermission(
    onBehalfOf: string,
    requestId: string,
    targetSessionId: JsonValue,
    permissions: JsonValue | MyOsPermissions | JsonObject,
    grantSessionSubscriptionOnResult = false,
  ): StepsBuilder {
    return this.parent.emitType(
      'RequestSingleDocumentPermission',
      'MyOS/Single Document Permission Grant Requested',
      (payload) => {
        putOnBehalfOf(payload, onBehalfOf, targetSessionId);
        payload.put(
          'requestId',
          requireText(requestId, 'requestId is required'),
        );
        payload.put('permissions', toNodeValue(permissions, true));
        if (grantSessionSubscriptionOnResult) {
          payload.put('grantSessionSubscriptionOnResult', true);
        }
      },
    );
  }

  requestLinkedDocsPermission(
    onBehalfOf: string,
    requestId: string,
    targetSessionId: JsonValue,
    links: Record<string, JsonValue | JsonObject | MyOsPermissions>,
  ): StepsBuilder {
    return this.parent.emitType(
      'RequestLinkedDocumentsPermission',
      'MyOS/Linked Documents Permission Grant Requested',
      (payload) => {
        putOnBehalfOf(payload, onBehalfOf, targetSessionId);
        payload.put(
          'requestId',
          requireText(requestId, 'requestId is required'),
        );
        const linksObject: JsonObject = {};
        for (const [key, value] of Object.entries(links)) {
          const normalizedKey = key.trim();
          if (normalizedKey.length === 0) {
            continue;
          }
          linksObject[normalizedKey] = toNodeValue(value, true);
        }
        payload.put('links', linksObject);
      },
    );
  }

  revokeSingleDocPermission(
    onBehalfOf: string,
    requestId: string,
    targetSessionId: JsonValue,
  ): StepsBuilder {
    return this.parent.emitType(
      'RevokeSingleDocumentPermission',
      'MyOS/Single Document Permission Revoke Requested',
      (payload) => {
        putOnBehalfOf(payload, onBehalfOf, targetSessionId);
        payload.put(
          'requestId',
          requireText(requestId, 'requestId is required'),
        );
      },
    );
  }

  revokeLinkedDocsPermission(
    onBehalfOf: string,
    requestId: string,
    targetSessionId: JsonValue,
  ): StepsBuilder {
    return this.parent.emitType(
      'RevokeLinkedDocumentsPermission',
      'MyOS/Linked Documents Permission Revoke Requested',
      (payload) => {
        putOnBehalfOf(payload, onBehalfOf, targetSessionId);
        payload.put(
          'requestId',
          requireText(requestId, 'requestId is required'),
        );
      },
    );
  }

  addParticipant(channelKey: string, email: string): StepsBuilder {
    return this.parent.emitType(
      'AddParticipant',
      'MyOS/Adding Participant Requested',
      (payload) => {
        payload.put(
          'channelKey',
          requireText(channelKey, 'channelKey is required'),
        );
        payload.put('email', requireText(email, 'email is required'));
      },
    );
  }

  removeParticipant(channelKey: string): StepsBuilder {
    return this.parent.emitType(
      'RemoveParticipant',
      'MyOS/Removing Participant Requested',
      (payload) => {
        payload.put(
          'channelKey',
          requireText(channelKey, 'channelKey is required'),
        );
      },
    );
  }

  callOperation(
    onBehalfOf: string,
    targetSessionId: JsonValue,
    operation: string,
    request?: JsonValue,
  ): StepsBuilder {
    return this.parent.emitType(
      'CallOperation',
      'MyOS/Call Operation Requested',
      (payload) => {
        putOnBehalfOf(payload, onBehalfOf, targetSessionId);
        payload.put(
          'operation',
          requireText(operation, 'operation is required'),
        );
        if (request !== undefined) {
          payload.put('request', request);
        }
      },
    );
  }

  subscribeToSession(
    onBehalfOf: string,
    targetSessionId: JsonValue,
    subscriptionId: string,
    ...eventTypes: TypeLike[]
  ): StepsBuilder {
    return this.parent.emitType(
      'SubscribeToSession',
      'MyOS/Subscribe to Session Requested',
      (payload) => {
        putOnBehalfOf(payload, onBehalfOf, targetSessionId);
        payload.put('subscription', {
          id: requireText(subscriptionId, 'subscriptionId is required'),
          events: eventTypes.map((typeRef) => ({ type: toTypeAlias(typeRef) })),
        });
      },
    );
  }

  startWorkerSession(
    agentChannelKey: string,
    document: JsonObject,
  ): StepsBuilder {
    return this.parent.emitType(
      'StartWorkerSession',
      'MyOS/Start Worker Session Requested',
      (payload) => {
        payload.put(
          'agentChannelKey',
          requireText(agentChannelKey, 'agentChannelKey is required'),
        );
        payload.put('document', structuredClone(document));
      },
    );
  }

  grantWorkerAgencyPermission(
    onBehalfOf: string,
    requestId: string,
    workerAgencyPermissions: JsonValue | JsonObject,
    targetSessionId?: JsonValue,
  ): StepsBuilder {
    return this.parent.emitType(
      'GrantWorkerAgencyPermission',
      'MyOS/Worker Agency Permission Grant Requested',
      (payload) => {
        putOnBehalfOf(payload, onBehalfOf, targetSessionId);
        payload.put(
          'requestId',
          requireText(requestId, 'requestId is required'),
        );
        payload.put(
          'workerAgencyPermissions',
          toNodeValue(workerAgencyPermissions),
        );
      },
    );
  }

  revokeWorkerAgencyPermission(
    onBehalfOf: string,
    requestId: string,
    targetSessionId?: JsonValue,
  ): StepsBuilder {
    return this.parent.emitType(
      'RevokeWorkerAgencyPermission',
      'MyOS/Worker Agency Permission Revoke Requested',
      (payload) => {
        putOnBehalfOf(payload, onBehalfOf, targetSessionId);
        payload.put(
          'requestId',
          requireText(requestId, 'requestId is required'),
        );
      },
    );
  }

  bootstrapDocument(
    stepName: string,
    document: JsonObject,
    channelBindings: Record<string, string>,
    options?: (payload: EventPayloadBuilder) => void,
  ): StepsBuilder {
    return this.parent.bootstrapDocument(
      stepName,
      document,
      channelBindings,
      (payload) => {
        payload.put('bootstrapAssignee', this.adminChannelKey);
        options?.(payload);
      },
    );
  }
}
