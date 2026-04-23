import { BlueNode } from '@blue-labs/language';
import { z } from 'zod';

import { ActorPolicySchema as RepositoryActorPolicySchema } from '@blue-repository/types/packages/conversation/schemas/ActorPolicy';

import { markerContractBaseSchema } from '../shared/index.js';

const ACTOR_POLICY_ACTOR_VALUES = ['principal', 'agent', 'any'] as const;
const ACTOR_POLICY_SOURCE_VALUES = [
  'browserSession',
  'apiCall',
  'documentRequest',
] as const;

const actorPolicyActorValueSchema = z.enum(ACTOR_POLICY_ACTOR_VALUES);
const actorPolicySourceValueSchema = z.enum(ACTOR_POLICY_SOURCE_VALUES);

export const actorPolicyRuleSchema = z.object({
  excludeSource: actorPolicySourceValueSchema.optional(),
  requiresActor: actorPolicyActorValueSchema.optional(),
  requiresSource: actorPolicySourceValueSchema.optional(),
});

export const actorPolicyMarkerSchema = RepositoryActorPolicySchema.merge(
  markerContractBaseSchema,
).extend({
  operations: z.record(z.string(), actorPolicyRuleSchema).optional(),
});

export type ActorPolicyRule = z.infer<typeof actorPolicyRuleSchema>;
export type ActorPolicyMarker = z.infer<typeof actorPolicyMarkerSchema>;

const VALID_ACTOR_POLICY_ACTORS = new Set<string>(ACTOR_POLICY_ACTOR_VALUES);
const VALID_ACTOR_POLICY_SOURCES = new Set<string>(ACTOR_POLICY_SOURCE_VALUES);

export class ActorPolicyLiteralValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActorPolicyLiteralValidationError';
  }
}

export function validateActorPolicyNode(node: BlueNode): void {
  const operationsNode = node.getProperties()?.operations;
  if (!(operationsNode instanceof BlueNode)) {
    return;
  }

  const operationEntries = operationsNode.getProperties();
  if (!operationEntries) {
    return;
  }

  for (const [operationKey, ruleNode] of Object.entries(operationEntries)) {
    if (!(ruleNode instanceof BlueNode)) {
      continue;
    }
    const ruleEntries = ruleNode.getProperties();
    if (!ruleEntries) {
      continue;
    }

    validateActorPolicyField(
      operationKey,
      'requiresActor',
      ruleEntries.requiresActor,
      VALID_ACTOR_POLICY_ACTORS,
    );
    validateActorPolicyField(
      operationKey,
      'requiresSource',
      ruleEntries.requiresSource,
      VALID_ACTOR_POLICY_SOURCES,
    );
    validateActorPolicyField(
      operationKey,
      'excludeSource',
      ruleEntries.excludeSource,
      VALID_ACTOR_POLICY_SOURCES,
    );
  }
}

function validateActorPolicyField(
  operationKey: string,
  fieldName: 'excludeSource' | 'requiresActor' | 'requiresSource',
  node: BlueNode | undefined,
  allowedValues: ReadonlySet<string>,
): void {
  if (!(node instanceof BlueNode)) {
    return;
  }

  const rawValue = node.getValue();
  if (rawValue == null) {
    return;
  }

  if (typeof rawValue !== 'string' || !allowedValues.has(rawValue)) {
    throw new ActorPolicyLiteralValidationError(
      `Actor Policy operation '${operationKey}' declares unsupported ${fieldName} '${String(
        rawValue,
      )}'`,
    );
  }
}
