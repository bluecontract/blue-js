package blue.language.sdk.structure;

import blue.language.Blue;
import blue.language.model.Node;
import blue.language.sdk.DocBuilder;
import blue.language.sdk.patch.ChangeRequestApplier;
import blue.language.sdk.patch.ChangeRequestCompiler;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

import java.util.List;

import static blue.language.utils.UncheckedObjectMapper.JSON_MAPPER;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CounterCreationAndEditPipelineTest {

    private static final Blue BLUE = new Blue();

    @Test
    void creationProducesValidDocumentAndStorableDsl() {
        Node document = createCounterViaLlmDsl();

        assertEquals("Counter", document.getName());
        assertNotNull(getContract(document, "ownerChannel"));
        assertNotNull(getContract(document, "incrementByOne"));
        assertNotNull(getContract(document, "incrementByOneImpl"));
        assertEquals("0", String.valueOf(getRootFieldValue(document, "counter")));

        String storedDsl = DslGenerator.generate(document);
        assertNotNull(storedDsl);
        assertTrue(storedDsl.contains(".name(\"Counter\")"));
        assertTrue(storedDsl.contains(".operation(\"incrementByOne\")"));
        assertTrue(storedDsl.contains(".channel(\"ownerChannel\")"));
        assertTrue(storedDsl.contains("document('/counter') + 1"));

        Node changeRequest = ChangeRequestCompiler.compile(new Node(), document);
        Node applied = ChangeRequestApplier.apply(new Node(), changeRequest);
        assertCanonicalEquals(applied, document);
    }

    @Test
    void editWithStoredDslProducesCorrectChangeRequest() {
        Node beforeEdit = createCounterViaLlmDsl();
        Node afterEdit = applyDecrementEdit(beforeEdit.clone());

        assertEquals(
                "Simple counter with increment and decrement operations for owner.",
                afterEdit.getDescription());
        assertNotNull(getContract(afterEdit, "incrementByOne"));
        assertNotNull(getContract(afterEdit, "incrementByOneImpl"));
        assertNotNull(getContract(afterEdit, "decrementByOne"));
        assertNotNull(getContract(afterEdit, "decrementByOneImpl"));

        Node changeRequest = ChangeRequestCompiler.compile(beforeEdit, afterEdit);
        assertChangesetContains(changeRequest, "replace", "/description");
        assertChangesetHasNoContractPaths(changeRequest);
        assertSectionModifyKey(changeRequest, "counterOps");
        assertSectionChangesIncludeContract(changeRequest, "incrementByOne");
        assertSectionChangesIncludeContract(changeRequest, "decrementByOne");

        Node applied = ChangeRequestApplier.apply(beforeEdit.clone(), changeRequest);
        assertCanonicalEquals(applied, afterEdit);

        String newStoredDsl = DslGenerator.generate(afterEdit);
        assertTrue(newStoredDsl.contains(".operation(\"incrementByOne\")"));
        assertTrue(newStoredDsl.contains(".operation(\"decrementByOne\")"));
        assertTrue(newStoredDsl.contains("document('/counter') - 1"));
    }

    @Test
    void editWithStubDslProducesSameResultAsStoredDslPath() {
        Node document = createCounterViaLlmDsl();
        String stubDsl = DslStubGenerator.generate(document);
        assertNotNull(stubDsl);
        assertTrue(stubDsl.contains(".operation(\"incrementByOne\")"));
        assertTrue(stubDsl.contains(".channel(\"ownerChannel\")"));
        assertFalse(stubDsl.contains("document('/counter') + 1"));
        assertTrue(stubDsl.contains("// implementation in document JSON"));

        Node afterEdit = applyDecrementEdit(document.clone());
        Node afterEditFromStoredDsl = applyDecrementEdit(createCounterViaLlmDsl().clone());
        assertCanonicalEquals(afterEdit, afterEditFromStoredDsl);

        Node cr1 = ChangeRequestCompiler.compile(document, afterEdit);
        Node cr2 = ChangeRequestCompiler.compile(createCounterViaLlmDsl(), afterEditFromStoredDsl);
        assertCanonicalEquals(cr1, cr2);
    }

    @Test
    void regeneratedDslAfterEditPreservesAllContent() {
        Node original = createCounterViaLlmDsl();
        Node edited = applyDecrementEdit(original.clone());

        String regenerated = DslGenerator.generate(edited);
        assertTrue(regenerated.contains(".operation(\"incrementByOne\")"));
        assertTrue(regenerated.contains("document('/counter') + 1"));
        assertTrue(regenerated.contains(".operation(\"decrementByOne\")"));
        assertTrue(regenerated.contains("document('/counter') - 1"));
        assertTrue(regenerated.contains("increment and decrement"));
        assertTrue(regenerated.contains(".field(\"/counter\""));
        assertTrue(regenerated.contains(".section(\"counterOps\""));
        assertTrue(regenerated.contains(".section(\"participants\""));
    }

    @Test
    void multipleSequentialEditsProduceCorrectFinalState() {
        Node v1 = createCounterViaLlmDsl();
        Node v2 = applyDecrementEdit(v1.clone());
        Node v3 = DocBuilder.from(v2.clone())
                .operation("reset")
                .channel("ownerChannel")
                .description("Reset counter to zero")
                .noRequest()
                .steps(steps -> steps.replaceValue("Reset", "/counter", 0))
                .done()
                .buildDocument();
        Node v4 = DocBuilder.from(v3.clone())
                .replace("/counter", 100)
                .buildDocument();

        assertNotNull(getContract(v4, "incrementByOne"));
        assertNotNull(getContract(v4, "decrementByOne"));
        assertNotNull(getContract(v4, "reset"));
        assertEquals("100", String.valueOf(getRootFieldValue(v4, "counter")));

        Node totalCr = ChangeRequestCompiler.compile(v1, v4);
        Node applied = ChangeRequestApplier.apply(v1.clone(), totalCr);
        assertCanonicalEquals(applied, v4);

        String finalDsl = DslGenerator.generate(v4);
        assertTrue(finalDsl.contains(".operation(\"incrementByOne\")"));
        assertTrue(finalDsl.contains(".operation(\"decrementByOne\")"));
        assertTrue(finalDsl.contains(".operation(\"reset\")"));
        assertTrue(finalDsl.contains("100"));
    }

    @Test
    void fullLifecycleFromCreationThroughStoredAndStubEdits() {
        Node created = createCounterViaLlmDsl();

        String storedDsl = DslGenerator.generate(created);
        assertNotNull(storedDsl);
        Node creationCr = ChangeRequestCompiler.compile(new Node(), created);
        Node appliedCreation = ChangeRequestApplier.apply(new Node(), creationCr);
        assertCanonicalEquals(appliedCreation, created);

        Node edited = applyDecrementEdit(created.clone());
        Node editCr = ChangeRequestCompiler.compile(created, edited);
        assertChangesetContains(editCr, "replace", "/description");
        assertSectionModifyKey(editCr, "counterOps");
        assertChangesetHasNoContractPaths(editCr);
        Node appliedEdit = ChangeRequestApplier.apply(created.clone(), editCr);
        assertCanonicalEquals(appliedEdit, edited);

        String regeneratedStoredDsl = DslGenerator.generate(edited);
        assertTrue(regeneratedStoredDsl.contains(".operation(\"incrementByOne\")"));
        assertTrue(regeneratedStoredDsl.contains(".operation(\"decrementByOne\")"));
        assertTrue(regeneratedStoredDsl.contains(".section(\"counterOps\""));
        assertTrue(regeneratedStoredDsl.contains(".section(\"participants\""));
        storedDsl = regeneratedStoredDsl;
        assertNotNull(storedDsl);

        String stubDsl = DslStubGenerator.generate(edited);
        assertTrue(stubDsl.contains(".operation(\"incrementByOne\")"));
        assertTrue(stubDsl.contains(".operation(\"decrementByOne\")"));
        assertFalse(stubDsl.contains("document('/counter') + 1"));
        assertFalse(stubDsl.contains("document('/counter') - 1"));
        assertTrue(stubDsl.contains("// implementation in document JSON"));

        Node withReset = DocBuilder.from(edited.clone())
                .section("counterOps")
                .operation("reset")
                    .channel("ownerChannel")
                    .description("Reset counter to zero")
                    .noRequest()
                    .steps(steps -> steps.replaceValue("Reset", "/counter", 0))
                    .done()
                .endSection()
                .buildDocument();
        Node resetCr = ChangeRequestCompiler.compile(edited, withReset);
        Node appliedReset = ChangeRequestApplier.apply(edited.clone(), resetCr);
        assertCanonicalEquals(appliedReset, withReset);

        String finalDsl = DslGenerator.generate(withReset);
        assertNotNull(getContract(withReset, "incrementByOne"));
        assertNotNull(getContract(withReset, "decrementByOne"));
        assertNotNull(getContract(withReset, "reset"));
        assertTrue(finalDsl.contains(".operation(\"incrementByOne\")"));
        assertTrue(finalDsl.contains(".operation(\"decrementByOne\")"));
        assertTrue(finalDsl.contains(".operation(\"reset\")"));
        assertTrue(finalDsl.contains("document('/counter') + 1"));
        assertTrue(finalDsl.contains("document('/counter') - 1"));
        assertTrue(finalDsl.contains(".replaceValue(\"Reset\", \"/counter\", 0)"));
        assertTrue(finalDsl.contains(".section(\"counterOps\""));
        assertTrue(finalDsl.contains(".section(\"participants\""));
    }

    private static Node createCounterViaLlmDsl() {
        return DocBuilder.doc()
                .name("Counter")
                .description("Simple counter with increment operation for owner.")
                .section("participants", "Participants", "Document owner")
                .channel("ownerChannel")
                .endSection()
                .section("counterOps", "Counter", "Owner can increment counter by one.")
                .field("/counter", 0)
                .operation("incrementByOne")
                    .channel("ownerChannel")
                    .description("Increment counter by one")
                    .noRequest()
                    .steps(steps -> steps.replaceExpression("Inc", "/counter", "document('/counter') + 1"))
                    .done()
                .endSection()
                .buildDocument();
    }

    private static Node applyDecrementEdit(Node currentNode) {
        return DocBuilder.from(currentNode)
                .description("Simple counter with increment and decrement operations for owner.")
                .section("counterOps")
                .operation("decrementByOne")
                    .channel("ownerChannel")
                    .description("Decrement counter by one")
                    .noRequest()
                    .steps(steps -> steps.replaceExpression("Dec", "/counter", "document('/counter') - 1"))
                    .done()
                .endSection()
                .buildDocument();
    }

    private static Node getContract(Node document, String key) {
        Node contracts = document.getProperties() == null ? null : document.getProperties().get("contracts");
        if (contracts == null || contracts.getProperties() == null) {
            return null;
        }
        return contracts.getProperties().get(key);
    }

    private static Object getRootFieldValue(Node document, String field) {
        Node root = document.getProperties() == null ? null : document.getProperties().get(field);
        return root == null ? null : root.getValue();
    }

    private static void assertChangesetContains(Node changeRequest, String op, String path) {
        List<Node> entries = readItems(changeRequest, "/changeset");
        assertTrue(entries.stream().anyMatch(entry -> {
            String entryOp = readText(entry, "op");
            String entryPath = readText(entry, "path");
            return op.equals(entryOp) && path.equals(entryPath);
        }));
    }

    private static void assertChangesetHasNoContractPaths(Node changeRequest) {
        for (Node entry : readItems(changeRequest, "/changeset")) {
            String path = readText(entry, "path");
            assertFalse(path != null && path.startsWith("/contracts"),
                    "Changeset contains forbidden contracts path: " + path);
        }
    }

    private static void assertSectionChangesIncludeContract(Node changeRequest, String contractKey) {
        Node sectionChanges = readNode(changeRequest, "sectionChanges");
        assertNotNull(sectionChanges);
        boolean found = false;
        for (Node entry : readItems(sectionChanges, "add")) {
            found = found || hasContract(entry, contractKey);
        }
        for (Node entry : readItems(sectionChanges, "modify")) {
            found = found || hasContract(entry, contractKey);
        }
        assertTrue(found, "Contract not present in section changes: " + contractKey);
    }

    private static void assertSectionModifyKey(Node changeRequest, String sectionKey) {
        Node sectionChanges = readNode(changeRequest, "sectionChanges");
        assertNotNull(sectionChanges);
        boolean found = false;
        for (Node entry : readItems(sectionChanges, "modify")) {
            String key = readText(entry, "sectionKey");
            if (sectionKey.equals(key)) {
                found = true;
                break;
            }
        }
        assertTrue(found, "Missing sectionChanges.modify entry for section key: " + sectionKey);
    }

    private static boolean hasContract(Node sectionEntry, String key) {
        Node contracts = readNode(sectionEntry, "contracts");
        return contracts != null && contracts.getProperties() != null && contracts.getProperties().containsKey(key);
    }

    private static List<Node> readItems(Node parent, String key) {
        if (key.startsWith("/")) {
            Object raw = parent.get(key);
            if (raw instanceof Node node && node.getItems() != null) {
                return node.getItems();
            }
            return List.of();
        }
        Node node = readNode(parent, key);
        if (node == null || node.getItems() == null) {
            return List.of();
        }
        return node.getItems();
    }

    private static Node readNode(Node parent, String key) {
        if (parent == null || parent.getProperties() == null) {
            return null;
        }
        return parent.getProperties().get(key);
    }

    private static String readText(Node parent, String key) {
        Node node = readNode(parent, key);
        if (node == null || node.getValue() == null) {
            return null;
        }
        return String.valueOf(node.getValue());
    }

    private static void assertCanonicalEquals(Node actual, Node expected) {
        Node expectedCanonical = BLUE.preprocess(expected.clone());
        Node actualCanonical = BLUE.preprocess(actual.clone());
        JsonNode expectedTree = JSON_MAPPER.readTree(BLUE.nodeToSimpleJson(expectedCanonical));
        JsonNode actualTree = JSON_MAPPER.readTree(BLUE.nodeToSimpleJson(actualCanonical));
        assertEquals(expectedTree, actualTree);
    }
}
