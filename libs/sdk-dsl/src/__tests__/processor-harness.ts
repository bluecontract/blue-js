import { Blue, BlueNode, type BlueRepository } from '@blue-labs/language';
import {
  ContractProcessorRegistryBuilder,
  DocumentProcessor,
  type MarkerProcessor,
} from '@blue-labs/document-processor';
import { repository as blueRepository } from '@blue-repository/types';
import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';
import { ContractsChangePolicySchema } from '@blue-repository/types/packages/conversation/schemas/ContractsChangePolicy';
import { DocumentSectionSchema } from '@blue-repository/types/packages/conversation/schemas/DocumentSection';

type MarkerContract = Record<string, unknown>;

const CUSTOM_TYPE_BLUE_ID = 'sdkdsl-custom-type';
const NAMED_EVENT_BLUE_ID = 'sdkdsl-common-named-event';

const sdkDslTestRepository: BlueRepository = {
  name: 'sdk-dsl.test.repo',
  repositoryVersions: ['R0'],
  packages: {
    sdkdsl: {
      name: 'sdkdsl',
      aliases: {
        'Custom/Type': CUSTOM_TYPE_BLUE_ID,
      },
      typesMeta: {
        [CUSTOM_TYPE_BLUE_ID]: {
          status: 'stable',
          name: 'Type',
          versions: [
            {
              repositoryVersionIndex: 0,
              typeBlueId: CUSTOM_TYPE_BLUE_ID,
              attributesAdded: [],
            },
          ],
        },
      },
      contents: {
        [CUSTOM_TYPE_BLUE_ID]: {
          name: 'Type',
        },
      },
      schemas: {},
    },
  },
};

const sdkDslParityRepository: BlueRepository = {
  name: 'sdk-dsl.parity.repo',
  repositoryVersions: ['R0'],
  packages: {
    sdkdslParity: {
      name: 'sdkdslParity',
      aliases: {
        'Common/Named Event': NAMED_EVENT_BLUE_ID,
      },
      typesMeta: {
        [NAMED_EVENT_BLUE_ID]: {
          status: 'stable',
          name: 'Named Event',
          versions: [
            {
              repositoryVersionIndex: 0,
              typeBlueId: NAMED_EVENT_BLUE_ID,
              attributesAdded: [],
            },
          ],
        },
      },
      contents: {
        [NAMED_EVENT_BLUE_ID]: {
          name: 'Named Event',
        },
      },
      schemas: {},
    },
  },
};

export function createBlue(): Blue {
  return new Blue({
    repositories: [blueRepository, sdkDslTestRepository],
  });
}

export function createParityBlue(): Blue {
  return new Blue({
    repositories: [
      blueRepository,
      sdkDslTestRepository,
      sdkDslParityRepository,
    ],
  });
}

export function createDocumentProcessor(
  blue = createBlue(),
): DocumentProcessor {
  const registry = ContractProcessorRegistryBuilder.create()
    .registerDefaults()
    .register(
      createMarkerProcessor(
        conversationBlueIds['Conversation/Document Section'],
        DocumentSectionSchema,
      ),
    )
    .register(
      createMarkerProcessor(
        conversationBlueIds['Conversation/Contracts Change Policy'],
        ContractsChangePolicySchema,
      ),
    )
    .build();

  return new DocumentProcessor({
    blue,
    registry,
  });
}

export function getStoredDocumentBlueId(document: BlueNode): string {
  const documentId = document
    .getProperties()
    ?.contracts?.getProperties()
    ?.initialized?.getProperties()
    ?.documentId?.getValue();

  if (typeof documentId !== 'string') {
    throw new Error('Expected initialized document to contain a documentId');
  }

  return documentId;
}

export function makeOperationRequestEvent(
  blue: Blue,
  options: {
    readonly timelineId: string;
    readonly operation: string;
    readonly request: unknown;
    readonly allowNewerVersion?: boolean;
    readonly documentBlueId?: string;
  },
): BlueNode {
  const message: Record<string, unknown> = {
    type: 'Conversation/Operation Request',
    operation: options.operation,
    request: options.request,
  };

  if (options.allowNewerVersion != null) {
    message.allowNewerVersion = options.allowNewerVersion;
  }

  if (options.documentBlueId) {
    message.document = {
      blueId: options.documentBlueId,
    };
  }

  return blue.jsonValueToNode({
    type: 'Conversation/Timeline Entry',
    timeline: {
      timelineId: options.timelineId,
    },
    message,
  });
}

export function makeTimelineEntryEvent(
  blue: Blue,
  options: {
    readonly timelineId: string;
    readonly message: Record<string, unknown>;
    readonly actorName?: string;
    readonly timestamp?: number;
  },
): BlueNode {
  return blue.jsonValueToNode({
    type: 'Conversation/Timeline Entry',
    timeline: {
      timelineId: options.timelineId,
    },
    message: options.message,
    actor: {
      name: options.actorName ?? 'SDK DSL Test Driver',
    },
    timestamp: options.timestamp ?? 1700000000,
  });
}

export async function initializeDocument(
  document: BlueNode,
  options?: {
    readonly blue?: Blue;
    readonly processor?: DocumentProcessor;
  },
): Promise<{
  blue: Blue;
  processor: DocumentProcessor;
  document: BlueNode;
  triggeredEvents: readonly BlueNode[];
}> {
  const blue = options?.blue ?? createBlue();
  const processor = options?.processor ?? createDocumentProcessor(blue);
  const result = await processor.initializeDocument(document);
  if (result.capabilityFailure) {
    throw new Error(
      `Expected initialization success, got failure: ${result.failureReason ?? 'unknown'}`,
    );
  }

  return {
    blue,
    processor,
    document: result.document,
    triggeredEvents: result.triggeredEvents.map((event) => event.clone()),
  };
}

export async function processOperationRequest(options: {
  readonly blue: Blue;
  readonly processor: DocumentProcessor;
  readonly document: BlueNode;
  readonly timelineId: string;
  readonly operation: string;
  readonly request: unknown;
  readonly allowNewerVersion?: boolean;
  readonly documentBlueId?: string;
}) {
  const event = makeOperationRequestEvent(options.blue, {
    timelineId: options.timelineId,
    operation: options.operation,
    request: options.request,
    allowNewerVersion: options.allowNewerVersion,
    documentBlueId: options.documentBlueId,
  });

  const result = await options.processor.processDocument(
    options.document,
    event,
  );
  if (result.capabilityFailure) {
    throw new Error(
      `Expected operation processing success, got failure: ${result.failureReason ?? 'unknown'}`,
    );
  }

  return result;
}

export async function processExternalEvent(options: {
  readonly processor: DocumentProcessor;
  readonly document: BlueNode;
  readonly event: BlueNode;
}) {
  const result = await options.processor.processDocument(
    options.document,
    options.event,
  );
  if (result.capabilityFailure) {
    throw new Error(
      `Expected event processing success, got failure: ${result.failureReason ?? 'unknown'}`,
    );
  }

  return result;
}

function createMarkerProcessor(
  blueId: string,
  schema: MarkerProcessor<MarkerContract>['schema'],
): MarkerProcessor<MarkerContract> {
  return {
    kind: 'marker',
    blueIds: [blueId],
    schema,
  };
}
