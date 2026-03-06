package blue.language.blueid;

import blue.language.Blue;
import blue.language.model.Constraints;
import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

class SemanticBlueIdSpecTest {

    @Test
    void pureReferenceShortCircuitsToReferencedBlueId() {
        Node pureReference = new Node().blueId("ReferenceBlueId");
        assertEquals("ReferenceBlueId", BlueIdCalculator.calculateSemanticBlueId(pureReference));
    }

    @Test
    void mixedBlueIdPayloadDoesNotShortCircuit() {
        Node pureReference = new Node().blueId("ReferenceBlueId");
        Node mixedPayload = new Node().blueId("ReferenceBlueId").properties("x", new Node().value(1));

        assertNotEquals(
                BlueIdCalculator.calculateSemanticBlueId(pureReference),
                BlueIdCalculator.calculateSemanticBlueId(mixedPayload)
        );
    }

    @Test
    void inferredScalarTypeMatchesExplicitScalarTypeInSemanticPipeline() {
        Blue blue = new Blue();
        Node inferred = blue.yamlToNode("value: 1\n");
        Node explicit = blue.yamlToNode(
                "type: Integer\n" +
                        "value: 1\n"
        );

        assertEquals(
                blue.calculateSemanticBlueId(inferred),
                blue.calculateSemanticBlueId(explicit)
        );
    }

    @Test
    void emptyConstraintsDoNotAffectSemanticHash() {
        Node withoutConstraints = new Node().properties("x", new Node().value(1));
        Node withEmptyConstraints = new Node().properties("x", new Node().value(1).constraints(new Constraints()));

        assertEquals(
                BlueIdCalculator.calculateSemanticBlueId(withoutConstraints),
                BlueIdCalculator.calculateSemanticBlueId(withEmptyConstraints)
        );
    }

    @Test
    void singletonListHashDiffersFromScalarHash() {
        Node scalar = new Node().value("x");
        Node singletonList = new Node().items(new Node().value("x"));

        assertNotEquals(
                BlueIdCalculator.calculateSemanticBlueId(scalar),
                BlueIdCalculator.calculateSemanticBlueId(singletonList)
        );
    }
}
