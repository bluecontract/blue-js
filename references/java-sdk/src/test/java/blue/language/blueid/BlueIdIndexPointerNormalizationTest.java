package blue.language.blueid;

import blue.language.Blue;
import blue.language.model.Node;
import blue.language.snapshot.ResolvedSnapshot;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class BlueIdIndexPointerNormalizationTest {

    @Test
    void blueIdIndexTreatsNullAndEmptyPointersAsRoot() {
        Blue blue = new Blue();
        Node authoring = new Node().name("Root").properties("x", new Node().value(1));
        ResolvedSnapshot snapshot = blue.resolveToSnapshot(authoring);

        assertEquals(snapshot.rootBlueId(), snapshot.blueIdsByPointer().blueIdAt(null));
        assertEquals(snapshot.rootBlueId(), snapshot.blueIdsByPointer().blueIdAt(""));
        assertEquals(snapshot.rootBlueId(), snapshot.blueIdsByPointer().blueIdAt("/"));
    }

    @Test
    void blueIdIndexRejectsNonPointerLookupPaths() {
        Blue blue = new Blue();
        ResolvedSnapshot snapshot = blue.resolveToSnapshot(new Node().name("Root"));

        assertThrows(IllegalArgumentException.class, () -> snapshot.blueIdsByPointer().blueIdAt("root"));
    }

    @Test
    void blueIdIndexKeepsTrailingEmptySegmentsDistinct() {
        Blue blue = new Blue();
        Node authoring = new Node()
                .name("Root")
                .properties("scope", new Node().properties("", new Node().value("empty-key")));
        ResolvedSnapshot snapshot = blue.resolveToSnapshot(authoring);

        String scopeBlueId = snapshot.blueIdsByPointer().blueIdAt("/scope");
        String emptyChildBlueId = snapshot.blueIdsByPointer().blueIdAt("/scope/");

        assertEquals(BlueIdCalculator.rehashPath(snapshot.canonicalRoot().toNode(), "/scope"), scopeBlueId);
        assertEquals(BlueIdCalculator.rehashPath(snapshot.canonicalRoot().toNode(), "/scope/"), emptyChildBlueId);
    }
}
