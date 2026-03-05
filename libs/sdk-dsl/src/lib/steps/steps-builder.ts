import { ensureExpression } from '../core/serialization.js';
import { toTypeAlias, type TypeLike } from '../core/type-alias.js';
import type { JsonObject, JsonValue } from '../core/types.js';

export class ChangesetBuilder {
  private readonly entries: JsonObject[] = [];

  replaceValue(path: string, value: JsonValue): this {
    this.entries.push({ op: 'replace', path, val: value });
    return this;
  }

  replaceExpression(path: string, expression: string): this {
    this.entries.push({
      op: 'replace',
      path,
      val: ensureExpression(expression),
    });
    return this;
  }

  addValue(path: string, value: JsonValue): this {
    this.entries.push({ op: 'add', path, val: value });
    return this;
  }

  remove(path: string): this {
    this.entries.push({ op: 'remove', path });
    return this;
  }

  build(): JsonObject[] {
    return structuredClone(this.entries);
  }
}

export class EventPayloadBuilder {
  private readonly payload: JsonObject = {};

  put(key: string, value: JsonValue): this {
    this.payload[key] = value;
    return this;
  }

  putExpression(key: string, expression: string): this {
    this.payload[key] = ensureExpression(expression);
    return this;
  }

  build(): JsonObject {
    return structuredClone(this.payload);
  }
}

function requireStepName(name: string): string {
  const normalized = name.trim();
  if (normalized.length === 0) {
    throw new Error('step name is required');
  }
  return normalized;
}

function step(name: string, type: string, extra: JsonObject): JsonObject {
  return { name: requireStepName(name), type, ...extra };
}

export class StepsBuilder {
  private readonly steps: JsonObject[] = [];

  jsRaw(name: string, code: string): this {
    this.steps.push(step(name, 'Conversation/JavaScript Code', { code }));
    return this;
  }

  updateDocument(
    name: string,
    customizer: (changeset: ChangesetBuilder) => void,
  ): this {
    const builder = new ChangesetBuilder();
    customizer(builder);
    this.steps.push(
      step(name, 'Conversation/Update Document', {
        changeset: builder.build(),
      }),
    );
    return this;
  }

  updateDocumentFromExpression(name: string, expression: string): this {
    this.steps.push(
      step(name, 'Conversation/Update Document', {
        changeset: ensureExpression(expression),
      }),
    );
    return this;
  }

  triggerEvent(name: string, event: JsonObject): this {
    this.steps.push(step(name, 'Conversation/Trigger Event', { event }));
    return this;
  }

  emit(name: string, event: JsonObject): this {
    return this.triggerEvent(name, event);
  }

  emitType(
    name: string,
    eventType: TypeLike,
    payloadCustomizer?: (payload: EventPayloadBuilder) => void,
  ): this {
    const payload = new EventPayloadBuilder();
    payloadCustomizer?.(payload);
    this.steps.push(
      step(name, 'Conversation/Trigger Event', {
        event: {
          type: toTypeAlias(eventType),
          ...payload.build(),
        },
      }),
    );
    return this;
  }

  namedEvent(
    name: string,
    eventName: string,
    payloadCustomizer?: (payload: EventPayloadBuilder) => void,
  ): this {
    const payload = new EventPayloadBuilder();
    payloadCustomizer?.(payload);
    const payloadObject = payload.build();
    this.steps.push(
      step(name, 'Conversation/Trigger Event', {
        event: {
          type: 'Common/Named Event',
          name: eventName,
          ...(Object.keys(payloadObject).length > 0
            ? { payload: payloadObject }
            : {}),
        },
      }),
    );
    return this;
  }

  replaceValue(name: string, path: string, value: JsonValue): this {
    return this.updateDocument(name, (changeset) =>
      changeset.replaceValue(path, value),
    );
  }

  replaceExpression(name: string, path: string, expression: string): this {
    return this.updateDocument(name, (changeset) =>
      changeset.replaceExpression(path, expression),
    );
  }

  raw(stepNode: JsonObject): this {
    this.steps.push(structuredClone(stepNode));
    return this;
  }

  build(): JsonObject[] {
    return structuredClone(this.steps);
  }
}
