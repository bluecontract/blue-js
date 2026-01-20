import { describe, expect, it } from 'vitest';
import { BlueNode } from '@blue-labs/language';

import { createBlue } from '../../test-support/blue.js';
import {
  buildProcessor,
  expectOk,
  numericValue,
  property,
  typeBlueId,
} from '../../__tests__/test-utils.js';
import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';
import { blueIds as coreBlueIds } from '@blue-repository/types/packages/core/blue-ids';

const blue = createBlue();

const TIMELINE_ID = 'owner-42';
const OPERATION_KEY = 'increment';

type DocumentBuildOptions = {
  operationChannel?: string | null;
  requestTypeYaml?: string;
  handlerEventYaml?: string;
  stepExpression?: string;
  handlerChannel?: string | null;
  operationType?: string;
  handlerType?: string;
  changesetYaml?: string;
};

function indentBlock(block: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return block
    .split('\n')
    .map((line) => (line.length > 0 ? `${pad}${line}` : line))
    .join('\n');
}

const DEFAULT_STEP_EXPRESSION =
  "${event.message.request + document('/counter')}";

function buildOperationDocument(options?: DocumentBuildOptions): BlueNode {
  const {
    operationChannel,
    requestTypeYaml = 'type: Integer',
    handlerEventYaml,
    stepExpression = DEFAULT_STEP_EXPRESSION,
    handlerChannel = 'ownerChannel',
    operationType = 'Conversation/Operation',
    handlerType = 'Conversation/Sequential Workflow Operation',
    changesetYaml,
  } = options ?? {};

  const operationChannelLine =
    typeof operationChannel === 'string' && operationChannel.length > 0
      ? `    channel: ${operationChannel}\n`
      : '';

  const handlerChannelLine =
    typeof handlerChannel === 'string' && handlerChannel.length > 0
      ? `    channel: ${handlerChannel}\n`
      : '';

  const handlerEventSection = handlerEventYaml
    ? `    event:\n${indentBlock(handlerEventYaml.trim(), 6)}\n`
    : '';

  const resolvedChangesetYaml =
    changesetYaml?.trim() ??
    `- op: replace
  path: /counter
  val: "${stepExpression}"`;

  const yaml = `name: Operation Workflow Doc
counter: 0
contracts:
  ownerChannel:
    type: Conversation/Timeline Channel
    timelineId: ${TIMELINE_ID}
  ${OPERATION_KEY}:
    type: ${operationType}
${operationChannelLine}    request:
${indentBlock(requestTypeYaml.trim(), 6)}
  ${OPERATION_KEY}Handler:
    type: ${handlerType}
${handlerChannelLine}    operation: ${OPERATION_KEY}
${handlerEventSection}    steps:
      - name: ApplyIncrement
        type: Conversation/Update Document
        changeset:
${indentBlock(resolvedChangesetYaml, 10)}
`;
  return blue.yamlToNode(yaml);
}

function operationRequestEvent(options?: {
  request?: unknown;
  allowNewerVersion?: boolean;
  documentBlueId?: string;
  operation?: string;
}): BlueNode {
  const {
    request = 1,
    allowNewerVersion = true,
    documentBlueId,
    operation = OPERATION_KEY,
  } = options ?? {};
  const message: Record<string, unknown> = {
    type: 'Conversation/Operation Request',
    operation,
    request,
  };
  if (allowNewerVersion !== undefined) {
    message.allowNewerVersion = allowNewerVersion;
  }
  if (documentBlueId) {
    message.document = { blueId: documentBlueId };
  }
  return blue.jsonValueToNode({
    type: 'Conversation/Timeline Entry',
    timeline: { timelineId: TIMELINE_ID },
    message,
  });
}

function storedDocumentBlueId(document: BlueNode): string {
  const contractsNode = property(document, 'contracts');
  const initializedNode = property(contractsNode, 'initialized');
  const documentIdNode = property(initializedNode, 'documentId');
  const storedBlueId = documentIdNode.getValue();
  if (typeof storedBlueId !== 'string') {
    throw new Error('Expected stored document blueId');
  }
  return storedBlueId;
}

