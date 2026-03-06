package blue.language.sdk.dsl;

import blue.language.model.Node;
import blue.language.sdk.DocBuilder;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertSame;
import static blue.language.sdk.dsl.DslParityAssertions.assertDslMatchesYaml;

class DocBuilderGeneralDslParityTest {

    @Test
    void identityAndStringTypeMatchYamlDefinition() {
        Node fromDsl = DocBuilder.doc()
                .name("Identity parity")
                .description("Doc description")
                .type("Custom/Type")
                .buildDocument();

        assertDslMatchesYaml(fromDsl, """
                name: Identity parity
                description: Doc description
                type: Custom/Type
                """);
    }

    @Test
    void classTypeMatchYamlDefinition() {
        Node fromDsl = DocBuilder.doc()
                .name("Class type parity")
                .type(Integer.class)
                .buildDocument();

        assertDslMatchesYaml(fromDsl, """
                name: Class type parity
                type: Integer
                """);
    }

    @Test
    void editMutatesProvidedNodeWithoutClone() {
        Node existing = new Node().name("Existing");

        Node edited = DocBuilder.edit(existing)
                .field("/counter", 1)
                .buildDocument();

        assertSame(existing, edited);
        assertDslMatchesYaml(edited, """
                name: Existing
                counter: 1
                """);
    }

    @Test
    void fromClonesProvidedNode() {
        Node existing = new Node().name("Existing");

        Node clonedAndEdited = DocBuilder.from(existing)
                .field("/counter", 1)
                .buildDocument();

        assertNotSame(existing, clonedAndEdited);
        assertDslMatchesYaml(existing, """
                name: Existing
                """);
        assertDslMatchesYaml(clonedAndEdited, """
                name: Existing
                counter: 1
                """);
    }

    @Test
    void operationInlineWithRequestTypeMatchesYamlDefinition() {
        Node fromDsl = DocBuilder.doc()
                .name("Operation request parity")
                .channel("ownerChannel")
                .operation(
                        "increment",
                        "ownerChannel",
                        Integer.class,
                        "Increment the counter",
                        steps -> steps.replaceExpression(
                                "ApplyIncrement",
                                "/counter",
                                "document('/counter') + event.message.request"))
                .buildDocument();

        assertDslMatchesYaml(fromDsl, """
                name: Operation request parity
                contracts:
                  ownerChannel:
                    type: Core/Channel
                  increment:
                    type: Conversation/Operation
                    channel: ownerChannel
                    description: Increment the counter
                    request:
                      type: Integer
                  incrementImpl:
                    type: Conversation/Sequential Workflow Operation
                    operation: increment
                    steps:
                      - name: ApplyIncrement
                        type: Conversation/Update Document
                        changeset:
                          - op: replace
                            path: /counter
                            val: ${document('/counter') + event.message.request}
                """);
    }

    @Test
    void operationInlineWithoutRequestTypeMatchesYamlDefinition() {
        Node fromDsl = DocBuilder.doc()
                .name("Operation parity")
                .channel("ownerChannel")
                .operation(
                        "ping",
                        "ownerChannel",
                        "Ping operation",
                        steps -> steps.replaceValue("SetStatus", "/status", "ok"))
                .buildDocument();

        assertDslMatchesYaml(fromDsl, """
                name: Operation parity
                contracts:
                  ownerChannel:
                    type: Core/Channel
                  ping:
                    type: Conversation/Operation
                    channel: ownerChannel
                    description: Ping operation
                  pingImpl:
                    type: Conversation/Sequential Workflow Operation
                    operation: ping
                    steps:
                      - name: SetStatus
                        type: Conversation/Update Document
                        changeset:
                          - op: replace
                            path: /status
                            val: ok
                """);
    }

    @Test
    void operationBuilderNoRequestMatchesYamlDefinition() {
        Node fromDsl = DocBuilder.doc()
                .name("Operation builder parity")
                .channel("ownerChannel")
                .operation("ack")
                .channel("ownerChannel")
                .description("Acknowledge")
                .noRequest()
                .steps(steps -> steps.replaceValue("SetAck", "/acknowledged", true))
                .done()
                .buildDocument();

        assertDslMatchesYaml(fromDsl, """
                name: Operation builder parity
                contracts:
                  ownerChannel:
                    type: Core/Channel
                  ack:
                    type: Conversation/Operation
                    channel: ownerChannel
                    description: Acknowledge
                  ackImpl:
                    type: Conversation/Sequential Workflow Operation
                    operation: ack
                    steps:
                      - name: SetAck
                        type: Conversation/Update Document
                        changeset:
                          - op: replace
                            path: /acknowledged
                            val: true
                """);
    }

