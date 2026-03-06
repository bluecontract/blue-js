package blue.language.utils.limits;

import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import static blue.language.blueid.legacy.LegacyBlueIdCalculator.calculateBlueId;
import static org.junit.jupiter.api.Assertions.*;

class NodeToPathLimitsConverterTest {

    private final Node mockNode = new Node();

    @Test
    void testEmptyNode() {
        Node node = new Node();
        PathLimits limits = NodeToPathLimitsConverter.convert(node);
        assertTrue(limits.shouldExtendPathSegment("/", mockNode));
        assertFalse(limits.shouldExtendPathSegment("/anyOtherPath", mockNode));
    }

    @Test
    void testNodeWithSingleProperty() {
        Node node = new Node().properties("prop", new Node());
        PathLimits limits = NodeToPathLimitsConverter.convert(node);
        assertTrue(limits.shouldExtendPathSegment("/prop", mockNode));
        assertFalse(limits.shouldExtendPathSegment("/anyOtherPath", mockNode));
    }

    @Test
    void testNodeWithNestedProperties() {
        Node node = new Node().properties(
                "prop1", new Node().properties("nested", new Node()),
                "prop2", new Node()
        );
        PathLimits limits = NodeToPathLimitsConverter.convert(node);
        assertTrue(limits.shouldExtendPathSegment("/prop1", mockNode));
        assertTrue(limits.shouldExtendPathSegment("/prop1/nested", mockNode));
        assertTrue(limits.shouldExtendPathSegment("/prop2", mockNode));
        assertFalse(limits.shouldExtendPathSegment("/prop1/nonexistent", mockNode));
    }

    @Test
    void testNodeWithItems() {
        Node node = new Node().items(new Node(), new Node().properties("itemProp", new Node()));
        PathLimits limits = NodeToPathLimitsConverter.convert(node);
        assertTrue(limits.shouldExtendPathSegment("/0", mockNode));
        assertTrue(limits.shouldExtendPathSegment("/1", mockNode));
        assertTrue(limits.shouldExtendPathSegment("/1/itemProp", mockNode));
        assertFalse(limits.shouldExtendPathSegment("/2", mockNode));
    }

    @Test
    void testComplexNode() {
        Node node = new Node().properties(
                "prop1", new Node().items(new Node(), new Node().properties("nestedItemProp", new Node())),
                "prop2", new Node().properties("nestedProp", new Node())
        );
        PathLimits limits = NodeToPathLimitsConverter.convert(node);
        assertTrue(limits.shouldExtendPathSegment("/prop1", mockNode));
        assertTrue(limits.shouldExtendPathSegment("/prop1/0", mockNode));
        assertTrue(limits.shouldExtendPathSegment("/prop1/1", mockNode));
        assertTrue(limits.shouldExtendPathSegment("/prop1/1/nestedItemProp", mockNode));
        assertTrue(limits.shouldExtendPathSegment("/prop2", mockNode));
        assertTrue(limits.shouldExtendPathSegment("/prop2/nestedProp", mockNode));
        assertFalse(limits.shouldExtendPathSegment("/prop2/nestedProp/xyz", mockNode));
        assertFalse(limits.shouldExtendPathSegment("/nonexistent", mockNode));
    }

    @Test
    void testNullNode() {
        PathLimits limits = NodeToPathLimitsConverter.convert(null);
        assertFalse(limits.shouldExtendPathSegment("/", mockNode));
        assertFalse(limits.shouldExtendPathSegment("/anyPath", mockNode));
    }

    @Test
    void testSpecialCharacterPropertySegmentsUseJsonPointerEscaping() {
        Node node = new Node().properties("a/b", new Node().properties("x~y", new Node()));
        PathLimits limits = NodeToPathLimitsConverter.convert(node);

        assertTrue(limits.shouldExtendPathSegment("a/b", mockNode));
        limits.enterPathSegment("a/b", mockNode);

        assertTrue(limits.shouldExtendPathSegment("x~y", mockNode));
        assertFalse(limits.shouldExtendPathSegment("x/y", mockNode));
    }

    @Test
    void testEmptyPropertyKeyIsKeptDistinctFromParentPath() {
        Node node = new Node()
                .properties("scope", new Node().properties("", new Node()));
        PathLimits limits = NodeToPathLimitsConverter.convert(node);

        assertTrue(limits.shouldExtendPathSegment("scope", mockNode));
        limits.enterPathSegment("scope", mockNode);

        assertTrue(limits.shouldExtendPathSegment("", mockNode));
        assertFalse(limits.shouldExtendPathSegment("child", mockNode));
    }

}