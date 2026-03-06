package blue.language.processor.util;

import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class NodeCanonicalizerParityTest {

    @Test
    void returnsNullSignatureForNullNode() {
        assertNull(NodeCanonicalizer.canonicalSignature(null));
    }

    @Test
    void returnsZeroSizeForNullNode() {
        assertEquals(0L, NodeCanonicalizer.canonicalSize(null));
    }

    @Test
    void producesIdenticalSignaturesRegardlessOfInsertionOrder() {
        String signatureA = NodeCanonicalizer.canonicalSignature(createSampleNodeNormalOrder());
        String signatureB = NodeCanonicalizer.canonicalSignature(createSampleNodeReverseOrder());

        assertNotNull(signatureA);
        assertEquals(signatureA, signatureB);
    }

    @Test
    void computesCanonicalSizeBasedOnUtf8ByteLength() {
        Node node = createSampleNodeNormalOrder();
        String signature = NodeCanonicalizer.canonicalSignature(node);

        assertNotNull(signature);
        assertEquals(signature.getBytes(StandardCharsets.UTF_8).length, NodeCanonicalizer.canonicalSize(node));
    }

    @Test
    void emitsKeysInLexicographicOrder() {
        Node node = new Node()
                .properties("zeta", new Node().value("last"))
                .properties("alpha", new Node().value("first"))
                .properties("middle", new Node().value("mid"));

        String signature = NodeCanonicalizer.canonicalSignature(node);
        assertNotNull(signature);

        int alphaIndex = signature.indexOf("\"alpha\"");
        int middleIndex = signature.indexOf("\"middle\"");
        int zetaIndex = signature.indexOf("\"zeta\"");

        assertTrue(alphaIndex >= 0);
        assertTrue(middleIndex > alphaIndex);
        assertTrue(zetaIndex > middleIndex);
    }

    private Node createSampleNodeNormalOrder() {
        return new Node()
                .properties("payload", new Node()
                        .properties("count", new Node().value(3))
                        .properties("enabled", new Node().value(true))
                        .properties("items", new Node().items(
                                new Node().value("alpha"),
                                new Node().value("beta"))))
                .properties("meta", new Node().properties("label", new Node().value("Test")));
    }

    private Node createSampleNodeReverseOrder() {
        return new Node()
                .properties("meta", new Node().properties("label", new Node().value("Test")))
                .properties("payload", new Node()
                        .properties("items", new Node().items(
                                new Node().value("alpha"),
                                new Node().value("beta")))
                        .properties("enabled", new Node().value(true))
                        .properties("count", new Node().value(3)));
    }
}