describe('SequentialWorkflowOperationProcessor', () => {
  it('executes sequential workflow operations when request matches definition', async () => {
    const processor = buildProcessor(blue);
    const init = await expectOk(
      processor.initializeDocument(buildOperationDocument()),
    );
    const storedBlueId = storedDocumentBlueId(init.document);
    const event = operationRequestEvent({
      request: 5,
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    const result = await expectOk(
      processor.processDocument(init.document.clone(), event),
    );

    const counterNode = property(result.document, 'counter');
    expect(numericValue(counterNode)).toBe(5);
    expect(result.triggeredEvents.length).toBe(0);
  });

  it('exposes derived channel in currentContract bindings', async () => {
    const processor = buildProcessor(blue);
    const init = await expectOk(
      processor.initializeDocument(
        buildOperationDocument({
          operationChannel: 'ownerChannel',
          handlerChannel: null,
          stepExpression: '${currentContract.channel}',
        }),
      ),
    );
    const storedBlueId = storedDocumentBlueId(init.document);
    const event = operationRequestEvent({
      request: 1,
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    const result = await expectOk(
      processor.processDocument(init.document.clone(), event),
    );

    const counterNode = property(result.document, 'counter');
    expect(counterNode.getValue()).toBe('ownerChannel');
  });

  it('skips workflow when request type does not match operation contract', async () => {
    const processor = buildProcessor(blue);
    const init = await expectOk(
      processor.initializeDocument(buildOperationDocument()),
    );
    const event = operationRequestEvent({ request: 'oops' });

    const result = await expectOk(
      processor.processDocument(init.document.clone(), event),
    );

    const counterNode = property(result.document, 'counter');
    expect(numericValue(counterNode)).toBe(0);
  });

  it('skips workflow when request pins mismatched document version', async () => {
    const processor = buildProcessor(blue);
    const init = await expectOk(
      processor.initializeDocument(buildOperationDocument()),
    );
    const storedBlueId = storedDocumentBlueId(init.document);
    const event = operationRequestEvent({
      request: 3,
      allowNewerVersion: false,
      documentBlueId: `${storedBlueId}-stale`,
    });
    const eventDocument = property(property(event, 'message'), 'document');
    const docJson = blue.nodeToJson(eventDocument) as {
      blueId?: unknown;
    };
    expect(docJson.blueId).toBe(`${storedBlueId}-stale`);

    const result = await expectOk(
      processor.processDocument(init.document.clone(), event),
    );

    const counterNode = property(result.document, 'counter');
    expect(numericValue(counterNode)).toBe(0);
  });

  it('fails initialization when Sequential Workflow Operation omits channel', async () => {
    const processor = buildProcessor(blue);
    const yaml = `name: Missing Channel Doc
contracts:
  ownerChannel:
    type: Conversation/Timeline Channel
    timelineId: ${TIMELINE_ID}
  ${OPERATION_KEY}:
    type: Conversation/Operation
    request:
      type: Integer
  ${OPERATION_KEY}Handler:
    type: Conversation/Sequential Workflow Operation
    operation: ${OPERATION_KEY}
    steps: []
`;

    await expect(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    ).rejects.toThrow(/must declare channel/i);
  });

  it('registers Operation marker for must-understand compliance', async () => {
    const processor = buildProcessor(blue);
    const init = await expectOk(
      processor.initializeDocument(buildOperationDocument()),
    );

    const operationContract = property(
      property(init.document, 'contracts'),
      OPERATION_KEY,
    );
    expect(typeBlueId(operationContract)).toBe(
      conversationBlueIds['Conversation/Operation'],
    );
  });

  it('honors channel metadata defined on the Operation contract', async () => {
    const processor = buildProcessor(blue);
    const init = await expectOk(
      processor.initializeDocument(
        buildOperationDocument({ operationChannel: 'ownerChannel' }),
      ),
    );
    const storedBlueId = storedDocumentBlueId(init.document);
    const event = operationRequestEvent({
      request: 7,
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    const result = await expectOk(
      processor.processDocument(init.document.clone(), event),
    );

    expect(numericValue(property(result.document, 'counter'))).toBe(7);
  });

  it('executes derived change workflow with change request payloads', async () => {
    const processor = buildProcessor(blue);
    const derivedChangesetYaml = `- op: "\${event.message.request.changeset[0].op}"
  path: "\${event.message.request.changeset[0].path}"
  val: "\${event.message.request.changeset[0].val}"`;
    const init = await expectOk(
      processor.initializeDocument(
        buildOperationDocument({
          operationType: 'Conversation/Change Operation',
          handlerType: 'Conversation/Change Workflow',
          requestTypeYaml: 'type: Conversation/Change Request',
          changesetYaml: derivedChangesetYaml,
        }),
      ),
    );

    const event = operationRequestEvent({
      request: {
        type: 'Conversation/Change Request',
        changeset: [{ op: 'replace', path: '/counter', val: 11 }],
      },
    });

    const result = await expectOk(
      processor.processDocument(init.document.clone(), event),
    );

    expect(numericValue(property(result.document, 'counter'))).toBe(11);
  });

  it('derives channel from Operation when handler omits channel', async () => {
    const processor = buildProcessor(blue);
    const doc = buildOperationDocument({
      operationChannel: 'ownerChannel',
      handlerChannel: null,
    });
    const init = await expectOk(processor.initializeDocument(doc));

    const storedBlueId = storedDocumentBlueId(init.document);
    const event = operationRequestEvent({
      request: 4,
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    const result = await expectOk(
      processor.processDocument(init.document.clone(), event),
    );

    expect(numericValue(property(result.document, 'counter'))).toBe(4);
  });

  it('skips workflow when handler channel conflicts with operation channel', async () => {
    const processor = buildProcessor(blue);
    const yaml = `name: Conflicting Channels Doc
counter: 0
contracts:
  ownerChannel:
    type: Conversation/Timeline Channel
    timelineId: ${TIMELINE_ID}
  otherChannel:
    type: Conversation/Timeline Channel
    timelineId: other-${TIMELINE_ID}
  ${OPERATION_KEY}:
    type: Conversation/Operation
    channel: otherChannel
    request:
      type: Integer
  ${OPERATION_KEY}Handler:
    type: Conversation/Sequential Workflow Operation
    channel: ownerChannel
    operation: ${OPERATION_KEY}
    steps:
      - name: ApplyIncrement
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /counter
            val: "${DEFAULT_STEP_EXPRESSION}"
`;
    const init = await expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    );
    const storedBlueId = storedDocumentBlueId(init.document);
    const event = operationRequestEvent({
      request: 5,
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    const result = await expectOk(
      processor.processDocument(init.document.clone(), event),
    );

    expect(numericValue(property(result.document, 'counter'))).toBe(0);
  });

  //TODO: Check the event matching logic
  it('handles complex request structures defined by the Operation contract', async () => {
    const processor = buildProcessor(blue);
    const doc = buildOperationDocument({
      requestTypeYaml: `type: Dictionary
entries:
  amount:
    type: Integer
  metadata:
    type: Dictionary
    entries:
      note:
        type: Text`,
      stepExpression: "${event.message.request.amount + document('/counter')}",
    });
    const init = await expectOk(processor.initializeDocument(doc));
    const storedBlueId = storedDocumentBlueId(init.document);
    const event = operationRequestEvent({
      request: {
        amount: 3,
        metadata: { note: 'boost' },
      },
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    const result = await expectOk(
      processor.processDocument(init.document.clone(), event),
    );

    expect(numericValue(property(result.document, 'counter'))).toBe(3);
  });

  it('applies handler event patterns to Operation requests', async () => {
    const processor = buildProcessor(blue);
    const doc = buildOperationDocument({
      handlerEventYaml: `message:
  type: Conversation/Operation Request
  allowNewerVersion: false`,
    });
    const init = await expectOk(processor.initializeDocument(doc));
    const storedBlueId = storedDocumentBlueId(init.document);

    const matchingEvent = operationRequestEvent({
      request: 2,
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });
    const matchedResult = await expectOk(
      processor.processDocument(init.document.clone(), matchingEvent),
    );
    expect(numericValue(property(matchedResult.document, 'counter'))).toBe(2);

    const nonMatchingEvent = operationRequestEvent({
      request: 5,
      allowNewerVersion: true,
      documentBlueId: storedBlueId,
    });
    const skippedResult = await expectOk(
      processor.processDocument(
        matchedResult.document.clone(),
        nonMatchingEvent,
      ),
    );
    expect(numericValue(property(skippedResult.document, 'counter'))).toBe(2);
  });

  it('executes derived Change Operation workflow and updates document', async () => {
    const processor = buildProcessor(blue);
    const operationKey = 'changeByAlice';
    const yaml = `name: Change Workflow Doc
counter: 0
contracts:
  ownerChannel:
    type: Conversation/Timeline Channel
    timelineId: ${TIMELINE_ID}
  ${operationKey}:
    type: Conversation/Change Operation
    channel: ownerChannel
    request:
      type: Conversation/Change Request
  ${operationKey}Handler:
    type: Conversation/Change Workflow
    operation: ${operationKey}
    steps:
      - name: ApplyChange
        type: Conversation/Update Document
        changeset: "\${event.message.request.changeset}"
`;
    const init = await expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    );
    const storedBlueId = storedDocumentBlueId(init.document);
    const event = operationRequestEvent({
      request: {
        type: { blueId: conversationBlueIds['Conversation/Change Request'] },
        changesetDescription: 'Update counter',
        changeset: [
          {
            type: { blueId: coreBlueIds['Core/Json Patch Entry'] },
            op: 'replace',
            path: '/counter',
            val: 7,
          },
        ],
      },
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
      operation: operationKey,
    });

    const result = await expectOk(
      processor.processDocument(init.document.clone(), event),
    );

    expect(numericValue(property(result.document, 'counter'))).toBe(7);
  });
});
