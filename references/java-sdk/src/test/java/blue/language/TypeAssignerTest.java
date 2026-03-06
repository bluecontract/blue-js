package blue.language;

import blue.language.merge.Merger;
import blue.language.merge.MergingProcessor;
import blue.language.merge.processor.SequentialMergingProcessor;
import blue.language.merge.processor.TypeAssigner;
import blue.language.merge.processor.ValuePropagator;
import blue.language.model.Node;
import blue.language.utils.limits.Limits;
import blue.language.provider.BasicNodeProvider;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static blue.language.blueid.BlueIdCalculator.calculateSemanticBlueId;
import static blue.language.utils.UncheckedObjectMapper.YAML_MAPPER;
import static org.junit.jupiter.api.Assertions.assertEquals;

public class TypeAssignerTest {

    @Test
    public void testPropertySubtype() throws Exception {
        Node a = new Node().name("A");
        Node b = new Node().name("B").type(new Node().blueId(calculateSemanticBlueId(a)));
        Node c = new Node().name("C").type(new Node().blueId(calculateSemanticBlueId(b)));

        Node x = new Node()
                .name("X")
                .properties(
                        "a", new Node().type(new Node().blueId(calculateSemanticBlueId(b)))
                );
        Node y = new Node()
                .name("Y")
                .type(new Node().blueId(calculateSemanticBlueId(x)))
                .properties(
                        "a", new Node().type(new Node().blueId(calculateSemanticBlueId(c)))
                );

        List<Node> nodes = Arrays.asList(a, b, c, x, y);
        MergingProcessor mergingProcessor = new SequentialMergingProcessor(
                Arrays.asList(
                        new TypeAssigner()
                )
        );

        BasicNodeProvider nodeProvider = new BasicNodeProvider(nodes);
        Merger merger = new Merger(mergingProcessor, nodeProvider);
        Node node = merger.resolve(nodeProvider.fetchByBlueId(calculateSemanticBlueId(y)).get(0), Limits.NO_LIMITS);

        assertEquals("C", node.getProperties().get("a").getType().getName());
    }

    @Test
    public void testEmptyTypeIsInherited() throws Exception {
        Node a = new Node().name("A");
        Node b = new Node().name("B").type(new Node().blueId(calculateSemanticBlueId(a)));
        Node c = new Node().name("C").type(new Node().blueId(calculateSemanticBlueId(b)));

        Node x = new Node()
                .name("X")
                .properties(
                        "a", new Node().type(new Node().blueId(calculateSemanticBlueId(b)))
                );
        Node y = new Node()
                .name("Y")
                .type(new Node().blueId(calculateSemanticBlueId(x)))
                .properties(
                        "a", new Node()
                );

        List<Node> nodes = Arrays.asList(a, b, c, x, y);
        MergingProcessor mergingProcessor = new SequentialMergingProcessor(
                Arrays.asList(
                        new TypeAssigner()
                )
        );

        BasicNodeProvider nodeProvider = new BasicNodeProvider(nodes);
        Merger merger = new Merger(mergingProcessor, nodeProvider);
        Node node = merger.resolve(nodeProvider.fetchByBlueId(calculateSemanticBlueId(y)).get(0), Limits.NO_LIMITS);

        assertEquals("B", node.getProperties().get("a").getType().getName());
    }


    @Test
    public void testPropertySubtypeOnYamlDocsWithNoBlueIds() throws Exception {

        String a = "name: A";

        String b = "name: B\n" +
                "type:\n" +
                "  name: A";

        String c = "name: C\n" +
                "type:\n" +
                "  name: B\n" +
                "  type:\n" +
                "    name: A";

        String x = "name: X\n" +
                "a:\n" +
                "  type:\n" +
                "    name: A";

        String y = "name: Y\n" +
                "type:\n" +
                "  name: X\n" +
                "  a:\n" +
                "    type:\n" +
                "      name: A\n" +
                "a:\n" +
                "  type:\n" +
                "    name: B\n" +
                "    type:\n" +
                "      name: A";

        Map<String, Node> nodes = Stream.of(a, b, c, x, y)
                .map(doc -> YAML_MAPPER.readValue(doc, Node.class))
                .collect(Collectors.toMap(Node::getName, node -> node));
        BasicNodeProvider nodeProvider = new BasicNodeProvider(nodes.values());
        MergingProcessor mergingProcessor = new SequentialMergingProcessor(
                Arrays.asList(
                        new TypeAssigner()
                )
        );

        Merger merger = new Merger(mergingProcessor, nodeProvider);
        Node node = merger.resolve(nodeProvider.fetchByBlueId(calculateSemanticBlueId(nodes.get("Y"))).get(0));

        assertEquals("B", node.getProperties().get("a").getType().getName());
    }

    @Test
    public void testDifferentSubtypeVariations2() throws Exception {
        BasicNodeProvider nodeProvider = new BasicNodeProvider();
        nodeProvider.addSingleDocs(
                "name: General Hattori Hanzo Voucher\n" +
                        "details:\n" +
                        "  customerSupport:\n" +
                        "    phone: \"+1234567890\"\n"
        );
        String generalVoucherBlueId = nodeProvider.getBlueIdByName("General Hattori Hanzo Voucher");

        nodeProvider.addSingleDocs(
                "name: Celebrating Kill Bill Anniversary 2024\n" +
                        "type:\n" +
                        "  blueId: " + generalVoucherBlueId + "\n"
        );
        String anniversaryBlueId = nodeProvider.getBlueIdByName("Celebrating Kill Bill Anniversary 2024");

        nodeProvider.addSingleDocs(
                "name: My Voucher\n" +
                        "type:\n" +
                        "  blueId: " + anniversaryBlueId + "\n" +
                        "serialNumber: 30902345235\n" +
                        "purchaseDate: 2024-04-01\n"
        );

        MergingProcessor mergingProcessor = new SequentialMergingProcessor(
                Arrays.asList(
                        new ValuePropagator(),
                        new TypeAssigner()
                )
        );

        Merger merger = new Merger(mergingProcessor, nodeProvider);

        Node source = nodeProvider.findNodeByName("My Voucher").orElse(null);

        Node node = merger.resolve(source);

        assertEquals("+1234567890", node.getProperties().get("details")
                .getProperties().get("customerSupport")
                .getProperties().get("phone").getValue());

    }

}