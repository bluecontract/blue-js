package blue.language.provider;

import blue.language.Blue;
import blue.language.blueid.BlueIdCalculator;
import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.function.Function;

import static blue.language.utils.UncheckedObjectMapper.YAML_MAPPER;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class NodeContentHandlerSemanticTest {

    @Test
    void semanticBlueIdNormalizesRedundantOverrides() {
        BasicNodeProvider provider = new BasicNodeProvider();
        provider.addSingleDocs(
                "name: BaseType\n" +
                        "x: 1\n"
        );
        String baseBlueId = provider.getBlueIdByName("BaseType");

        Blue blue = new Blue(provider);
        String lean = "name: Child\n" +
                "type:\n" +
                "  blueId: " + baseBlueId + "\n";
        String noisy = "name: Child\n" +
                "type:\n" +
                "  blueId: " + baseBlueId + "\n" +
                "x: 1\n";

        NodeContentHandler.ParsedContent leanParsed = NodeContentHandler.parseAndCalculateSemanticBlueId(lean, blue);
        NodeContentHandler.ParsedContent noisyParsed = NodeContentHandler.parseAndCalculateSemanticBlueId(noisy, blue);

        assertEquals(leanParsed.blueId, noisyParsed.blueId);
        assertFalse(leanParsed.isMultipleDocuments);
    }

    @Test
    void semanticBlueIdListCalculationUsesCanonicalNodes() {
        Blue blue = new Blue();
        Node nodeA = blue.yamlToNode("name: A\nv: 1\n");
        Node nodeB = blue.yamlToNode("name: B\nv: 2\n");

        NodeContentHandler.ParsedContent parsed = NodeContentHandler.parseAndCalculateSemanticBlueId(
                Arrays.asList(nodeA, nodeB),
                blue
        );

        assertNotNull(parsed.blueId);
        assertTrue(parsed.isMultipleDocuments);
        assertTrue(parsed.content.isArray());
        assertEquals(2, parsed.content.size());
    }

    @Test
    void parseAndCalculateBlueIdSingleNodeUsesSemanticHashing() {
        Node node = new Node().name("SemanticSingle").properties("x", new Node().value(1));

        NodeContentHandler.ParsedContent parsed = NodeContentHandler.parseAndCalculateBlueId(node, Function.identity());

        assertEquals(BlueIdCalculator.calculateSemanticBlueId(node), parsed.blueId);
        assertFalse(parsed.isMultipleDocuments);
    }

    @Test
    void parseAndCalculateBlueIdSingleDocStringUsesSemanticHashing() {
        String yaml = "name: SemanticSingle\nx: 1\n";
        Node node = YAML_MAPPER.readValue(yaml, Node.class);

        NodeContentHandler.ParsedContent parsed = NodeContentHandler.parseAndCalculateBlueId(yaml, Function.identity());

        assertEquals(BlueIdCalculator.calculateSemanticBlueId(node), parsed.blueId);
        assertFalse(parsed.isMultipleDocuments);
    }

    @Test
    void parseAndCalculateBlueIdListUsesSemanticHashing() {
        Node nodeA = new Node().name("A").properties("v", new Node().value(1));
        Node nodeB = new Node().name("B").properties("v", new Node().value(2));

        NodeContentHandler.ParsedContent parsed = NodeContentHandler.parseAndCalculateBlueId(
                Arrays.asList(nodeA, nodeB),
                Function.identity()
        );

        assertEquals(BlueIdCalculator.calculateSemanticBlueId(Arrays.asList(nodeA, nodeB)), parsed.blueId);
        assertTrue(parsed.isMultipleDocuments);
        assertTrue(parsed.content.isArray());
        assertEquals(2, parsed.content.size());
    }
}
