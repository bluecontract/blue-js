import { BlueNode } from '@blue-labs/language';
import { TimelineEntrySchema } from '@blue-repository/types/packages/conversation/schemas/TimelineEntry';

import {
  actorPolicyMarkerSchema,
  type ActorPolicyMarker,
  type ActorPolicyRule,
} from '../../../model/index.js';
import { conversationBlueIds } from '../../../repository/semantic-repository.js';
import type { ContractProcessorContext } from '../../types.js';

type ActorCategory = 'principal' | 'agent';
type SourceCategory = 'browserSession' | 'apiCall' | 'documentRequest';

const ACTOR_POLICY_BLUE_ID = conversationBlueIds['Conversation/Actor Policy'];
const PRINCIPAL_ACTOR_BLUE_ID =
  conversationBlueIds['Conversation/Principal Actor'];
const AGENT_ACTOR_BLUE_ID = conversationBlueIds['Conversation/Agent Actor'];
const BROWSER_SESSION_BLUE_ID =
  conversationBlueIds['Conversation/Browser Session'];
const API_CALL_BLUE_ID = conversationBlueIds['Conversation/API Call'];
const DOCUMENT_REQUEST_BLUE_ID =
  conversationBlueIds['Conversation/Document Request'];

export function matchesActorPolicyForOperation(
  operationKey: string,
  eventNode: BlueNode,
  context: ContractProcessorContext,
): boolean {
  const actorPolicy = loadActorPolicy(context);
  const rule = actorPolicy?.operations?.[operationKey];
  if (!rule) {
    return true;
  }

  const actorCategory = classifyActorCategory(eventNode, context);
  const sourceCategory = classifySourceCategory(eventNode, context);

  return actorPolicyRuleMatches(rule, actorCategory, sourceCategory);
}

function loadActorPolicy(
  context: ContractProcessorContext,
): ActorPolicyMarker | null {
  const contractsPointer = context.resolvePointer('/contracts');
  const contractsNode = context.documentAt(contractsPointer);
  const contractEntries = contractsNode?.getProperties();
  if (!contractEntries) {
    return null;
  }

  for (const contractNode of Object.values(contractEntries)) {
    if (!(contractNode instanceof BlueNode)) {
      continue;
    }
    if (!context.blue.isTypeOfBlueId(contractNode, ACTOR_POLICY_BLUE_ID)) {
      continue;
    }
    return context.blue.nodeToSchemaOutput(
      contractNode,
      actorPolicyMarkerSchema,
    );
  }

  return null;
}

function classifyActorCategory(
  eventNode: BlueNode,
  context: ContractProcessorContext,
): ActorCategory | null {
  const actorNode = timelineEntryChildNode(eventNode, 'actor', context);
  if (!actorNode) {
    return null;
  }
  if (context.blue.isTypeOfBlueId(actorNode, AGENT_ACTOR_BLUE_ID)) {
    return 'agent';
  }
  if (context.blue.isTypeOfBlueId(actorNode, PRINCIPAL_ACTOR_BLUE_ID)) {
    return 'principal';
  }
  return null;
}

function classifySourceCategory(
  eventNode: BlueNode,
  context: ContractProcessorContext,
): SourceCategory | null {
  const sourceNode = timelineEntryChildNode(eventNode, 'source', context);
  if (!sourceNode) {
    return null;
  }
  if (context.blue.isTypeOfBlueId(sourceNode, BROWSER_SESSION_BLUE_ID)) {
    return 'browserSession';
  }
  if (context.blue.isTypeOfBlueId(sourceNode, API_CALL_BLUE_ID)) {
    return 'apiCall';
  }
  if (context.blue.isTypeOfBlueId(sourceNode, DOCUMENT_REQUEST_BLUE_ID)) {
    return 'documentRequest';
  }
  return null;
}

function timelineEntryChildNode(
  eventNode: BlueNode,
  propertyKey: 'actor' | 'source',
  context: ContractProcessorContext,
): BlueNode | null {
  if (
    !context.blue.isTypeOf(eventNode, TimelineEntrySchema, {
      checkSchemaExtensions: true,
    })
  ) {
    return null;
  }

  const rawChild = eventNode.getProperties()?.[propertyKey];
  return rawChild instanceof BlueNode ? rawChild : null;
}

function actorPolicyRuleMatches(
  rule: ActorPolicyRule,
  actorCategory: ActorCategory | null,
  sourceCategory: SourceCategory | null,
): boolean {
  if (rule.requiresActor) {
    if (!actorCategory) {
      return false;
    }
    if (rule.requiresActor !== 'any' && rule.requiresActor !== actorCategory) {
      return false;
    }
  }

  if (rule.requiresSource) {
    if (!sourceCategory || rule.requiresSource !== sourceCategory) {
      return false;
    }
  }

  if (rule.excludeSource) {
    if (!sourceCategory || rule.excludeSource === sourceCategory) {
      return false;
    }
  }

  return true;
}
