import { expr } from '../expr.js';
import { resolveTypeInput } from '../internal/type-resolver.js';
import type { BlueObject, BlueTypeInput, BlueValue } from '../types.js';
import { ChangesetBuilder } from './changeset-builder.js';

export type StepsFactory =
  | ((steps: StepsBuilder) => void)
  | BlueObject[]
  | undefined;

export class StepsBuilder {
  private readonly steps: BlueObject[];

  public constructor(initial?: BlueObject[]) {
    this.steps = initial ?? [];
  }

  public jsRaw(name: string, code: string): this {
    this.steps.push({
      name,
      type: 'Conversation/JavaScript Code',
      code,
    });
    return this;
  }

  public updateDocument(
    name: string,
    changes:
      | ((changeset: ChangesetBuilder) => void)
      | BlueObject[]
      | ChangesetBuilder,
  ): this {
    let changeset: BlueObject[];
    if (changes instanceof ChangesetBuilder) {
      changeset = changes.build();
    } else if (typeof changes === 'function') {
      const builder = new ChangesetBuilder();
      changes(builder);
      changeset = builder.build();
    } else {
      changeset = changes;
    }

    this.steps.push({
      name,
      type: 'Conversation/Update Document',
      changeset,
    });
    return this;
  }

  public updateDocumentFromExpression(name: string, expression: string): this {
    this.steps.push({
      name,
      type: 'Conversation/Update Document',
      changeset: expr(expression),
    });
    return this;
  }

  public triggerEvent(name: string, event: BlueValue): this {
    this.steps.push({
      name,
      type: 'Conversation/Trigger Event',
      event,
    });
    return this;
  }

  public emit(name: string, event: BlueValue): this {
    return this.triggerEvent(name, event);
  }

  public emitType(
    name: string,
    typeInput: BlueTypeInput,
    payload?: Record<string, BlueValue>,
  ): this {
    return this.triggerEvent(name, {
      type: resolveTypeInput(typeInput) as BlueValue,
      ...(payload ?? {}),
    });
  }

  public namedEvent(
    name: string,
    eventName: string,
    payload?: Record<string, BlueValue>,
  ): this {
    return this.emitType(name, 'Conversation/Event', {
      name: eventName,
      ...(payload ? { payload } : {}),
    });
  }

  public replaceValue(name: string, path: string, value: BlueValue): this {
    return this.updateDocument(name, [{ op: 'replace', path, val: value }]);
  }

  public replaceExpression(
    name: string,
    path: string,
    expression: string,
  ): this {
    return this.updateDocument(name, [
      { op: 'replace', path, val: expr(expression) },
    ]);
  }

  public rawStep(step: BlueObject): this {
    this.steps.push(step);
    return this;
  }

  public myOs(): MyOsStepsBuilder {
    return new MyOsStepsBuilder(this);
  }

  public addAll(stepsFactory: StepsFactory): this {
    if (!stepsFactory) {
      return this;
    }
    if (typeof stepsFactory === 'function') {
      stepsFactory(this);
      return this;
    }
    this.steps.push(...stepsFactory);
    return this;
  }

  public build(): BlueObject[] {
    return this.steps;
  }
}

class MyOsStepsBuilder {
  public constructor(private readonly parent: StepsBuilder) {}

  public requestSingleDocPermission(
    onBehalfOf: string,
    requestId: string,
    targetSessionId: BlueValue,
    permissions: BlueValue,
  ): StepsBuilder {
    return this.parent.triggerEvent('RequestSingleDocPermission', {
      type: 'MyOS/Single Document Permission Grant Requested',
      onBehalfOf,
      requestId,
      targetSessionId,
      permissions,
    });
  }

  public requestLinkedDocsPermission(
    onBehalfOf: string,
    requestId: string,
    targetSessionId: BlueValue,
    links: BlueValue,
  ): StepsBuilder {
    return this.parent.triggerEvent('RequestLinkedDocsPermission', {
      type: 'MyOS/Linked Documents Permission Grant Requested',
      onBehalfOf,
      requestId,
      targetSessionId,
      links,
    });
  }

  public revokeSingleDocPermission(
    onBehalfOf: string,
    requestId: string,
    targetSessionId: BlueValue,
  ): StepsBuilder {
    return this.parent.triggerEvent('RevokeSingleDocPermission', {
      type: 'MyOS/Single Document Permission Revoke Requested',
      onBehalfOf,
      requestId,
      targetSessionId,
    });
  }

  public revokeLinkedDocsPermission(
    onBehalfOf: string,
    requestId: string,
    targetSessionId: BlueValue,
  ): StepsBuilder {
    return this.parent.triggerEvent('RevokeLinkedDocsPermission', {
      type: 'MyOS/Linked Documents Permission Revoke Requested',
      onBehalfOf,
      requestId,
      targetSessionId,
    });
  }

  public callOperation(
    onBehalfOf: string,
    targetSessionId: BlueValue,
    operation: string,
    request?: BlueValue,
  ): StepsBuilder {
    return this.parent.triggerEvent('CallOperation', {
      type: 'MyOS/Call Operation Requested',
      onBehalfOf,
      targetSessionId,
      operation,
      ...(request == null ? {} : { request }),
    });
  }

  public subscribeToSession(
    onBehalfOf: string,
    targetSessionId: BlueValue,
    subscriptionId: string,
    events: BlueValue[] = [],
  ): StepsBuilder {
    return this.parent.triggerEvent('SubscribeToSession', {
      type: 'MyOS/Subscribe to Session Requested',
      onBehalfOf,
      targetSessionId,
      subscription: {
        id: subscriptionId,
        events,
      },
    });
  }

  public addParticipant(channelName: string, email: string): StepsBuilder {
    return this.parent.triggerEvent('AddParticipant', {
      type: 'MyOS/Adding Participant Requested',
      channelName,
      email,
    });
  }

  public removeParticipant(channelName: string): StepsBuilder {
    return this.parent.triggerEvent('RemoveParticipant', {
      type: 'MyOS/Removing Participant Requested',
      channelName,
    });
  }

  public grantWorkerAgencyPermission(
    onBehalfOf: string,
    requestId: string,
    targetSessionId: BlueValue,
    permissions: BlueValue,
  ): StepsBuilder {
    return this.parent.triggerEvent('GrantWorkerAgencyPermission', {
      type: 'MyOS/Worker Agency Permission Grant Requested',
      onBehalfOf,
      requestId,
      targetSessionId,
      allowedWorkerAgencyPermissions: permissions,
    });
  }

  public revokeWorkerAgencyPermission(
    onBehalfOf: string,
    requestId: string,
    targetSessionId: BlueValue,
  ): StepsBuilder {
    return this.parent.triggerEvent('RevokeWorkerAgencyPermission', {
      type: 'MyOS/Worker Agency Permission Revoke Requested',
      onBehalfOf,
      requestId,
      targetSessionId,
    });
  }

  public startWorkerSession(
    onBehalfOf: string,
    config: BlueValue,
    initiatorChannel?: string,
  ): StepsBuilder {
    return this.parent.triggerEvent('StartWorkerSession', {
      type: 'MyOS/Start Worker Session Requested',
      onBehalfOf,
      config,
      ...(initiatorChannel ? { initiatorChannel } : {}),
    });
  }

  public bootstrapDocument(
    document: BlueValue,
    channelBindings: Record<string, string>,
    bootstrapAssignee = 'myOsAdminChannel',
  ): StepsBuilder {
    return this.parent.triggerEvent('BootstrapDocument', {
      type: 'Conversation/Document Bootstrap Requested',
      document,
      channelBindings,
      bootstrapAssignee,
    });
  }
}
