package blue.language.sdk.patch;

import blue.language.Blue;
import blue.language.model.Node;
import blue.language.sdk.DocBuilder;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;

import static blue.language.utils.UncheckedObjectMapper.JSON_MAPPER;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PatchSetTest {

    private static final Blue BLUE = new Blue();

    @Test
    void addOneRootFieldProducesSingleAddEntryAndApplies() {
        Node before = DocBuilder.doc().name("Doc").field("/counter", 1).buildDocument();
        Node after = DocBuilder.from(before.clone()).field("/status", "ready").buildDocument();

        PatchSet patch = PatchSet.diff(before, after, DiffScope.ROOT_FIELDS_ONLY);
        assertEquals(1, patch.entries.size());
        assertEquals("add", patch.entries.get(0).op);
        assertEquals("/status", patch.entries.get(0).path);
        assertCanonicalEquals(patch.apply(before.clone()), after);
    }

    @Test
    void replaceScalarFieldProducesSingleReplaceEntry() {
        Node before = DocBuilder.doc().name("Doc").field("/counter", 1).buildDocument();
        Node after = DocBuilder.from(before.clone()).replace("/counter", 2).buildDocument();

        PatchSet patch = PatchSet.diff(before, after, DiffScope.ROOT_FIELDS_ONLY);
        assertEquals(1, patch.entries.size());
        assertEquals("replace", patch.entries.get(0).op);
        assertEquals("/counter", patch.entries.get(0).path);
    }

    @Test
    void removeFieldProducesSingleRemoveEntry() {
        Node before = DocBuilder.doc().name("Doc").field("/counter", 1).field("/status", "ready").buildDocument();
        Node after = DocBuilder.from(before.clone()).remove("/status").buildDocument();

        PatchSet patch = PatchSet.diff(before, after, DiffScope.ROOT_FIELDS_ONLY);
        assertEquals(1, patch.entries.size());
        assertEquals("remove", patch.entries.get(0).op);
        assertEquals("/status", patch.entries.get(0).path);
    }

    @Test
    void nestedObjectChangesReplaceWholeObject() {
        Node before = DocBuilder.doc()
                .name("Doc")
                .field("/settings", new Node().properties("a", new Node().value(1)))
                .buildDocument();
        Node after = DocBuilder.doc()
                .name("Doc")
                .field("/settings", new Node().properties("a", new Node().value(2)).properties("b", new Node().value(true)))
                .buildDocument();

        PatchSet patch = PatchSet.diff(before, after, DiffScope.ROOT_FIELDS_ONLY);
        assertEquals(1, patch.entries.size());
        assertEquals("replace", patch.entries.get(0).op);
        assertEquals("/settings", patch.entries.get(0).path);
    }

    @Test
    void mixedAddReplaceRemoveProducesThreeEntriesAndApplies() {
        Node before = DocBuilder.doc()
                .name("Doc")
                .field("/a", 1)
                .field("/b", 2)
                .field("/c", 3)
                .buildDocument();
        Node after = DocBuilder.doc()
                .name("Doc")
                .field("/a", 1)
                .field("/b", 20)
                .field("/d", 4)
                .buildDocument();

        PatchSet patch = PatchSet.diff(before, after, DiffScope.ROOT_FIELDS_ONLY);
        assertEquals(3, patch.entries.size());
        assertCanonicalEquals(patch.apply(before.clone()), after);
    }

    @Test
    void noChangesProducesEmptyPatch() {
        Node before = DocBuilder.doc().name("Doc").field("/counter", 1).buildDocument();
        Node after = before.clone();

        PatchSet patch = PatchSet.diff(before, after, DiffScope.ROOT_FIELDS_ONLY);
        assertTrue(patch.entries.isEmpty());
    }

    @Test
    void arrayChangeReplacesWholeArray() {
        Node before = new Node().properties(new LinkedHashMap<String, Node>());
        before.getProperties().put("values", listNode(1, 2, 3));
        Node after = new Node().properties(new LinkedHashMap<String, Node>());
        after.getProperties().put("values", listNode(1, 3, 5));

        PatchSet patch = PatchSet.diff(before, after, DiffScope.ROOT_FIELDS_ONLY);
        assertEquals(1, patch.entries.size());
        assertEquals("replace", patch.entries.get(0).op);
        assertEquals("/values", patch.entries.get(0).path);
    }

    @Test
    void contractsDiffDetectsAddedContract() {
        Node before = counterDoc();
        Node after = DocBuilder.from(before.clone())
                .operation("reset")
                    .channel("ownerChannel")
                    .description("Reset")
                    .steps(steps -> steps.replaceValue("Set", "/counter", 0))
                    .done()
                .buildDocument();

        PatchSet patch = PatchSet.diff(before, after, DiffScope.CONTRACTS_ONLY);
        assertTrue(patch.entries.stream().anyMatch(entry -> "add".equals(entry.op) && "reset".equals(entry.path)));
    }

    @Test
    void contractsDiffDetectsRemovedContract() {
        Node before = counterDoc();
        Node after = DocBuilder.from(before.clone()).remove("/contracts/incrementImpl").buildDocument();

        PatchSet patch = PatchSet.diff(before, after, DiffScope.CONTRACTS_ONLY);
        assertTrue(patch.entries.stream().anyMatch(entry -> "remove".equals(entry.op) && "incrementImpl".equals(entry.path)));
    }

    @Test
    void contractsDiffDetectsModifiedContract() {
        Node before = counterDoc();
        Node after = DocBuilder.from(before.clone())
                .operation("increment")
                    .channel("ownerChannel")
                    .description("Increment with new behavior")
                    .requestType(Integer.class)
                    .steps(steps -> steps.replaceExpression("Apply", "/counter", "document('/counter') + (event.message.request * 2)"))
                    .done()
                .buildDocument();

        PatchSet patch = PatchSet.diff(before, after, DiffScope.CONTRACTS_ONLY);
        assertTrue(patch.entries.stream().anyMatch(entry -> "replace".equals(entry.op) && "increment".equals(entry.path)));
    }

    @Test
    void rootFieldsOnlySkipsContracts() {
        Node before = counterDoc();
        Node after = DocBuilder.from(before.clone()).remove("/contracts/incrementImpl").buildDocument();

        PatchSet patch = PatchSet.diff(before, after, DiffScope.ROOT_FIELDS_ONLY);
        assertTrue(patch.entries.isEmpty());
    }

    @Test
    void applyRoundTripMatchesModifiedDocument() {
        Node before = DocBuilder.doc()
                .name("Roundtrip")
                .field("/count", 1)
                .field("/state", "idle")
                .buildDocument();
        Node after = DocBuilder.from(before.clone())
                .replace("/count", 5)
                .remove("/state")
                .field("/done", true)
                .buildDocument();

        PatchSet patch = PatchSet.diff(before, after, DiffScope.ROOT_FIELDS_ONLY);
        Node applied = patch.apply(before.clone());
        assertCanonicalEquals(applied, after);
    }

    private static Node counterDoc() {
        return DocBuilder.doc()
                .name("Counter")
                .field("/counter", 0)
                .channel("ownerChannel")
                .operation("increment")
                    .channel("ownerChannel")
                    .description("Increment")
                    .requestType(Integer.class)
                    .steps(steps -> steps.replaceExpression("Apply", "/counter", "document('/counter') + event.message.request"))
                    .done()
                .buildDocument();
    }

    private static Node listNode(int... values) {
        Node list = new Node().items(new ArrayList<Node>());
        for (int value : values) {
            list.getItems().add(new Node().value(value));
        }
        return list;
    }

    private static void assertCanonicalEquals(Node actual, Node expected) {
        Node expectedCanonical = BLUE.preprocess(expected.clone());
        Node actualCanonical = BLUE.preprocess(actual.clone());
        JsonNode expectedTree = JSON_MAPPER.readTree(BLUE.nodeToSimpleJson(expectedCanonical));
        JsonNode actualTree = JSON_MAPPER.readTree(BLUE.nodeToSimpleJson(actualCanonical));
        assertEquals(expectedTree, actualTree);
    }
}
