package blue.language.sdk.dsl;

import blue.language.model.Node;
import blue.language.sdk.DocBuilder;
import blue.language.types.myos.MyOsTimelineChannel;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static blue.language.sdk.dsl.DslParityAssertions.assertDslMatchesYaml;

class DocBuilderChannelsDslParityTest {

    @Test
    void channelDefaultMatchesYamlDefinition() {
        Node fromDsl = DocBuilder.doc()
                .name("Channel parity")
                .channel("ownerChannel")
                .buildDocument();

        assertDslMatchesYaml(fromDsl, """
                name: Channel parity
                contracts:
                  ownerChannel:
                    type: Core/Channel
                """);
    }

    @Test
    void channelBeanMatchesYamlDefinition() {
        Node fromDsl = DocBuilder.doc()
                .name("Provided channel parity")
                .channel("ownerChannel", new MyOsTimelineChannel()
                        .timelineId("timeline-1")
                        .accountId("acc-1")
                        .email("owner@example.com"))
                .buildDocument();

        assertDslMatchesYaml(fromDsl, """
                name: Provided channel parity
                contracts:
                  ownerChannel:
                    type: MyOS/MyOS Timeline Channel
                    timelineId: timeline-1
                    accountId: acc-1
                    email: owner@example.com
                """);
    }

    @Test
    void channelsTwoNamesMatchYamlDefinition() {
        Node fromDsl = DocBuilder.doc()
                .name("Channels parity")
                .channels("nameA", "nameB")
                .buildDocument();

        assertDslMatchesYaml(fromDsl, """
                name: Channels parity
                contracts:
                  nameA:
                    type: Core/Channel
                  nameB:
                    type: Core/Channel
                """);
    }

    @Test
    void compositeChannelMatchesYamlDefinition() {
        Node fromDsl = DocBuilder.doc()
                .name("Composite channel parity")
                .channels("payerChannel", "payeeChannel")
                .compositeChannel("participantUnionChannel", "payerChannel", "payeeChannel")
                .buildDocument();

        assertDslMatchesYaml(fromDsl, """
                name: Composite channel parity
                contracts:
                  payerChannel:
                    type: Core/Channel
                  payeeChannel:
                    type: Core/Channel
                  participantUnionChannel:
                    type: Conversation/Composite Timeline Channel
                    channels:
                      - payerChannel
                      - payeeChannel
                """);
    }

    @Test
    void onChannelEventMatchesYamlDefinition() {
        Node fromDsl = DocBuilder.doc()
                .name("Channel event parity")
                .channel("ownerChannel")
                .field("/counter", 0)
                .onChannelEvent("onIncrementEvent", "ownerChannel", Integer.class,
                        steps -> steps.replaceValue("SetCounter", "/counter", 1))
                .buildDocument();

        assertDslMatchesYaml(fromDsl, """
                name: Channel event parity
                counter: 0
                contracts:
                  ownerChannel:
                    type: Core/Channel
                  onIncrementEvent:
                    type: Conversation/Sequential Workflow
                    channel: ownerChannel
                    event:
                      type: Integer
                    steps:
                      - name: SetCounter
                        type: Conversation/Update Document
                        changeset:
                          - op: replace
                            path: /counter
                            val: 1
                """);
    }

    @Test
    void channelTemplateCanBeSpecializedToMyOsAdminChannel() {
        Node template = DocBuilder.doc()
                .name("Channel template")
                .channel("adminChannel")
                .buildDocument();

        Node specialized = DocBuilder.from(template)
                .channel("adminChannel", new MyOsTimelineChannel()
                        .timelineId("session-42")
                        .accountId("acc-42")
                        .email("admin@company.com"))
                .buildDocument();

        assertNotSame(template, specialized);
        assertEquals("Core/Channel",
                template.getAsText("/contracts/adminChannel/type/value"));
        assertDslMatchesYaml(specialized, """
                name: Channel template
                contracts:
                  adminChannel:
                    type: MyOS/MyOS Timeline Channel
                    timelineId: session-42
                    accountId: acc-42
                    email: admin@company.com
                """);
    }
}
