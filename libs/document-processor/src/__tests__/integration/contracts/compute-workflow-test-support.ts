import { Blue, BlueNode } from '@blue-labs/language';

import { createBlue } from '../../../test-support/blue.js';
import { buildProcessor, expectOk } from '../../test-utils.js';
import type { DocumentProcessingResult } from '../../../types/document-processing-result.js';

const DEFAULT_TIMELINE_ID = 'owner';

type OperationRequestOptions = {
  readonly timelineId?: string;
  readonly timestamp?: number;
  readonly operation?: string;
  readonly request?: unknown;
};

export class ComputeWorkflowTestSupport {
  private timestamp = 1;

  readonly blue: Blue;
  private readonly processor;

  constructor(blue = createBlue()) {
    this.blue = blue;
    this.processor = buildProcessor(blue);
  }

  yaml(source: string): BlueNode {
    return this.blue.yamlToNode(source);
  }

  async initialize(document: BlueNode): Promise<DocumentProcessingResult> {
    return expectOk(this.processor.initializeDocument(document));
  }

  async process(
    snapshot: BlueNode,
    event: BlueNode,
  ): Promise<DocumentProcessingResult> {
    return expectOk(this.processor.processDocument(snapshot, event));
  }

  async processRun(
    snapshot: BlueNode,
    request: unknown = 'request',
  ): Promise<DocumentProcessingResult> {
    return this.process(
      snapshot,
      this.operationRequest({ operation: 'run', request }),
    );
  }

  operationRequest(options?: OperationRequestOptions): BlueNode {
    const {
      timelineId = DEFAULT_TIMELINE_ID,
      timestamp = this.timestamp++,
      operation = 'run',
      request = 'request',
    } = options ?? {};

    return this.blue.jsonValueToNode({
      type: 'Conversation/Timeline Entry',
      timeline: { timelineId },
      timestamp,
      message: {
        type: 'Conversation/Operation Request',
        operation,
        request,
        allowNewerVersion: true,
      },
    });
  }

  async initializedOperationWorkflow(
    body: string,
    options?: { readonly requestTypeYaml?: string },
  ): Promise<BlueNode> {
    const initialized = await this.initialize(
      this.yaml(this.operationWorkflowDocument(body, options)),
    );
    return initialized.document;
  }

  operationWorkflowDocument(
    body: string,
    options?: { readonly requestTypeYaml?: string },
  ): string {
    return this.operationWorkflowDocumentWithContracts('', body, options);
  }

  operationWorkflowDocumentWithStatus(
    rootFields: string,
    body: string,
    options?: { readonly requestTypeYaml?: string },
  ): string {
    const root = rootFields.trim().length > 0 ? `${rootFields.trim()}\n` : '';
    return `name: Compute Workflow Test
status: idle
${root}contracts:
${simpleTimelineChannelYaml('ownerChannel', DEFAULT_TIMELINE_ID)}  run:
    type: Conversation/Operation
    channel: ownerChannel
    request:
${indentBlock((options?.requestTypeYaml ?? 'type: Text').trim(), 6)}
  runImpl:
    type: Conversation/Sequential Workflow Operation
    operation: run
${body}
`;
  }

  operationWorkflowDocumentWithContracts(
    extraContracts: string,
    body: string,
    options?: { readonly requestTypeYaml?: string },
  ): string {
    const contracts =
      extraContracts.trim().length > 0 ? `${extraContracts.trimEnd()}\n` : '';
    return `name: Compute Workflow Test
status: idle
contracts:
${simpleTimelineChannelYaml('ownerChannel', DEFAULT_TIMELINE_ID)}  run:
    type: Conversation/Operation
    channel: ownerChannel
    request:
${indentBlock((options?.requestTypeYaml ?? 'type: Text').trim(), 6)}
${contracts}  runImpl:
    type: Conversation/Sequential Workflow Operation
    operation: run
${body}
`;
  }
}

export function onlyEvent(result: DocumentProcessingResult): BlueNode {
  if (result.triggeredEvents.length !== 1) {
    throw new Error(
      `Expected exactly one event, got ${result.triggeredEvents.length}`,
    );
  }
  return result.triggeredEvents[0];
}

export function json<T>(blue: Blue, node: BlueNode): T {
  return blue.nodeToJson(node, 'simple') as T;
}

function simpleTimelineChannelYaml(key: string, timelineId: string): string {
  return `  ${key}:
    type: Conversation/Timeline Channel
    timelineId: ${timelineId}
`;
}

function indentBlock(block: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return block
    .split('\n')
    .map((line) => (line.length > 0 ? `${pad}${line}` : line))
    .join('\n');
}
