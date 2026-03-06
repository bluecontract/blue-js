package blue.language.sdk.dsl;

import blue.language.model.Node;
import blue.language.sdk.DocBuilder;
import org.junit.jupiter.api.Test;

import static blue.language.sdk.dsl.DslParityAssertions.assertDslMatchesYaml;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class DocBuilderSectionsDslParityTest {

    @Test
    void sectionsTrackRelatedFieldsAndContracts() {
        Node fromDsl = DocBuilder.doc()
                .name("Counter")
                .section("participants", "Participants", "Alice's timeline channel.")
                    .channel("aliceTimeline")
                .endSection()
                .section("counterOps", "Counter operations", "Counter with increment and decrement for Alice.")
                    .field("/counter", 0)
                    .operation("increment")
                        .channel("aliceTimeline")
                        .requestType(Integer.class)
                        .description("Increment the counter")
                        .steps(steps -> steps.replaceExpression(
                                "Inc",
                                "/counter",
                                "event.message.request + document('/counter')"))
                        .done()
                    .operation("decrement")
                        .channel("aliceTimeline")
                        .requestType(Integer.class)
                        .description("Decrement the counter")
                        .steps(steps -> steps.replaceExpression(
                                "Dec",
                                "/counter",
                                "document('/counter') - event.message.request"))
                        .done()
                .endSection()
                .buildDocument();

        assertDslMatchesYaml(fromDsl, """
                name: Counter
                counter: 0
                contracts:
                  aliceTimeline:
                    type: Core/Channel
                  participants:
                    type: Conversation/Document Section
                    title: Participants
                    summary: Alice's timeline channel.
                    relatedContracts:
                      - aliceTimeline
                  increment:
                    type: Conversation/Operation
                    channel: aliceTimeline
                    description: Increment the counter
                    request:
                      type: Integer
                  incrementImpl:
                    type: Conversation/Sequential Workflow Operation
                    operation: increment
                    steps:
                      - name: Inc
                        type: Conversation/Update Document
                        changeset:
                          - op: replace
                            path: /counter
                            val: ${event.message.request + document('/counter')}
                  decrement:
                    type: Conversation/Operation
                    channel: aliceTimeline
                    description: Decrement the counter
                    request:
                      type: Integer
                  decrementImpl:
                    type: Conversation/Sequential Workflow Operation
                    operation: decrement
                    steps:
                      - name: Dec
                        type: Conversation/Update Document
                        changeset:
                          - op: replace
                            path: /counter
                            val: ${document('/counter') - event.message.request}
                  counterOps:
                    type: Conversation/Document Section
                    title: Counter operations
                    summary: Counter with increment and decrement for Alice.
                    relatedFields:
                      - /counter
                    relatedContracts:
                      - increment
                      - incrementImpl
                      - decrement
                      - decrementImpl
                """);
    }

    @Test
    void buildFailsWhenSectionIsNotClosed() {
        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                DocBuilder.doc()
                        .name("Unclosed section")
                        .section("s1", "Section 1", "Missing end")
                        .channel("ownerChannel")
                        .buildDocument());

        assertEquals("Unclosed section: 's1'. Call endSection() before buildDocument().", ex.getMessage());
    }

    @Test
    void fieldBuilderSupportsValueTypeDescriptionAndBeanNodeValues() {
        Node fromDsl = DocBuilder.doc()
                .name("Field builder parity")
                .field("/x")
                    .type(Integer.class)
                    .description("Score")
                    .required(true)
                    .minimum(0)
                    .maximum(100)
                    .value(42)
                    .done()
                .field("/profile", new Profile().name("Alice").score(7))
                .field("/meta", new Node().properties("source", new Node().value("manual")))
                .field("/trackedOnly")
                    .done()
                .buildDocument();

        assertEquals("Integer", fromDsl.getAsText("/x/type/value"));
        assertEquals("Score", fromDsl.getAsText("/x/description"));
        assertEquals(42, fromDsl.getAsInteger("/x/value"));
        Node xNode = fromDsl.getProperties().get("x");
        assertEquals(Boolean.TRUE, xNode.getConstraints().getRequiredValue());
        assertEquals("0", String.valueOf(xNode.getConstraints().getMinimumValue()));
        assertEquals("100", String.valueOf(xNode.getConstraints().getMaximumValue()));

        assertEquals("Alice", fromDsl.getAsText("/profile/name/value"));
        assertEquals(7, fromDsl.getAsInteger("/profile/score/value"));
        assertEquals("manual", fromDsl.getAsText("/meta/source/value"));

        assertThrows(IllegalArgumentException.class, () -> fromDsl.getAsNode("/trackedOnly"));
    }

    static final class Profile {
        public String name;
        public int score;

        public Profile name(String name) {
            this.name = name;
            return this;
        }

        public Profile score(int score) {
            this.score = score;
            return this;
        }
    }
}
