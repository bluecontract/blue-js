package blue.language;

import blue.language.model.Node;
import blue.language.provider.BasicNodeProvider;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;
import java.util.HashMap;
import java.util.Map;

import static blue.language.TestUtils.useNodeNameAsBlueIdProvider;
import static blue.language.utils.Properties.INTEGER_TYPE_BLUE_ID;
import static blue.language.utils.Properties.TEXT_TYPE_BLUE_ID;
import static blue.language.utils.Types.isSubtype;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class TypesTest {

    @Test
    public void testBasic() throws Exception {

        Node a = new Node().name("A");
        Node b = new Node().name("B").type(a);
        Node c = new Node().name("C").type(b);

        List<Node> nodes = Arrays.asList(a, b, c);
        NodeProvider nodeProvider = useNodeNameAsBlueIdProvider(nodes);

        assertTrue(isSubtype(b, a, nodeProvider));
        assertTrue(isSubtype(c, a, nodeProvider));
        assertTrue(isSubtype(a, a, nodeProvider));
        assertTrue(isSubtype(b, b, nodeProvider));
        assertFalse(isSubtype(b, c, nodeProvider));

    }

    @Test
    public void testDifferentSubtypeVariations() throws Exception {

        BasicNodeProvider nodeProvider = new BasicNodeProvider();

        String person = "name: Person\n" +
                        "surname:\n" +
                        "  type: Text\n" +
                        "age:\n" +
                        "  type: Integer";
        nodeProvider.addSingleDocs(person);

        String alice = "name: Alice\n" +
                       "type:\n" +
                       "  blueId: " + nodeProvider.getBlueIdByName("Person");

        String alice2 = "name: Alice2\n" +
                        "type:\n" +
                        "  name: Person\n" +
                        "  blueId: " + nodeProvider.getBlueIdByName("Person");

        String alice3 = "name: Alice3\n" +
                        "type:\n" +
                        "  name: Person\n" +
                        "  surname:\n" +
                        "    type: Text\n" +
                        "  age:\n" +
                        "    type: Integer";
        nodeProvider.addSingleDocs(alice, alice2, alice3);

        assertTrue(isSubtype(nodeProvider.getNodeByName("Alice"), nodeProvider.getNodeByName("Alice"), nodeProvider));
        assertFalse(isSubtype(nodeProvider.getNodeByName("Person"), nodeProvider.getNodeByName("Alice"), nodeProvider));

        assertTrue(isSubtype(nodeProvider.getNodeByName("Alice"), nodeProvider.getNodeByName("Person"), nodeProvider));
        assertTrue(isSubtype(nodeProvider.getNodeByName("Alice2"), nodeProvider.getNodeByName("Person"), nodeProvider));
        assertTrue(isSubtype(nodeProvider.getNodeByName("Alice3"), nodeProvider.getNodeByName("Person"), nodeProvider));
    }

    @Test
    public void subtypeCheckPrefersExplicitBlueIdIdentityWhenPresent() {
        Node rootType = new Node()
                .name("RootType")
                .blueId("root-id");
        Node midType = new Node()
                .name("MidType")
                .type(new Node().blueId("root-id"))
                .blueId("mid-id");
        Node leafType = new Node()
                .name("LeafType")
                .type(new Node().blueId("mid-id"))
                .blueId("leaf-id");

        Map<String, Node> byBlueId = new HashMap<String, Node>();
        byBlueId.put("root-id", rootType);
        byBlueId.put("mid-id", midType);
        byBlueId.put("leaf-id", leafType);
        NodeProvider provider = blueId -> {
            Node node = byBlueId.get(blueId);
            return node != null ? Arrays.asList(node) : null;
        };

        Node candidate = new Node()
                .name("LeafResolved")
                .type(new Node().blueId("mid-id"))
                .blueId("leaf-id");

        Node supertype = new Node()
                .name("MidResolved")
                .type(new Node().blueId("root-id"))
                .blueId("mid-id")
                .properties("x", new Node().value(1));

        assertTrue(isSubtype(candidate, supertype, provider));
    }

    @Test
    public void coreSubtypeCheckHandlesDecoratedAncestors() {
        Node decoratedTextType = new Node()
                .name("DecoratedText")
                .blueId("decorated-text-id")
                .type(new Node().blueId(TEXT_TYPE_BLUE_ID))
                .properties("format", new Node().value("markdown"));

        NodeProvider noLookupProvider = blueId -> null;

        assertTrue(isSubtype(new Node().blueId(TEXT_TYPE_BLUE_ID), decoratedTextType, noLookupProvider));
        assertFalse(isSubtype(new Node().blueId(INTEGER_TYPE_BLUE_ID), decoratedTextType, noLookupProvider));
    }

}