package blue.language.utils;

import blue.language.model.Node;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;

import static org.junit.jupiter.api.Assertions.*;

class NodePathAccessorTest {

    private static final ObjectMapper YAML_MAPPER = new ObjectMapper(new YAMLFactory());
    private Node rootNode;

    @BeforeEach
    void setUp() throws Exception {
        String yaml = "name: Root\n" +
                      "type:\n" +
                      "  name: RootType\n" +
                      "  type:\n" +
                      "    name: MetaType\n" +
                      "value: RootValue\n" +
                      "a:\n" +
                      "  - name: A1\n" +
                      "    type:\n" +
                      "      name: TypeA\n" +
                      "  - name: A2\n" +
                      "    value: 42\n" +
                      "b:\n" +
                      "  name: B\n" +
                      "  type:\n" +
                      "    name: TypeB\n" +
                      "  c:\n" +
                      "    name: C\n" +
                      "    value: ValueC";

        rootNode = YAML_MAPPER.readValue(yaml, Node.class);
    }

    @Test
    void testRootLevelAccess() {
        assertEquals("Root", rootNode.get("/name"));
        assertEquals("RootValue", rootNode.get("/value"));
        assertTrue(rootNode.get("/type") instanceof Node);
        assertEquals("RootType", ((Node) rootNode.get("/type")).getName());
    }

    @Test
    void testNestedAccess() {
        assertEquals("B", rootNode.get("/b/name"));
        assertEquals("ValueC", rootNode.get("/b/c/value"));
    }

    @Test
    void testListAccess() {
        assertTrue(rootNode.get("/a/0") instanceof Node);
        assertEquals("A1", rootNode.get("/a/0/name"));
        assertEquals(BigInteger.valueOf(42), rootNode.get("/a/1/value"));
    }

    @Test
    void testTypeAccess() {
        assertEquals("TypeA", rootNode.get("/a/0/type/name"));
        assertEquals("MetaType", rootNode.get("/type/type/name"));
    }

    @Test
    void testPropertySegmentTakesPrecedenceOverBuiltIns() {
        Node node = new Node()
                .type(new Node().name("BuiltInType"))
                .properties("type", new Node().value("property-type"));

        assertEquals("property-type", NodePathAccessor.get(node, "/type"));
    }

    @Test
    void testBlueIdAccess() {
        assertNotNull(rootNode.get("/blueId"));
        assertNotNull(rootNode.get("/a/0/blueId"));
    }

    @Test
    void testBlueBuiltInAccess() {
        Node node = new Node()
                .blue(new Node().name("BlueRoot"));
        assertEquals("BlueRoot", NodePathAccessor.get(node, "/blue/name"));
    }

    @Test
    void testInvalidPath() {
        assertThrows(IllegalArgumentException.class, () -> rootNode.get("/nonexistent"));
        assertThrows(IllegalArgumentException.class, () -> rootNode.get("/a/5"));
        assertThrows(IllegalArgumentException.class, () -> rootNode.get("invalid"));
    }

    @Test
    void testValuePrecedence() {
        Node nodeWithValue = new Node().name("Test").value("TestValue");
        Node nodeWithoutValue = new Node().name("Test");

        assertEquals("TestValue", NodePathAccessor.get(nodeWithValue, "/"));
        assertEquals("TestValue", NodePathAccessor.get(nodeWithValue, ""));
        assertEquals("TestValue", NodePathAccessor.get(nodeWithValue, null));
        assertEquals("Test", NodePathAccessor.get(nodeWithValue, "/name"));

        assertTrue(NodePathAccessor.get(nodeWithoutValue, "/") instanceof Node);
        assertTrue(NodePathAccessor.get(nodeWithoutValue, "") instanceof Node);
        assertTrue(NodePathAccessor.get(nodeWithoutValue, null) instanceof Node);
        assertEquals("Test", NodePathAccessor.get(nodeWithoutValue, "/name"));
    }

    @Test
    void testNumericPropertyTakesPrecedenceOverListIndex() {
        Node node = new Node()
                .items(new Node().value("list-zero"))
                .properties("0", new Node().value("property-zero"));

        assertEquals("property-zero", NodePathAccessor.get(node, "/0"));
    }

    @Test
    void testNumericSegmentFallsBackToListIndexWhenNoPropertyMatch() {
        Node node = new Node()
                .items(new Node().value("list-zero"), new Node().value("list-one"))
                .properties("existing", new Node().value("keep"));

        assertEquals("list-one", NodePathAccessor.get(node, "/1"));
        assertEquals("keep", NodePathAccessor.get(node, "/existing"));
    }

    @Test
    void testLeadingZeroPropertyKeyIsAccessible() {
        Node node = new Node()
                .properties("01", new Node().value("leading-zero"));

        assertEquals("leading-zero", NodePathAccessor.get(node, "/01"));
    }

    @Test
    void testPureListRejectsLeadingZeroAndNonNumericSegments() {
        Node list = new Node().items(new Node().value("x"), new Node().value("y"));

        assertThrows(IllegalArgumentException.class, () -> NodePathAccessor.get(list, "/01"));
        assertThrows(IllegalArgumentException.class, () -> NodePathAccessor.get(list, "/child"));
        assertEquals("x", NodePathAccessor.get(list, "/0"));
    }