    @Test
    void operationBuilderRequestDescriptionMatchesYamlDefinition() {
        Node fromDsl = DocBuilder.doc()
                .name("Operation builder request description parity")
                .channel("ownerChannel")
                .operation("increment")
                .channel("ownerChannel")
                .description("Increment")
                .requestType(Integer.class)
                .requestDescription("Value to add")
                .steps(steps -> steps.replaceExpression(
                        "ApplyIncrement",
                        "/counter",
                        "document('/counter') + event.message.request"))
                .done()
                .buildDocument();

        assertDslMatchesYaml(fromDsl, """
                name: Operation builder request description parity
                contracts:
                  ownerChannel:
                    type: Core/Channel
                  increment:
                    type: Conversation/Operation
                    channel: ownerChannel
                    description: Increment
                    request:
                      type: Integer
                      description: Value to add
                  incrementImpl:
                    type: Conversation/Sequential Workflow Operation
                    operation: increment
                    steps:
                      - name: ApplyIncrement
                        type: Conversation/Update Document
                        changeset:
                          - op: replace
                            path: /counter
                            val: ${document('/counter') + event.message.request}
                """);
    }

    @Test
    void onEventMatchesYamlDefinition() {
        Node fromDsl = DocBuilder.doc()
                .name("On event parity")
                .onEvent("onNumber", Integer.class, steps -> steps.replaceValue("SetN", "/n", 1))
                .buildDocument();

        assertDslMatchesYaml(fromDsl, """
                name: On event parity
                contracts:
                  triggeredEventChannel:
                    type: Triggered Event Channel
                  onNumber:
                    type: Conversation/Sequential Workflow
                    channel: triggeredEventChannel
                    event:
                      type: Integer
                    steps:
                      - name: SetN
                        type: Conversation/Update Document
                        changeset:
                          - op: replace
                            path: /n
                            val: 1
                """);
    }

    @Test
    void onNamedEventMatchesYamlDefinition() {
        Node fromDsl = DocBuilder.doc()
                .name("On named event parity")
                .onNamedEvent("onOrderReady", "order-ready", steps -> steps.replaceValue("SetReady", "/status", "ready"))
                .buildDocument();

        assertDslMatchesYaml(fromDsl, """
                name: On named event parity
                contracts:
                  triggeredEventChannel:
                    type: Triggered Event Channel
                  onOrderReady:
                    type: Conversation/Sequential Workflow
                    channel: triggeredEventChannel
                    event:
                      type: Common/Named Event
                      name: order-ready
                    steps:
                      - name: SetReady
                        type: Conversation/Update Document
                        changeset:
                          - op: replace
                            path: /status
                            val: ready
                """);
    }

    @Test
    void onDocChangeMatchesYamlDefinition() {
        Node fromDsl = DocBuilder.doc()
                .name("On doc change parity")
                .onDocChange("whenPriceChanges", "/price", steps -> steps.replaceValue("SetStatus", "/status", "updated"))
                .buildDocument();

        assertDslMatchesYaml(fromDsl, """
                name: On doc change parity
                contracts:
                  whenPriceChangesDocUpdateChannel:
                    type: Document Update Channel
                    path: /price
                  whenPriceChanges:
                    type: Conversation/Sequential Workflow
                    channel: whenPriceChangesDocUpdateChannel
                    event:
                      type: Document Update
                    steps:
                      - name: SetStatus
                        type: Conversation/Update Document
                        changeset:
                          - op: replace
                            path: /status
                            val: updated
                """);
    }

