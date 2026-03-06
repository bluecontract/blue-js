package blue.language.processor;

import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

class DocumentProcessingRuntimeDirectWriteTest {

    @Test
    void directWriteRejectsInvalidPointerPaths() {
        DocumentProcessingRuntime runtime = new DocumentProcessingRuntime(new Node());
        Node value = new Node().value("x");

        assertThrows(IllegalArgumentException.class, () -> runtime.directWrite(null, value));
        assertThrows(IllegalArgumentException.class, () -> runtime.directWrite("", value));
        assertThrows(IllegalArgumentException.class, () -> runtime.directWrite("x", value));
        assertThrows(IllegalArgumentException.class, () -> runtime.directWrite("/x~2", value));
    }

    @Test
    void directWriteRejectsRootPointer() {
        DocumentProcessingRuntime runtime = new DocumentProcessingRuntime(new Node());
        assertThrows(IllegalArgumentException.class, () -> runtime.directWrite("/", new Node().value("x")));
    }

    @Test
    void directWriteSupportsEscapedPointerSegments() {
        Node document = new Node();
        DocumentProcessingRuntime runtime = new DocumentProcessingRuntime(document);

        runtime.directWrite("/a~1b", new Node().value("slash"));
        runtime.directWrite("/a~0b", new Node().value("tilde"));

        assertEquals("slash", document.getProperties().get("a/b").getValue());
        assertEquals("tilde", document.getProperties().get("a~b").getValue());
    }

    @Test
    void directWriteRejectsNonNumericArraySegments() {
        Node document = new Node().properties("list", new Node().items(new Node().value("x")));
        DocumentProcessingRuntime runtime = new DocumentProcessingRuntime(document);

        assertThrows(IllegalStateException.class, () -> runtime.directWrite("/list/key", new Node().value("y")));
        assertThrows(IllegalStateException.class, () -> runtime.directWrite("/list/01", new Node().value("y")));
    }

    @Test
    void directWritePrefersNumericPropertyOverArrayIndexWhenParentHasBoth() {
        Node mixed = new Node()
                .items(new Node().value("item-zero"))
                .properties("0", new Node().value("property-zero"));
        Node document = new Node().properties("mixed", mixed);
        DocumentProcessingRuntime runtime = new DocumentProcessingRuntime(document);

        runtime.directWrite("/mixed/0", new Node().value("property-updated"));

        Node mixedAfter = document.getProperties().get("mixed");
        assertEquals("property-updated", mixedAfter.getProperties().get("0").getValue());
        assertEquals("item-zero", mixedAfter.getItems().get(0).getValue());
    }

    @Test
    void directWriteNullPrefersNumericPropertyOverArrayIndexWhenParentHasBoth() {
        Node mixed = new Node()
                .items(new Node().value("item-zero"))
                .properties("0", new Node().value("property-zero"));
        Node document = new Node().properties("mixed", mixed);
        DocumentProcessingRuntime runtime = new DocumentProcessingRuntime(document);

        runtime.directWrite("/mixed/0", null);

        Node mixedAfter = document.getProperties().get("mixed");
        assertFalse(mixedAfter.getProperties().containsKey("0"));
        assertEquals("item-zero", mixedAfter.getItems().get(0).getValue());
    }

    @Test
    void directWriteNumericLeafUsesArrayWhenMixedParentHasNoMatchingProperty() {
        Node mixed = new Node()
                .items(new Node().value("item-zero"), new Node().value("item-one"))
                .properties("existing", new Node().value("keep"));
        Node document = new Node().properties("mixed", mixed);
        DocumentProcessingRuntime runtime = new DocumentProcessingRuntime(document);

        runtime.directWrite("/mixed/1", new Node().value("item-one-updated"));

        Node mixedAfter = document.getProperties().get("mixed");
        assertEquals("item-one-updated", mixedAfter.getItems().get(1).getValue());
        assertEquals("keep", mixedAfter.getProperties().get("existing").getValue());
    }

