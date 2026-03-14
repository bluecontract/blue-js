import { Blue } from '@blue-labs/language';
import {
  createDefaultMergingProcessor,
  DocumentProcessor,
  type DocumentProcessingResult,
} from '@blue-labs/document-processor';
import { repository } from '@blue-repository/types';
import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';
import { ContractsChangePolicySchema } from '@blue-repository/types/packages/conversation/schemas/ContractsChangePolicy';
import { DocumentSectionSchema } from '@blue-repository/types/packages/conversation/schemas/DocumentSection';

export const getBlue = (): Blue =>
  new Blue({
    repositories: [repository],
    mergingProcessor: createDefaultMergingProcessor(),
  });

export const getBlueDocumentProcessor = (blue: Blue): DocumentProcessor => {
  const processor = new DocumentProcessor({ blue });
  processor.registerContractProcessor({
    kind: 'marker',
    blueIds: [conversationBlueIds['Conversation/Document Section']],
    schema: DocumentSectionSchema,
  });
  processor.registerContractProcessor({
    kind: 'marker',
    blueIds: [conversationBlueIds['Conversation/Contracts Change Policy']],
    schema: ContractsChangePolicySchema,
  });
  return processor;
};

export const expectOk = async (
  result: Promise<DocumentProcessingResult> | DocumentProcessingResult,
): Promise<DocumentProcessingResult> => {
  const resolved = await result;
  if (resolved.capabilityFailure) {
    throw new Error(
      `Expected successful processing, got failure: ${resolved.failureReason ?? 'unknown'}`,
    );
  }
  return resolved;
};

export const makeTimelineEntryYaml = (
  timelineId: string,
  messageYaml: string,
): string => `type: Conversation/Timeline Entry
timeline:
  timelineId: ${timelineId}
message:
${messageYaml
  .split('\n')
  .filter((line) => line.length > 0)
  .map((line) => `  ${line}`)
  .join('\n')}
actor:
  name: SDK Test
timestamp: 1700000000
`;