    @Test
    void onInitMatchesYamlDefinition() {
        Node fromDsl = DocBuilder.doc()
                .name("On init parity")
                .onInit("initialize", steps -> steps.replaceValue("SetReady", "/status", "ready"))
                .buildDocument();

        assertDslMatchesYaml(fromDsl, """
                name: On init parity
                contracts:
                  initLifecycleChannel:
                    type: Lifecycle Event Channel
                    event:
                      type: Document Processing Initiated
                  initialize:
                    type: Conversation/Sequential Workflow
                    channel: initLifecycleChannel
                    steps:
                      - name: SetReady
                        type: Conversation/Update Document
                        changeset:
                          - op: replace
                            path: /status
                            val: ready
                """);
    }

    @Test
    void myOsAdminMatchesYamlDefinition() {
        Node fromDsl = DocBuilder.doc()
                .name("MyOS admin parity")
                .myOsAdmin()
                .buildDocument();

        assertDslMatchesYaml(fromDsl, """
                name: MyOS admin parity
                contracts:
                  myOsAdminChannel:
                    type: MyOS/MyOS Timeline
                  myOsEmit:
                    type: Conversation/Operation
                    request:
                      type: List
                    channel: myOsAdminChannel
                  myOsEmitImpl:
                    type: Conversation/Sequential Workflow Operation
                    operation: myOsEmit
                    steps:
                      - name: EmitEvents
                        type: Conversation/JavaScript Code
                        code: "return { events: event };"
                """);
    }

    @Test
    void onMyOsResponseWithRequestIdMatchesYamlDefinition() {
        Node fromDsl = DocBuilder.doc()
                .name("MyOS response parity")
                .onMyOsResponse("onResponse", Integer.class, "REQ_1",
                        steps -> steps.replaceValue("SetOk", "/ok", true))
                .buildDocument();

        assertDslMatchesYaml(fromDsl, """
                name: MyOS response parity
                contracts:
                  triggeredEventChannel:
                    type: Triggered Event Channel
                  onResponse:
                    type: Conversation/Sequential Workflow
                    channel: triggeredEventChannel
                    event:
                      type: Integer
                      requestId: REQ_1
                      inResponseTo:
                        requestId: REQ_1
                    steps:
                      - name: SetOk
                        type: Conversation/Update Document
                        changeset:
                          - op: replace
                            path: /ok
                            val: true
                """);
    }

    @Test
    void onMyOsResponseWithoutRequestIdMatchesYamlDefinition() {
        Node fromDsl = DocBuilder.doc()
                .name("Any response parity")
                .onMyOsResponse("onAnyResponse", Integer.class,
                        steps -> steps.replaceValue("SetSeen", "/seen", true))
                .buildDocument();

        assertDslMatchesYaml(fromDsl, """
                name: Any response parity
                contracts:
                  triggeredEventChannel:
                    type: Triggered Event Channel
                  onAnyResponse:
                    type: Conversation/Sequential Workflow
                    channel: triggeredEventChannel
                    event:
                      type: Integer
                    steps:
                      - name: SetSeen
                        type: Conversation/Update Document
                        changeset:
                          - op: replace
                            path: /seen
                            val: true
                """);
    }

    @Test
    void onTriggeredWithIdMatchesYamlDefinition() {
        Node fromDsl = DocBuilder.doc()
                .name("Triggered id parity")
                .onTriggeredWithId("onSubscription", Integer.class, "subscriptionId", "SUB_1",
                        steps -> steps.replaceValue("SetSubscription", "/subscription", "matched"))
                .buildDocument();

        assertDslMatchesYaml(fromDsl, """
                name: Triggered id parity
                contracts:
                  triggeredEventChannel:
                    type: Triggered Event Channel
                  onSubscription:
                    type: Conversation/Sequential Workflow
                    channel: triggeredEventChannel
                    event:
                      type: Integer
                      subscriptionId: SUB_1
                    steps:
                      - name: SetSubscription
                        type: Conversation/Update Document
                        changeset:
                          - op: replace
                            path: /subscription
                            val: matched
                """);
    }

    @Test
    void onTriggeredWithMatcherMatchesYamlDefinition() {
        Node fromDsl = DocBuilder.doc()
                .name("Triggered matcher parity")
                .onTriggeredWithMatcher("onCorrelation", Integer.class, new CorrelationMatcher().correlationId("CID_1"),
                        steps -> steps.replaceValue("SetCorrelation", "/correlation", "ok"))
                .buildDocument();

        assertDslMatchesYaml(fromDsl, """
                name: Triggered matcher parity
                contracts:
                  triggeredEventChannel:
                    type: Triggered Event Channel
                  onCorrelation:
                    type: Conversation/Sequential Workflow
                    channel: triggeredEventChannel
                    event:
                      type: Integer
                      correlationId: CID_1
                    steps:
                      - name: SetCorrelation
                        type: Conversation/Update Document
                        changeset:
                          - op: replace
                            path: /correlation
                            val: ok
                """);
    }

