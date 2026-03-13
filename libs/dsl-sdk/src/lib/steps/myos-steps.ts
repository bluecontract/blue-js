import { toTypeAlias, type TypeLike } from '../core/type-alias.js';
import type { JsonObject, JsonValue } from '../core/types.js';
import {
  MyOsPermissions,
  normalizeMyOsPermissionObject,
} from './myos-permissions.js';
import type { EventPayloadBuilder, StepsBuilder } from './steps-builder.js';

function requireText(value: unknown, message: string): string {
  if (typeof value !== 'string') {
    throw new Error(message);
  }
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

function toPermissionValue(
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
    return normalizeMyOsPermissionObject(value as JsonObject);
  }
  return value;
}

function putOnBehalfOf(
  payload: EventPayloadBuilder,
  onBehalfOf: string,
  targetSessionId?: JsonValue,
): void {
  payload.put('onBehalfOf', requireText(onBehalfOf, 'onBehalfOf is required'));
  putTargetSessionId(payload, targetSessionId);
}

function putTargetSessionId(
  payload: EventPayloadBuilder,
  targetSessionId?: JsonValue,
): void {
  if (targetSessionId !== undefined) {
    payload.put('targetSessionId', toNodeValue(targetSessionId));
  }
}

function toSubscriptionMatcher(
  eventMatcher: JsonObject | TypeLike,
): JsonObject {
  if (typeof eventMatcher === 'string' || typeof eventMatcher === 'function') {
    return { type: toTypeAlias(eventMatcher as TypeLike) };
  }

  if (
    typeof eventMatcher === 'object' &&
    eventMatcher !== null &&
    !Array.isArray(eventMatcher)
  ) {
    const matcherRecord = structuredClone(eventMatcher) as Record<
      string,
      unknown
    >;
    if (
      Object.prototype.hasOwnProperty.call(matcherRecord, 'type') ||
      Object.keys(matcherRecord).some((key) => key !== 'name')
    ) {
      const matcherType = matcherRecord.type;
      if (matcherType === undefined) {
        return matcherRecord as JsonObject;
      }
      return {
        ...(matcherRecord as JsonObject),
        type:
          typeof matcherType === 'string'
            ? matcherType
            : toTypeAlias(matcherType as TypeLike),
      };
    }
  }

  return { type: toTypeAlias(eventMatcher as TypeLike) };
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
        payload.put('permissions', toPermissionValue(permissions, true));
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
          linksObject[normalizedKey] = toPermissionValue(value, true);
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

  addParticipant(
    channelName: string,
    participantBindingOrEmail: JsonObject | string,
  ): StepsBuilder {
    return this.parent.emitType(
      'AddParticipant',
      'MyOS/Adding Participant Requested',
      (payload) => {
        payload.put(
          'channelName',
          requireText(channelName, 'channelName is required'),
        );
        if (typeof participantBindingOrEmail === 'string') {
          payload.put('participantBinding', {
            email: requireText(
              participantBindingOrEmail,
              'email binding is required',
            ),
          });
          return;
        }
        payload.put(
          'participantBinding',
          toNodeValue(participantBindingOrEmail),
        );
      },
    );
  }

  removeParticipant(channelName: string): StepsBuilder {
    return this.parent.emitType(
      'RemoveParticipant',
      'MyOS/Removing Participant Requested',
      (payload) => {
        payload.put(
          'channelName',
          requireText(channelName, 'channelName is required'),
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
    targetSessionId: JsonValue,
    subscriptionId: string,
    ...eventTypes: TypeLike[]
  ): StepsBuilder {
    return this.parent.emitType(
      'SubscribeToSession',
      'MyOS/Subscribe to Session Requested',
      (payload) => {
        putTargetSessionId(payload, targetSessionId);
        payload.put('subscription', {
          id: requireText(subscriptionId, 'subscriptionId is required'),
          events: eventTypes.map((typeRef) => ({ type: toTypeAlias(typeRef) })),
        });
      },
    );
  }

  subscribeToSessionWithMatchers(
    targetSessionId: JsonValue,
    subscriptionId: string,
    eventMatchers: Array<TypeLike | JsonObject>,
  ): StepsBuilder {
    return this.parent.emitType(
      'SubscribeToSession',
      'MyOS/Subscribe to Session Requested',
      (payload) => {
        putTargetSessionId(payload, targetSessionId);
        payload.put('subscription', {
          id: requireText(subscriptionId, 'subscriptionId is required'),
          events: eventMatchers.map((eventMatcher) =>
            toSubscriptionMatcher(eventMatcher),
          ),
        });
      },
    );
  }

  startWorkerSession(
    onBehalfOf: string,
    document: JsonObject,
    channelBindings?: Record<string, JsonObject>,
    options?: JsonObject,
  ): StepsBuilder {
    return this.parent.emitType(
      'StartWorkerSession',
      'MyOS/Start Worker Session Requested',
      (payload) => {
        payload.put(
          'onBehalfOf',
          requireText(onBehalfOf, 'onBehalfOf is required'),
        );
        payload.put('document', structuredClone(document));
        if (channelBindings && Object.keys(channelBindings).length > 0) {
          payload.put('channelBindings', structuredClone(channelBindings));
        }
        if (options && Object.keys(options).length > 0) {
          const normalizedOptions = structuredClone(options);
          if (
            Object.prototype.hasOwnProperty.call(
              normalizedOptions,
              'bootstrapAssignee',
            )
          ) {
            throw new Error(
              'MyOS/Start Worker Session Requested does not support bootstrapAssignee; use onBehalfOf plus initialMessages/capabilities',
            );
          }
          const initialMessages = normalizedOptions.initialMessages as
            | JsonValue
            | undefined;
          const capabilities = normalizedOptions.capabilities as
            | JsonValue
            | undefined;
          if (initialMessages !== undefined) {
            payload.put('initialMessages', initialMessages);
          }
          if (capabilities !== undefined) {
            payload.put('capabilities', capabilities);
          }
        }
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
    channelBindings: Record<string, JsonObject>,
    onBehalfOf: string,
    options?: (payload: EventPayloadBuilder) => void,
  ): StepsBuilder {
    return this.parent.bootstrapDocument(
      stepName,
      document,
      channelBindings,
      onBehalfOf,
      (payload) => {
        payload.put('bootstrapAssignee', this.adminChannelKey);
        options?.(payload);
      },
    );
  }
}
