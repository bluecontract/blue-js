/*
Java references:
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderGeneralDslParityTest.java
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderOperationsDslParityTest.java
- references/java-sdk/src/main/java/blue/language/sdk/SimpleDocBuilder.java
*/

import { DocBuilder, SimpleDocBuilder } from '../lib';
import { assertDslMatchesYaml } from './dsl-parity';

describe('DocBuilder generic parity helpers', () => {
  it('returns SimpleDocBuilder from both public entry points', () => {
    expect(DocBuilder.doc()).toBeInstanceOf(SimpleDocBuilder);
    expect(SimpleDocBuilder.doc()).toBeInstanceOf(SimpleDocBuilder);
  });

  it('builds generic documents through SimpleDocBuilder', () => {
    const built = SimpleDocBuilder.doc()
      .name('Simple parity')
      .field('/counter', 1)
      .buildDocument();

    assertDslMatchesYaml(
      built,
      `
name: Simple parity
counter: 1
`,
    );
  });

  it('creates canEmit operation and impl contracts with typed and shaped list requests', () => {
    const built = DocBuilder.doc()
      .name('Can emit parity')
      .channels('aliceChannel', 'bobChannel', 'celineChannel')
      .canEmit('aliceChannel')
      .canEmit('bobChannel', 'Integer', 'Conversation/Event')
      .canEmit(
        'celineChannel',
        {
          type: 'Conversation/Event',
          kind: 'Ev1',
        },
        {
          type: 'Conversation/Event',
          kind: 'Ev2',
        },
      )
      .buildDocument();

    assertDslMatchesYaml(
      built,
      `
name: Can emit parity
contracts:
  aliceChannel:
    type: Core/Channel
  bobChannel:
    type: Core/Channel
  celineChannel:
    type: Core/Channel
  aliceEmit:
    type: Conversation/Operation
    channel: aliceChannel
    request:
      type: List
  aliceEmitImpl:
    type: Conversation/Sequential Workflow Operation
    operation: aliceEmit
    steps:
      - name: EmitEvents
        type: Conversation/JavaScript Code
        code: "return { events: event.message.request };"
  bobEmit:
    type: Conversation/Operation
    channel: bobChannel
    request:
      type: List
      items:
        - type: Integer
        - type: Conversation/Event
  bobEmitImpl:
    type: Conversation/Sequential Workflow Operation
    operation: bobEmit
    steps:
      - name: EmitEvents
        type: Conversation/JavaScript Code
        code: "return { events: event.message.request };"
  celineEmit:
    type: Conversation/Operation
    channel: celineChannel
    request:
      type: List
      items:
        - type: Conversation/Event
          kind: Ev1
        - type: Conversation/Event
          kind: Ev2
  celineEmitImpl:
    type: Conversation/Sequential Workflow Operation
    operation: celineEmit
    steps:
      - name: EmitEvents
        type: Conversation/JavaScript Code
        code: "return { events: event.message.request };"
`,
    );
  });

  it('maps direct and staged change lifecycle helpers to repo-confirmed contracts', () => {
    const built = DocBuilder.doc()
      .name('Change lifecycle parity')
      .channel('ownerChannel')
      .channel('reviewerChannel')
      .directChange('applyPatch', 'ownerChannel', 'Apply incoming changeset')
      .proposeChange('proposeText', 'ownerChannel', 'Text')
      .acceptChange('acceptText', 'reviewerChannel', 'Text')
      .rejectChange('rejectText', 'reviewerChannel', 'Text')
      .buildDocument();

    assertDslMatchesYaml(
      built,
      `
name: Change lifecycle parity
contracts:
  ownerChannel:
    type: Core/Channel
  reviewerChannel:
    type: Core/Channel
  contractsPolicy:
    type: Conversation/Contracts Change Policy
    requireSectionChanges: true
  applyPatch:
    type: Conversation/Change Operation
    channel: ownerChannel
    description: Apply incoming changeset
    request:
      type: Conversation/Change Request
  applyPatchImpl:
    type: Conversation/Change Workflow
    operation: applyPatch
    steps:
      - name: CollectChangeset
        type: Conversation/JavaScript Code
        code: "const request = event?.message?.request ?? {}; return { changeset: request.changeset ?? [] };"
      - name: ApplyChangeset
        type: Conversation/Update Document
        changeset: "\${steps.CollectChangeset.changeset}"
  proposeText:
    type: Conversation/Propose Change Operation
    channel: ownerChannel
    request:
      type: Conversation/Change Request
  proposeTextImpl:
    type: Conversation/Propose Change Workflow
    operation: proposeText
    postfix: Text
  acceptText:
    type: Conversation/Accept Change Operation
    channel: reviewerChannel
  acceptTextImpl:
    type: Conversation/Accept Change Workflow
    operation: acceptText
    postfix: Text
  rejectText:
    type: Conversation/Reject Change Operation
    channel: reviewerChannel
  rejectTextImpl:
    type: Conversation/Reject Change Workflow
    operation: rejectText
    postfix: Text
`,
    );
  });

  it('maps anchors and links helpers with runtime-confirmed marker/link shapes', () => {
    const built = DocBuilder.doc()
      .name('Anchors and links parity')
      .anchors(['anchorA'])
      .links({
        sessionLink: {
          anchor: 'anchorA',
          sessionId: 'SESSION_1',
        },
        documentLink: {
          anchor: 'anchorA',
          documentId: 'DOC_1',
        },
        typeLink: {
          anchor: 'anchorA',
          documentType: 'Conversation/Event',
        },
      })
      .buildDocument();

    assertDslMatchesYaml(
      built,
      `
name: Anchors and links parity
contracts:
  anchors:
    type: MyOS/Document Anchors
    anchorA:
      type: MyOS/Document Anchor
  links:
    type: MyOS/Document Links
    sessionLink:
      type: MyOS/MyOS Session Link
      anchor: anchorA
      sessionId: SESSION_1
    documentLink:
      type: MyOS/Document Link
      anchor: anchorA
      documentId: DOC_1
    typeLink:
      type: MyOS/Document Type Link
      anchor: anchorA
      documentType:
        type: Conversation/Event
`,
    );
  });
});