    @Test
    void onSubscriptionUpdateWithTypeMatchesYamlDefinition() {
        Node fromDsl = DocBuilder.doc()
                .name("Subscription update typed parity")
                .onSubscriptionUpdate("onSub", "SUB_42", Integer.class,
                        steps -> steps.replaceValue("SetValue", "/value", 42))
                .buildDocument();

        assertDslMatchesYaml(fromDsl, """
                name: Subscription update typed parity
                contracts:
                  triggeredEventChannel:
                    type: Triggered Event Channel
                  onSub:
                    type: Conversation/Sequential Workflow
                    channel: triggeredEventChannel
                    event:
                      type: MyOS/Subscription Update
                      subscriptionId: SUB_42
                      update:
                        type:
                          value: Integer
                    steps:
                      - name: SetValue
                        type: Conversation/Update Document
                        changeset:
                          - op: replace
                            path: /value
                            val: 42
                """);
    }

    @Test
    void onSubscriptionUpdateWithoutTypeMatchesYamlDefinition() {
        Node fromDsl = DocBuilder.doc()
                .name("Subscription update parity")
                .onSubscriptionUpdate("onSub", "SUB_99",
                        steps -> steps.replaceValue("SetStatus", "/status", "received"))
                .buildDocument();

        assertDslMatchesYaml(fromDsl, """
                name: Subscription update parity
                contracts:
                  triggeredEventChannel:
                    type: Triggered Event Channel
                  onSub:
                    type: Conversation/Sequential Workflow
                    channel: triggeredEventChannel
                    event:
                      type: MyOS/Subscription Update
                      subscriptionId: SUB_99
                    steps:
                      - name: SetStatus
                        type: Conversation/Update Document
                        changeset:
                          - op: replace
                            path: /status
                            val: received
                """);
    }

    @Test
    void directChangeMatchesYamlDefinition() {
        Node fromDsl = DocBuilder.doc()
                .name("Direct change parity")
                .channel("ownerChannel")
                .directChange("applyPatch", "ownerChannel", "Apply incoming changeset")
                .buildDocument();

        assertDslMatchesYaml(fromDsl, """
                name: Direct change parity
                contracts:
                  ownerChannel:
                    type: Core/Channel
                  applyPatch:
                    type: Conversation/Operation
                    channel: ownerChannel
                    description: Apply incoming changeset
                  applyPatchImpl:
                    type: Conversation/Sequential Workflow Operation
                    operation: applyPatch
                    steps:
                      - name: CollectChangeset
                        type: Conversation/JavaScript Code
                        code: "const request = event?.message?.request ?? {}; return { events: [], changeset: request.changeset ?? [] };"
                      - name: ApplyChangeset
                        type: Conversation/Update Document
                        changeset: ${steps.CollectChangeset.changeset}
                policies:
                  contractsChangePolicy:
                    mode: direct-change
                    reason: operation applies request changeset
                """);
    }

    @Test
    void fieldReplaceRemoveMatchYamlDefinition() {
        Node fromDsl = DocBuilder.doc()
                .name("Pointer parity")
                .field("/counter", 1)
                .replace("/counter", 2)
                .field("/temp", 3)
                .remove("/temp")
                .buildDocument();

        assertDslMatchesYaml(fromDsl, """
                name: Pointer parity
                counter: 2
                """);
    }

    @Test
    void exprWrapsWhenMissingAndKeepsWrappedExpressions() {
        assertEquals("${document('/x')}", DocBuilder.expr("document('/x')"));
        assertEquals("${document('/x')}", DocBuilder.expr("${document('/x')}"));
    }

    private static final class CorrelationMatcher {
        public String correlationId;

        private CorrelationMatcher correlationId(String correlationId) {
            this.correlationId = correlationId;
            return this;
        }
    }
}
