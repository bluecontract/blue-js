package blue.language.blueid;

import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotEquals;

class BlueIdReferenceOnlyShortCircuitTest {

    @Test
    void mixedBlueIdObjectMustNotShortCircuit() {
        Node pureReference = new Node().blueId("RefBlueId");
        Node mixed = new Node()
                .blueId("RefBlueId")
                .properties("value", new Node().value(1));

        String referenceId = BlueIdCalculator.calculateSemanticBlueId(pureReference);
        String mixedId = BlueIdCalculator.calculateSemanticBlueId(mixed);

        assertNotEquals(referenceId, mixedId);
    }
}
