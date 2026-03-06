package blue.language.processor;

import blue.language.model.Node;
import blue.language.processor.model.JsonPatch;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DocumentProcessingRuntimeParityTest {

    @Test
    void tracksGasChargesAndPatchApplication() {
        Node document = new Node().properties("status", new Node().value("NEW"));
        DocumentProcessingRuntime runtime = new DocumentProcessingRuntime(document);

        runtime.chargeInitialization();
        runtime.chargeScopeEntry("/child");

        DocumentProcessingRuntime.DocumentUpdateData update = runtime.applyPatch(
                "/",
                JsonPatch.replace("/status", new Node().value("UPDATED")));

        assertNotNull(update.after());
        assertEquals("UPDATED", String.valueOf(update.after().getValue()));
        assertEquals("/", update.originScope());
        assertEquals(1, update.cascadeScopes().size());
        assertEquals("/", update.cascadeScopes().get(0));
        assertEquals("UPDATED", String.valueOf(runtime.document().getProperties().get("status").getValue()));
        assertTrue(runtime.totalGas() > 0);
    }

    @Test
    void managesRuntimeScopesEmissionsAndDirectWrites() {
        Node document = new Node()
                .properties("list", new Node().items(
                        new Node().properties("value", new Node().value("one"))));
        DocumentProcessingRuntime runtime = new DocumentProcessingRuntime(document);

        ScopeRuntimeContext scope = runtime.scope("/child");
        scope.enqueueTriggered(new Node().properties("event", new Node().value(1)));
        runtime.recordRootEmission(new Node().properties("eventType", new Node().value("Lifecycle")));

        runtime.directWrite("/list/1", new Node().properties("value", new Node().value("two")));
        runtime.directWrite("/list/0", null);

        assertEquals(1, runtime.rootEmissions().size());
        assertSame(scope, runtime.scope("/child"));
        assertNull(runtime.existingScope("/missing"));
        assertEquals("two", String.valueOf(runtime.document()
                .getProperties().get("list").getItems().get(0).getProperties().get("value").getValue()));

        runtime.markRunTerminated();
        assertTrue(runtime.isRunTerminated());
        assertEquals(1, scope.triggeredSize());
    }
}
