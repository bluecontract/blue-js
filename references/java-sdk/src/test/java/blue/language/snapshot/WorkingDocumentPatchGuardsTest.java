package blue.language.snapshot;

import blue.language.Blue;
import blue.language.model.Node;
import blue.language.processor.model.JsonPatch;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WorkingDocumentPatchGuardsTest {

    @Test
    void rejectsMutatingBlueIdDirectly() {
        Blue blue = new Blue();
        ResolvedSnapshot snapshot = blue.resolveToSnapshot(blue.yamlToNode("name: Guarded\nx: 1\n"));

        WorkingDocument workingDocument = WorkingDocument.forSnapshot(blue, snapshot);
        assertThrows(UnsupportedOperationException.class,
                () -> workingDocument.applyPatch(JsonPatch.replace("/blueId", new Node().value("illegal"))));
    }

    @Test
    void rejectsMutatingTypeInternals() {
        Blue blue = new Blue();
        ResolvedSnapshot snapshot = blue.resolveToSnapshot(
                blue.yamlToNode(
                        "name: Guarded\n" +
                                "x:\n" +
                                "  type: Integer\n" +
                                "  value: 1\n"
                )
        );

        WorkingDocument workingDocument = WorkingDocument.forSnapshot(blue, snapshot);
        assertThrows(UnsupportedOperationException.class,
                () -> workingDocument.applyPatch(JsonPatch.replace("/x/type/blueId", new Node().value("illegal"))));
    }

    @Test
    void allowsReplacingTypeNode() {
        Blue blue = new Blue();
        ResolvedSnapshot snapshot = blue.resolveToSnapshot(
                blue.yamlToNode(
                        "name: Guarded\n" +
                                "x:\n" +
                                "  type: Integer\n" +
                                "  value: 1\n"
                )
        );

        WorkingDocument workingDocument = WorkingDocument.forSnapshot(blue, snapshot);
        workingDocument.applyPatch(JsonPatch.replace("/x/type", new Node().blueId("5WNMiV9Knz63B4dVY5JtMyh3FB4FSGqv7ceScvuapdE1")));
        ResolvedSnapshot committed = workingDocument.commit();

        assertEquals("5WNMiV9Knz63B4dVY5JtMyh3FB4FSGqv7ceScvuapdE1",
                committed.resolvedRoot().toNode().getAsText("/x/type/blueId"));
    }

    @Test
    void rejectsMalformedPointerEscapes() {
        Blue blue = new Blue();
        ResolvedSnapshot snapshot = blue.resolveToSnapshot(blue.yamlToNode("name: Guarded\nx: 1\n"));

        WorkingDocument workingDocument = WorkingDocument.forSnapshot(blue, snapshot);
        assertThrows(IllegalArgumentException.class,
                () -> workingDocument.applyPatch(JsonPatch.replace("/x~", new Node().value("illegal"))));
    }

    @Test
    void rejectsLeadingZeroArrayIndexSegments() {
        Blue blue = new Blue();
        ResolvedSnapshot snapshot = blue.resolveToSnapshot(
                blue.yamlToNode(
                        "name: Guarded\n" +
                                "list:\n" +
                                "  - 1\n" +
                                "  - 2\n"
                )
        );

        WorkingDocument workingDocument = WorkingDocument.forSnapshot(blue, snapshot);
        assertThrows(IllegalStateException.class,
                () -> workingDocument.applyPatch(JsonPatch.replace("/list/01", new Node().value(99))));
    }

    @Test
    void prefersNumericPropertyOverArrayIndexWhenParentContainsBoth() {
        Blue blue = new Blue();
        Node node = new Node()
                .name("Guarded")
                .properties("mixed", new Node()
                        .items(new Node().value("item-zero"))
                        .properties("0", new Node().value("property-zero")));
        ResolvedSnapshot snapshot = blue.resolveToSnapshot(node);

        WorkingDocument workingDocument = WorkingDocument.forSnapshot(blue, snapshot);
        workingDocument.applyPatch(JsonPatch.replace("/mixed/0", new Node().value("property-updated")));
        ResolvedSnapshot committed = workingDocument.commit();

        Node mixed = committed.resolvedRoot().toNode().getProperties().get("mixed");
        assertEquals("property-updated", mixed.getProperties().get("0").getValue());
        assertEquals("item-zero", mixed.getItems().get(0).getValue());
    }

    @Test
    void numericLeafFallsBackToArrayWhenNoMatchingPropertyExists() {
        Blue blue = new Blue();
        Node node = new Node()
                .name("Guarded")
                .properties("mixed", new Node()
                        .items(new Node().value("item-zero"), new Node().value("item-one"))
                        .properties("existing", new Node().value("keep")));
        ResolvedSnapshot snapshot = blue.resolveToSnapshot(node);

        WorkingDocument workingDocument = WorkingDocument.forSnapshot(blue, snapshot);
        workingDocument.applyPatch(JsonPatch.replace("/mixed/1", new Node().value("item-one-updated")));
        ResolvedSnapshot committed = workingDocument.commit();

        Node mixed = committed.resolvedRoot().toNode().getProperties().get("mixed");
        assertEquals("item-one-updated", mixed.getItems().get(1).getValue());
        assertEquals("keep", mixed.getProperties().get("existing").getValue());
    }

    @Test
    void removeFallsBackToArrayWhenNoMatchingPropertyExists() {
        Blue blue = new Blue();
        Node node = new Node()
                .name("Guarded")
                .properties("mixed", new Node()
                        .items(new Node().value("item-zero"), new Node().value("item-one"))
                        .properties("existing", new Node().value("keep")));
        ResolvedSnapshot snapshot = blue.resolveToSnapshot(node);

        WorkingDocument workingDocument = WorkingDocument.forSnapshot(blue, snapshot);
        workingDocument.applyPatch(JsonPatch.remove("/mixed/1"));
        ResolvedSnapshot committed = workingDocument.commit();

        Node mixed = committed.resolvedRoot().toNode().getProperties().get("mixed");
        assertEquals(1, mixed.getItems().size());
        assertEquals("item-zero", mixed.getItems().get(0).getValue());
        assertEquals("keep", mixed.getProperties().get("existing").getValue());
    }

    @Test
    void leadingZeroNumericLeafUsesPropertyBranchWhenPropertyMapExists() {
        Blue blue = new Blue();
        Node node = new Node()
                .name("Guarded")
                .properties("mixed", new Node()
                        .items(new Node().value("item-zero"), new Node().value("item-one"))
                        .properties("existing", new Node().value("keep")));
        ResolvedSnapshot snapshot = blue.resolveToSnapshot(node);

        WorkingDocument workingDocument = WorkingDocument.forSnapshot(blue, snapshot);
        workingDocument.applyPatch(JsonPatch.replace("/mixed/01", new Node().value("property-leading-zero")));
        ResolvedSnapshot committed = workingDocument.commit();

        Node mixed = committed.resolvedRoot().toNode().getProperties().get("mixed");
        assertEquals("property-leading-zero", mixed.getProperties().get("01").getValue());
        assertEquals("item-zero", mixed.getItems().get(0).getValue());
        assertEquals("item-one", mixed.getItems().get(1).getValue());
    }

    @Test
    void allowsEscapedPropertyPointerSegments() {
        Blue blue = new Blue();
        Node node = new Node().name("Guarded").properties("a/b", new Node().value("before"));
        ResolvedSnapshot snapshot = blue.resolveToSnapshot(node);

        WorkingDocument workingDocument = WorkingDocument.forSnapshot(blue, snapshot);
        workingDocument.applyPatch(JsonPatch.replace("/a~1b", new Node().value("after")));
        ResolvedSnapshot committed = workingDocument.commit();

        assertEquals("after", committed.resolvedRoot().toNode().getProperties().get("a/b").getValue());
    }

    @Test
    void allowsTrailingEmptyPropertySegmentWhenKeyExists() {
        Blue blue = new Blue();
        Node node = new Node()
                .name("Guarded")
                .properties("scope", new Node().properties("", new Node().value("before")));
        ResolvedSnapshot snapshot = blue.resolveToSnapshot(node);

        WorkingDocument workingDocument = WorkingDocument.forSnapshot(blue, snapshot);
        workingDocument.applyPatch(JsonPatch.replace("/scope/", new Node().value("after")));
        ResolvedSnapshot committed = workingDocument.commit();

        assertEquals("after",
                committed.resolvedRoot().toNode().getProperties().get("scope").getProperties().get("").getValue());
    }

    @Test
    void rejectsPatchPathWithoutLeadingSlash() {
        Blue blue = new Blue();
        ResolvedSnapshot snapshot = blue.resolveToSnapshot(blue.yamlToNode("name: Guarded\nx: 1\n"));

        WorkingDocument workingDocument = WorkingDocument.forSnapshot(blue, snapshot);
        assertThrows(IllegalArgumentException.class,
                () -> workingDocument.applyPatch(JsonPatch.replace("x", new Node().value(2))));
    }

    @Test
    void rejectsEmptyPatchPath() {
        Blue blue = new Blue();
        ResolvedSnapshot snapshot = blue.resolveToSnapshot(blue.yamlToNode("name: Guarded\nx: 1\n"));

        WorkingDocument workingDocument = WorkingDocument.forSnapshot(blue, snapshot);
        assertThrows(IllegalArgumentException.class,
                () -> workingDocument.applyPatch(JsonPatch.replace("", new Node().value(2))));
    }

    @Test
    void removePrefersNumericPropertyOverArrayIndexWhenParentContainsBoth() {
        Blue blue = new Blue();
        Node node = new Node()
                .name("Guarded")
                .properties("mixed", new Node()
                        .items(new Node().value("item-zero"))
                        .properties("0", new Node().value("property-zero")));
        ResolvedSnapshot snapshot = blue.resolveToSnapshot(node);

        WorkingDocument workingDocument = WorkingDocument.forSnapshot(blue, snapshot);
        workingDocument.applyPatch(JsonPatch.remove("/mixed/0"));
        ResolvedSnapshot committed = workingDocument.commit();

        Node mixed = committed.resolvedRoot().toNode().getProperties().get("mixed");
        assertFalse(mixed.getProperties().containsKey("0"));
        assertEquals("item-zero", mixed.getItems().get(0).getValue());
    }

    @Test
    void addUsesPropertyBranchForNonNumericLeafOnMixedParent() {
        Blue blue = new Blue();
        Node node = new Node()
                .name("Guarded")
                .properties("mixed", new Node()
                        .items(new Node().value("item-zero"))
                        .properties("existing", new Node().value("keep")));
        ResolvedSnapshot snapshot = blue.resolveToSnapshot(node);

        WorkingDocument workingDocument = WorkingDocument.forSnapshot(blue, snapshot);
        workingDocument.applyPatch(JsonPatch.add("/mixed/key", new Node().value("property-value")));
        ResolvedSnapshot committed = workingDocument.commit();

        Node mixed = committed.resolvedRoot().toNode().getProperties().get("mixed");
        assertEquals("property-value", mixed.getProperties().get("key").getValue());
        assertEquals("keep", mixed.getProperties().get("existing").getValue());
        assertEquals("item-zero", mixed.getItems().get(0).getValue());
    }

    @Test
    void addNumericLeafUsesArrayWhenNoMatchingPropertyExists() {
        Blue blue = new Blue();
        Node node = new Node()
                .name("Guarded")
                .properties("mixed", new Node()
                        .items(new Node().value("item-zero"), new Node().value("item-one"))
                        .properties("existing", new Node().value("keep")));
        ResolvedSnapshot snapshot = blue.resolveToSnapshot(node);

        WorkingDocument workingDocument = WorkingDocument.forSnapshot(blue, snapshot);
        workingDocument.applyPatch(JsonPatch.add("/mixed/1", new Node().value("item-inserted")));
        ResolvedSnapshot committed = workingDocument.commit();

        Node mixed = committed.resolvedRoot().toNode().getProperties().get("mixed");
        assertEquals("item-zero", mixed.getItems().get(0).getValue());
        assertEquals("item-inserted", mixed.getItems().get(1).getValue());
        assertEquals("item-one", mixed.getItems().get(2).getValue());
        assertEquals("keep", mixed.getProperties().get("existing").getValue());
    }
}