    @Test
    void directWriteNumericLeafAppendsArrayWhenMixedParentHasNoMatchingProperty() {
        Node mixed = new Node()
                .items(new Node().value("item-zero"), new Node().value("item-one"))
                .properties("existing", new Node().value("keep"));
        Node document = new Node().properties("mixed", mixed);
        DocumentProcessingRuntime runtime = new DocumentProcessingRuntime(document);

        runtime.directWrite("/mixed/2", new Node().value("item-appended"));

        Node mixedAfter = document.getProperties().get("mixed");
        assertEquals("item-zero", mixedAfter.getItems().get(0).getValue());
        assertEquals("item-one", mixedAfter.getItems().get(1).getValue());
        assertEquals("item-appended", mixedAfter.getItems().get(2).getValue());
        assertEquals("keep", mixedAfter.getProperties().get("existing").getValue());
    }

    @Test
    void directWriteNullNumericLeafUsesArrayRemovalWhenMixedParentHasNoMatchingProperty() {
        Node mixed = new Node()
                .items(new Node().value("item-zero"), new Node().value("item-one"))
                .properties("existing", new Node().value("keep"));
        Node document = new Node().properties("mixed", mixed);
        DocumentProcessingRuntime runtime = new DocumentProcessingRuntime(document);

        runtime.directWrite("/mixed/1", null);

        Node mixedAfter = document.getProperties().get("mixed");
        assertEquals(1, mixedAfter.getItems().size());
        assertEquals("item-zero", mixedAfter.getItems().get(0).getValue());
        assertEquals("keep", mixedAfter.getProperties().get("existing").getValue());
    }

    @Test
    void directWriteLeadingZeroNumericLeafUsesPropertyBranchWhenMixedParentHasPropertyMap() {
        Node mixed = new Node()
                .items(new Node().value("item-zero"), new Node().value("item-one"))
                .properties("existing", new Node().value("keep"));
        Node document = new Node().properties("mixed", mixed);
        DocumentProcessingRuntime runtime = new DocumentProcessingRuntime(document);

        runtime.directWrite("/mixed/01", new Node().value("property-leading-zero"));

        Node mixedAfter = document.getProperties().get("mixed");
        assertEquals("property-leading-zero", mixedAfter.getProperties().get("01").getValue());
        assertEquals("item-zero", mixedAfter.getItems().get(0).getValue());
        assertEquals("item-one", mixedAfter.getItems().get(1).getValue());
    }

    @Test
    void directWriteNullLeadingZeroNumericLeafUsesPropertyBranchWhenMixedParentHasPropertyMap() {
        Node mixed = new Node()
                .items(new Node().value("item-zero"), new Node().value("item-one"))
                .properties("01", new Node().value("property-leading-zero"))
                .properties("existing", new Node().value("keep"));
        Node document = new Node().properties("mixed", mixed);
        DocumentProcessingRuntime runtime = new DocumentProcessingRuntime(document);

        runtime.directWrite("/mixed/01", null);

        Node mixedAfter = document.getProperties().get("mixed");
        assertFalse(mixedAfter.getProperties().containsKey("01"));
        assertEquals("item-zero", mixedAfter.getItems().get(0).getValue());
        assertEquals("item-one", mixedAfter.getItems().get(1).getValue());
        assertEquals("keep", mixedAfter.getProperties().get("existing").getValue());
    }

    @Test
    void directWriteUsesPropertyBranchForNonNumericLeafOnMixedParent() {
        Node mixed = new Node()
                .items(new Node().value("item-zero"))
                .properties("existing", new Node().value("keep"));
        Node document = new Node().properties("mixed", mixed);
        DocumentProcessingRuntime runtime = new DocumentProcessingRuntime(document);

        runtime.directWrite("/mixed/key", new Node().value("property-value"));

        Node mixedAfter = document.getProperties().get("mixed");
        assertEquals("property-value", mixedAfter.getProperties().get("key").getValue());
        assertEquals("keep", mixedAfter.getProperties().get("existing").getValue());
        assertEquals("item-zero", mixedAfter.getItems().get(0).getValue());
    }
}
