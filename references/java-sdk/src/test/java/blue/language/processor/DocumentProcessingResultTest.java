package blue.language.processor;

import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DocumentProcessingResultTest {

    @Test
    void successFactoryBuildsImmutableSuccessResult() {
        Node document = new Node().properties("name", new Node().value("doc"));
        List<Node> events = new ArrayList<>();
        events.add(new Node().value("event"));

        DocumentProcessingResult result = DocumentProcessingResult.of(document, events, 42L);

        assertFalse(result.capabilityFailure());
        assertNull(result.failureReason());
        assertEquals(42L, result.totalGas());
        assertEquals(1, result.triggeredEvents().size());

        events.clear();
        assertEquals(1, result.triggeredEvents().size());
        assertThrows(UnsupportedOperationException.class, () -> result.triggeredEvents().add(new Node()));
    }

    @Test
    void capabilityFailureFactoryBuildsFailureResult() {
        Node document = new Node().properties("name", new Node().value("doc"));
        DocumentProcessingResult result = DocumentProcessingResult.capabilityFailure(document, "unsupported contract");

        assertTrue(result.capabilityFailure());
        assertEquals("unsupported contract", result.failureReason());
        assertEquals(0L, result.totalGas());
        assertTrue(result.triggeredEvents().isEmpty());
    }
}
