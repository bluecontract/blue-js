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
import { blueIds as conversationBlueIds } from '@blue-repository/conversation';

const blue = createBlue();

const TIMELINE_ID = 'owner-42';
const OPERATION_KEY = 'increment';

type DocumentBuildOptions = {
  operationChannel?: string | null;
  requestTypeYaml?: string;
  handlerEventYaml?: string;
  stepExpression?: string;
};

function indentBlock(block: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return block
    .split('\n')
    .map((line) => (line.length > 0 ? `${pad}${line}` : line))
    .join('\n');
}

function buildOperationDocument(options?: DocumentBuildOptions): BlueNode {
  const {
    operationChannel,
    requestTypeYaml = 'type: Integer',
    handlerEventYaml,
    stepExpression = "${event.request + document('/counter')}",
  } = options ?? {};

  const operationChannelLine = operationChannel
    ? `    channel: ${operationChannel}\n`
    : '';

  const handlerEventSection = handlerEventYaml
    ? `    event:\n${indentBlock(handlerEventYaml.trim(), 6)}\n`
    : '';

  const yaml = `name: Operation Workflow Doc
counter: 0
contracts:
  ownerChannel:
    type: Timeline Channel
    timelineId: ${TIMELINE_ID}
  ${OPERATION_KEY}:
    type: Operation
${operationChannelLine}    request:
${indentBlock(requestTypeYaml.trim(), 6)}
  ${OPERATION_KEY}Handler:
    type: Sequential Workflow Operation
    channel: ownerChannel
    operation: ${OPERATION_KEY}
${handlerEventSection}    steps:
      - name: ApplyIncrement
        type: Update Document
        changeset:
          - op: replace
            path: /counter
            val: "${stepExpression}"
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
    type: 'Operation Request',
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
    type: 'Timeline Entry',
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
    type: Timeline Channel
    timelineId: ${TIMELINE_ID}
  ${OPERATION_KEY}:
    type: Operation
    request:
      type: Integer
  ${OPERATION_KEY}Handler:
    type: Sequential Workflow Operation
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
      conversationBlueIds['Operation'],
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
      stepExpression: "${event.request.amount + document('/counter')}",
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
      handlerEventYaml: `type: Operation Request
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
});
