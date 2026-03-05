import { Blue, BlueNode } from '@blue-labs/language';
import {
  ContractProcessorRegistryBuilder,
  createDefaultMergingProcessor,
  type DocumentProcessingResult,
  DocumentProcessor,
} from '@blue-labs/document-processor';
import { repository } from '@blue-repository/types';
import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';
import { MarkerSchema } from '@blue-repository/types/packages/core/schemas';

export function createTestBlue(): Blue {
  return new Blue({
    repositories: [repository],
    mergingProcessor: createDefaultMergingProcessor(),
  });
}

export function createTestDocumentProcessor(
  blue = createTestBlue(),
): DocumentProcessor {
  const registry = ContractProcessorRegistryBuilder.create()
    .registerDefaults()
    .register({
      kind: 'marker',
      blueIds: [
        conversationBlueIds['Conversation/Document Section'],
        conversationBlueIds['Conversation/Contracts Change Policy'],
      ],
      schema: MarkerSchema,
    })
    .build();

  return new DocumentProcessor({
    blue,
    registry,
  });
}

export async function expectSuccess(
  result: Promise<DocumentProcessingResult>,
  message: string,
): Promise<DocumentProcessingResult> {
  const resolved = await result;
  if (resolved.capabilityFailure) {
    throw new Error(
      `${message}. failureReason=${resolved.failureReason ?? 'unknown'}`,
    );
  }
  return resolved;
}

export function operationRequestEvent(
  blue: Blue,
  options: {
    readonly operation: string;
    readonly request?: unknown;
    readonly timelineId?: string;
    readonly allowNewerVersion?: boolean;
    readonly documentBlueId?: string;
  },
): BlueNode {
  const {
    operation,
    request,
    timelineId = 'ownerChannel',
    allowNewerVersion = true,
    documentBlueId,
  } = options;

  const message: Record<string, unknown> = {
    type: 'Conversation/Operation Request',
    operation,
    allowNewerVersion,
  };
  if (request !== undefined) {
    message.request = request;
  }
  if (documentBlueId) {
    message.document = { blueId: documentBlueId };
  }

  return blue.jsonValueToNode({
    type: 'Conversation/Timeline Entry',
    timeline: { timelineId },
    message,
  });
}

export function storedDocumentBlueId(document: BlueNode): string {
  const initialized = document.get('/contracts/initialized/documentId');
  if (typeof initialized === 'string') {
    return initialized;
  }
  if (initialized instanceof BlueNode) {
    const value = initialized.getValue();
    if (typeof value === 'string') {
      return value;
    }
  }
  throw new Error('Expected initialized documentId marker after init');
}
