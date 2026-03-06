package blue.language.blueid;

import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotEquals;

class ListHashingDoesNotCollapseSingletonTest {

    @Test
    void singletonListAndScalarMustHashDifferently() {
        Node scalar = new Node().value("x");
        Node singletonList = new Node().items(new Node().value("x"));

        String scalarId = BlueIdCalculator.calculateSemanticBlueId(scalar);
        String singletonListId = BlueIdCalculator.calculateSemanticBlueId(singletonList);

        assertNotEquals(scalarId, singletonListId);
    }

    @Test
    void emptyListMustNotEqualMissingField() {
        Node withEmptyList = new Node().properties("values", new Node().items());
        Node missingList = new Node();

        String emptyListId = BlueIdCalculator.calculateSemanticBlueId(withEmptyList);
        String missingListId = BlueIdCalculator.calculateSemanticBlueId(missingList);

        assertNotEquals(emptyListId, missingListId);
    }
}