    @Test
    void testOversizedNumericSegmentIsRejectedAsInvalidIndex() {
        Node node = new Node().items(new Node().value("only"));
        assertThrows(IllegalArgumentException.class,
                () -> NodePathAccessor.get(node, "/999999999999999999999999"));
    }

    @Test
    void testEscapedPointerSegmentsResolveSpecialPropertyNames() {
        Node node = new Node()
                .properties("a/b", new Node().value("slash"))
                .properties("a~b", new Node().value("tilde"));

        assertEquals("slash", NodePathAccessor.get(node, "/a~1b"));
        assertEquals("tilde", NodePathAccessor.get(node, "/a~0b"));
    }

    @Test
    void testTrailingSegmentsArePreserved() {
        Node node = new Node()
                .properties("scope", new Node()
                        .properties("", new Node().value("empty-key")));

        assertEquals("empty-key", NodePathAccessor.get(node, "/scope/"));
    }

    @Test
    void testMalformedEscapedPointerSegmentIsRejected() {
        Node node = new Node().properties("x", new Node().value("y"));
        assertThrows(IllegalArgumentException.class, () -> NodePathAccessor.get(node, "/x~"));
        assertThrows(IllegalArgumentException.class, () -> NodePathAccessor.get(node, "/x~2"));
    }

    @Test
    void testMissingIntermediateBuiltInSegmentFailsDeterministically() {
        Node node = new Node().name("Root");
        assertThrows(IllegalArgumentException.class, () -> NodePathAccessor.get(node, "/type/name"));
        assertThrows(IllegalArgumentException.class, () -> NodePathAccessor.get(node, "/blue/name"));
    }

    @Test
    void testResolveFinalLinkFalseReturnsRootNodeForRootPointers() {
        Node scalar = new Node().value("root-value");

        assertSame(scalar, NodePathAccessor.get(scalar, "/", null, false));
        assertSame(scalar, NodePathAccessor.get(scalar, "", null, false));
        assertSame(scalar, NodePathAccessor.get(scalar, null, null, false));
    }

    @Test
    void testRootPointerResolvesLinkWhenRequested() {
        Node reference = new Node().blueId("ref-id");
        Node linked = new Node().value("linked-root");

        Object resolved = NodePathAccessor.get(reference, "/", node -> "ref-id".equals(node.getBlueId()) ? linked : node, true);
        assertEquals("linked-root", resolved);
    }

    @Test
    void testResolveFinalLinkFalseSkipsFinalLinkResolution() {
        Node reference = new Node().blueId("ref-id");
        Node linked = new Node().value("linked");
        Node root = new Node().properties("x", reference);

        Object unresolved = NodePathAccessor.get(root, "/x", node -> "ref-id".equals(node.getBlueId()) ? linked : node, false);
        Object resolved = NodePathAccessor.get(root, "/x", node -> "ref-id".equals(node.getBlueId()) ? linked : node, true);

        assertTrue(unresolved instanceof Node);
        assertSame(reference, unresolved);
        assertEquals("linked", resolved);
    }

    @Test
    void testNodeTypedGettersProvideDeterministicTypeErrors() {
        Node node = new Node()
                .properties("text", new Node().value("ok"))
                .properties("child", new Node().name("child"))
                .properties("empty", new Node().value(null));

        assertEquals("ok", node.getAsText("/text"));
        assertEquals("child", node.getAsNode("/child").getName());

        assertThrows(IllegalArgumentException.class, () -> node.getAsNode("/text"));
        assertThrows(IllegalArgumentException.class, () -> node.getAsText("/child"));
        assertThrows(IllegalArgumentException.class, () -> node.getAsText("/empty"));
    }

    @Test
    void testGetAsIntegerRejectsBigIntegerOverflow() {
        Node node = new Node()
                .properties("tooLarge", new Node().value(new BigInteger("2147483648")))
                .properties("tooLargeDecimal", new Node().value(new java.math.BigDecimal("2147483648")))
                .properties("inRange", new Node().value(new BigInteger("2147483647")));

        assertEquals(Integer.valueOf(Integer.MAX_VALUE), node.getAsInteger("/inRange"));
        assertThrows(IllegalArgumentException.class, () -> node.getAsInteger("/tooLarge"));
        assertThrows(IllegalArgumentException.class, () -> node.getAsInteger("/tooLargeDecimal"));
    }

    @Test
    void testGetAsIntegerAcceptsIntegralBigDecimalWithTrailingZeros() {
        Node node = new Node()
                .properties("integralDecimal", new Node().value(new java.math.BigDecimal("7.000")))
                .properties("nonIntegralDecimal", new Node().value(new java.math.BigDecimal("7.100")));

        assertEquals(Integer.valueOf(7), node.getAsInteger("/integralDecimal"));
        assertThrows(IllegalArgumentException.class, () -> node.getAsInteger("/nonIntegralDecimal"));
    }
}