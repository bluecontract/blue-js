import { type Blue, type BlueNode } from '@blue-labs/language';
import {
  DocumentProcessor,
  type MarkerProcessor,
} from '@blue-labs/document-processor';
import { z } from 'zod';

import { createTestBlue } from './create-blue.js';

function resolveTypeBlueId(blue: Blue, alias: string): string {
  const blueId = blue.yamlToNode(`type: ${alias}`).getType()?.getBlueId();
  if (!blueId) {
    throw new Error(`Could not resolve BlueId for '${alias}'.`);
  }
  return blueId;
}

function createPassthroughMarkerProcessor(
  blue: Blue,
  alias: string,
): MarkerProcessor<Record<string, unknown>> {
  return {
    kind: 'marker',
    blueIds: [resolveTypeBlueId(blue, alias)],
    schema: z.object({}).passthrough(),
  };
}

export function createProcessorHarness(): {
  blue: Blue;
  processor: DocumentProcessor;
  createOperationRequestEvent: (
    timelineId: string,
    operation: string,
    request: unknown,
    options?: {
      allowNewerVersion?: boolean;
      documentBlueId?: string;
    },
  ) => BlueNode;
} {
  const blue = createTestBlue();
  const processor = new DocumentProcessor({ blue });
  processor.registerContractProcessor(
    createPassthroughMarkerProcessor(blue, 'Conversation/Document Section'),
  );
  processor.registerContractProcessor(
    createPassthroughMarkerProcessor(
      blue,
      'Conversation/Contracts Change Policy',
    ),
  );

  return {
    blue,
    processor,
    createOperationRequestEvent: (
      timelineId: string,
      operation: string,
      request: unknown,
      options?: {
        allowNewerVersion?: boolean;
        documentBlueId?: string;
      },
    ) => {
      const message: Record<string, unknown> = {
        type: 'Conversation/Operation Request',
        operation,
        request,
      };
      if (options?.allowNewerVersion !== undefined) {
        message.allowNewerVersion = options.allowNewerVersion;
      }
      if (options?.documentBlueId) {
        message.document = { blueId: options.documentBlueId };
      }

      return blue.jsonValueToNode({
        type: 'Conversation/Timeline Entry',
        timeline: {
          timelineId,
        },
        message,
      });
    },
  };
}
