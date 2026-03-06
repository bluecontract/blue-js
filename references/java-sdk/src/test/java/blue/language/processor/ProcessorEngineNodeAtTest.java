package blue.language.processor;

import blue.language.model.Node;
import blue.language.processor.util.PointerUtils;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

final class ProcessorEngineNodeAtTest {

    @Test
    void nodeAtResolvesEscapedPointerSegments() {
        Node root = new Node()
                .properties("a/b", new Node().value("slash"))
                .properties("a~b", new Node().value("tilde"));

        assertEquals("slash", ProcessorEngine.nodeAt(root, "/a~1b").getValue());
        assertEquals("tilde", ProcessorEngine.nodeAt(root, "/a~0b").getValue());
    }

    @Test
    void nodeAtTreatsNullAndEmptyPointersAsRoot() {
        Node root = new Node().properties("x", new Node().value("y"));
        assertEquals(root, ProcessorEngine.nodeAt(root, null));
        assertEquals(root, ProcessorEngine.nodeAt(root, ""));
    }

    @Test
    void nodeAtSupportsArrayTraversalWithStrictIndexSemantics() {
        Node root = new Node()
                .properties("list", new Node()
                        .items(
                                new Node().value("zero"),
                                new Node().value("one")
                        ));

        assertEquals("one", ProcessorEngine.nodeAt(root, "/list/1").getValue());
        assertNull(ProcessorEngine.nodeAt(root, "/list/01"));
    }

    @Test
    void nodeAtPrefersNumericPropertyOverArrayIndex() {
        Node root = new Node()
                .properties("list", new Node()
                        .items(new Node().value("index-zero"))
                        .properties("0", new Node().value("property-zero")));

        assertEquals("property-zero", ProcessorEngine.nodeAt(root, "/list/0").getValue());
    }

    @Test
    void nodeAtFallsBackToArrayIndexWhenMixedParentHasNoNumericPropertyMatch() {
        Node root = new Node()
                .properties("list", new Node()
                        .items(new Node().value("index-zero"), new Node().value("index-one"))
                        .properties("existing", new Node().value("keep")));

        assertEquals("index-one", ProcessorEngine.nodeAt(root, "/list/1").getValue());
        assertEquals("keep", ProcessorEngine.nodeAt(root, "/list/existing").getValue());
    }

    @Test
    void nodeAtUsesLeadingZeroNumericPropertyWhenMixedParentHasPropertyMap() {
        Node root = new Node()
                .properties("list", new Node()
                        .items(new Node().value("index-zero"), new Node().value("index-one"))
                        .properties("01", new Node().value("property-leading-zero")));

        assertEquals("property-leading-zero", ProcessorEngine.nodeAt(root, "/list/01").getValue());
        assertEquals("index-one", ProcessorEngine.nodeAt(root, "/list/1").getValue());
    }

    @Test
    void nodeAtSupportsBuiltInTypeAndBlueTraversal() {
        Node root = new Node()
                .type(new Node().name("TypeRoot"))
                .blue(new Node().name("BlueRoot"));

        assertEquals("TypeRoot", ProcessorEngine.nodeAt(root, "/type").getName());
        assertEquals("BlueRoot", ProcessorEngine.nodeAt(root, "/blue").getName());
    }

    @Test
    void nodeAtSupportsBuiltInAuxiliaryTypeSegments() {
        Node root = new Node()
                .itemType(new Node().name("ItemTypeRoot"))
                .keyType(new Node().name("KeyTypeRoot"))
                .valueType(new Node().name("ValueTypeRoot"));

        assertEquals("ItemTypeRoot", ProcessorEngine.nodeAt(root, "/itemType").getName());
        assertEquals("KeyTypeRoot", ProcessorEngine.nodeAt(root, "/keyType").getName());
        assertEquals("ValueTypeRoot", ProcessorEngine.nodeAt(root, "/valueType").getName());
    }

    @Test
    void nodeAtPrefersPropertyOverBuiltInTypeSegment() {
        Node root = new Node()
                .type(new Node().name("BuiltInType"))
                .properties("type", new Node().value("property-type"));

        assertEquals("property-type", ProcessorEngine.nodeAt(root, "/type").getValue());
    }

    @Test
    void nodeAtPreservesTrailingEmptySegments() {
        Node root = new Node().properties("scope", new Node().value("value"));
        assertNull(ProcessorEngine.nodeAt(root, "/scope/"));
    }

    @Test
    void nodeAtResolvesTrailingEmptySegmentWhenPropertyExists() {
        Node root = new Node().properties("scope", new Node()
                .properties("", new Node().value("empty-key")));

        assertEquals("empty-key", ProcessorEngine.nodeAt(root, "/scope/").getValue());
    }

    @Test
    void nodeAtRejectsMalformedEscapesAndPointers() {
        Node root = new Node().properties("x", new Node().value("y"));
        assertThrows(IllegalArgumentException.class, () -> ProcessorEngine.nodeAt(root, "/x~"));
        assertThrows(IllegalArgumentException.class, () -> ProcessorEngine.nodeAt(root, "/x~2"));
        assertEquals("y", ProcessorEngine.nodeAt(root, "x").getValue());
    }

    @Test
    void normalizePointerAcceptsNonPointerPathsByAddingLeadingSlash() {
        assertEquals("/x", PointerUtils.normalizePointer("x"));
        assertThrows(IllegalArgumentException.class, () -> PointerUtils.normalizePointer("/x~2"));
    }

    @Test
    void normalizePointerTreatsNullAndEmptyAsRoot() {
        assertEquals("/", PointerUtils.normalizePointer(null));
        assertEquals("/", PointerUtils.normalizePointer(""));
    }

    @Test
    void normalizeScopeTreatsNullAndEmptyAsRoot() {
        assertEquals("/", PointerUtils.normalizeScope(null));
        assertEquals("/", PointerUtils.normalizeScope(""));
    }

    @Test
    void normalizeScopeRejectsOnlyMalformedEscapes() {
        assertEquals("/scope", PointerUtils.normalizeScope("scope"));
        assertThrows(IllegalArgumentException.class, () -> PointerUtils.normalizeScope("/scope~2"));
    }
}
