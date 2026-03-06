package blue.language.processor;

import blue.language.model.Node;
import blue.language.processor.model.JsonPatch;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class PatchEngineParityTest {

    @Test
    void appliesAddPatchAndRecordsBeforeAfterSnapshots() {
        Node document = new Node().properties("name", new Node().value("Initial"));
        PatchEngine engine = new PatchEngine(document);

        PatchEngine.PatchResult result = engine.applyPatch(
                "/",
                JsonPatch.add("/status", new Node().value("ACTIVE")));

        assertNull(result.before());
        assertEquals("ACTIVE", String.valueOf(result.after().getValue()));
        assertEquals("/", result.cascadeScopes().get(0));
        assertNotNull(document.getProperties().get("status"));
    }

    @Test
    void appliesRemovePatchReturningPriorState() {
        Node document = new Node().properties("status", new Node().value("ACTIVE"));
        PatchEngine engine = new PatchEngine(document);

        PatchEngine.PatchResult result = engine.applyPatch("/", JsonPatch.remove("/status"));

        assertNotNull(result.before());
        assertNull(result.after());
        assertNull(document.getProperties().get("status"));
    }

    @Test
    void supportsDirectWriteForObjectsAndArrays() {
        List<Node> items = new ArrayList<>();
        items.add(new Node().properties("value", new Node().value("one")));
        Node document = new Node()
                .properties("status", new Node().value("old"))
                .properties("items", new Node().items(items));
        PatchEngine engine = new PatchEngine(document);

        engine.directWrite("/status", new Node().value("updated"));
        engine.directWrite("/items/1", new Node().properties("value", new Node().value("two")));
        engine.directWrite("/items/0", null);

        assertEquals("updated", String.valueOf(document.getProperties().get("status").getValue()));
        assertEquals("two", String.valueOf(document.getProperties().get("items").getItems().get(0).getProperties().get("value").getValue()));
    }
}
