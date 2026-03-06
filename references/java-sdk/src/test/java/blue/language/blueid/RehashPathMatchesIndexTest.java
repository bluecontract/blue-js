package blue.language.blueid;

import blue.language.Blue;
import blue.language.model.Node;
import blue.language.snapshot.ResolvedSnapshot;
import blue.language.snapshot.SnapshotTrust;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class RehashPathMatchesIndexTest {

    private static final Node AUTHORING = new Node()
            .name("Root")
            .type(new Node().name("CoreType"))
            .items(
                    new Node().name("First"),
                    new Node().name("Second")
            )
            .properties("a/b", new Node().value("slash"))
            .properties("a~b", new Node().value("tilde"))
            .properties("a~/b", new Node().value("tilde-and-slash"))
            .properties("type", new Node().value("property-overrides-type-segment"));

    @Test
    void rehashPathMatchesSnapshotPointerIndexForAllPointers() {
        Blue blue = new Blue();
        ResolvedSnapshot snapshot = blue.resolveToSnapshot(AUTHORING);
        Node canonicalRoot = snapshot.canonicalRoot().toNode();

        for (Map.Entry<String, String> entry : snapshot.blueIdsByPointer().asMap().entrySet()) {
            assertEquals(
                    entry.getValue(),
                    BlueIdCalculator.rehashPath(canonicalRoot, entry.getKey()),
                    "Pointer mismatch for " + entry.getKey()
            );
        }
    }

    @Test
    void rehashPathTreatsEmptyAndNullPointerAsRoot() {
        Blue blue = new Blue();
        ResolvedSnapshot snapshot = blue.resolveToSnapshot(AUTHORING);
        Node canonicalRoot = snapshot.canonicalRoot().toNode();

        assertEquals(snapshot.rootBlueId(), BlueIdCalculator.rehashPath(canonicalRoot, ""));
        assertEquals(snapshot.rootBlueId(), BlueIdCalculator.rehashPath(canonicalRoot, null));
    }

    @Test
    void rehashPathRejectsInvalidOrMissingPointers() {
        Blue blue = new Blue();
        ResolvedSnapshot snapshot = blue.resolveToSnapshot(AUTHORING);
        Node canonicalRoot = snapshot.canonicalRoot().toNode();

        assertThrows(IllegalArgumentException.class, () -> BlueIdCalculator.rehashPath(canonicalRoot, "type"));
        assertThrows(IllegalArgumentException.class, () -> BlueIdCalculator.rehashPath(canonicalRoot, "/does-not-exist"));
        assertThrows(IllegalArgumentException.class, () -> BlueIdCalculator.rehashPath(canonicalRoot, "/a~2b"));
        assertThrows(IllegalArgumentException.class, () -> BlueIdCalculator.rehashPath(canonicalRoot, "/a~"));
        assertThrows(IllegalArgumentException.class, () -> BlueIdCalculator.rehashPath(canonicalRoot, "/01"));
        assertThrows(IllegalArgumentException.class, () -> BlueIdCalculator.rehashPath(canonicalRoot, "/999999999999999999999999"));
    }

    @Test
    void rehashPathResolvesEscapedPropertySegments() {
        Blue blue = new Blue();
        ResolvedSnapshot snapshot = blue.resolveToSnapshot(AUTHORING);
        Node canonicalRoot = snapshot.canonicalRoot().toNode();

        assertEquals(
                BlueIdCalculator.calculateSemanticBlueId(canonicalRoot.getProperties().get("a/b")),
                BlueIdCalculator.rehashPath(canonicalRoot, "/a~1b")
        );
        assertEquals(
                BlueIdCalculator.calculateSemanticBlueId(canonicalRoot.getProperties().get("a~b")),
                BlueIdCalculator.rehashPath(canonicalRoot, "/a~0b")
        );
        assertEquals(
                BlueIdCalculator.calculateSemanticBlueId(canonicalRoot.getProperties().get("a~/b")),
                BlueIdCalculator.rehashPath(canonicalRoot, "/a~0~1b")
        );
    }

    @Test
    void rehashPathPrefersPropertyWhenNumericSegmentCollidesWithListIndex() {
        Blue blue = new Blue();
        Node withNumericProperty = new Node()
                .name("Root")
                .items(
                        new Node().name("Item0"),
                        new Node().name("Item1")
                )
                .properties("0", new Node().value("zero-property"));

        ResolvedSnapshot snapshot = blue.resolveToSnapshot(withNumericProperty);
        Node canonicalRoot = snapshot.canonicalRoot().toNode();

        String propertyHash = BlueIdCalculator.calculateSemanticBlueId(canonicalRoot.getProperties().get("0"));
        String listItemHash = BlueIdCalculator.calculateSemanticBlueId(canonicalRoot.getItems().get(0));

        assertEquals(propertyHash, BlueIdCalculator.rehashPath(canonicalRoot, "/0"));
        assertEquals(propertyHash, snapshot.blueIdsByPointer().blueIdAt("/0"));
        assertNotEquals(listItemHash, propertyHash);
    }

    @Test
    void rehashPathFallsBackToArrayIndexWhenNoNumericPropertyMatchExists() {
        Blue blue = new Blue();
        Node mixedNode = new Node()
                .name("Root")
                .properties("mixed", new Node()
                        .items(new Node().name("Item0"), new Node().name("Item1"))
                        .properties("existing", new Node().value("keep")));

        ResolvedSnapshot snapshot = blue.resolveToSnapshot(mixedNode);
        Node canonicalRoot = snapshot.canonicalRoot().toNode();

        Node mixedCanonical = canonicalRoot.getProperties().get("mixed");
        String itemHash = BlueIdCalculator.calculateSemanticBlueId(mixedCanonical.getItems().get(1));
        assertEquals(itemHash, BlueIdCalculator.rehashPath(canonicalRoot, "/mixed/1"));
        assertEquals(itemHash, snapshot.blueIdsByPointer().blueIdAt("/mixed/1"));
    }

    @Test
    void rehashPathUsesLeadingZeroNumericPropertyOnMixedParentWhenKeyExists() {
        Blue blue = new Blue();
        Node mixedNode = new Node()
                .name("Root")
                .properties("mixed", new Node()
                        .items(new Node().name("Item0"), new Node().name("Item1"))
                        .properties("01", new Node().value("leading-zero-property"))
                        .properties("existing", new Node().value("keep")));

        ResolvedSnapshot snapshot = blue.resolveToSnapshot(mixedNode);
        Node canonicalRoot = snapshot.canonicalRoot().toNode();

        Node mixedCanonical = canonicalRoot.getProperties().get("mixed");
        String propertyHash = BlueIdCalculator.calculateSemanticBlueId(mixedCanonical.getProperties().get("01"));
        String itemHash = BlueIdCalculator.calculateSemanticBlueId(mixedCanonical.getItems().get(1));

        assertEquals(propertyHash, BlueIdCalculator.rehashPath(canonicalRoot, "/mixed/01"));
        assertEquals(propertyHash, snapshot.blueIdsByPointer().blueIdAt("/mixed/01"));
        assertEquals(itemHash, BlueIdCalculator.rehashPath(canonicalRoot, "/mixed/1"));
    }

    @Test
    void rehashPathUsesBuiltInChildSegmentsWithoutPropertyOverrides() {
        Blue blue = new Blue();
        Node resolved = new Node()
                .name("Root")
                .type(new Node().name("TypeNode"))
                .properties("listCarrier", new Node()
                        .type("List")
                        .itemType(new Node().name("ItemTypeNode")))
                .properties("dictCarrier", new Node()
                        .type("Dictionary")
                        .keyType(new Node().name("KeyTypeNode"))
                        .valueType(new Node().name("ValueTypeNode")));

        ResolvedSnapshot snapshot = blue.resolveToSnapshot(resolved, SnapshotTrust.BLIND_TRUST_RESOLVED);
        Node canonicalRoot = snapshot.canonicalRoot().toNode();

        for (String pointer : Arrays.asList(
                "/type",
                "/listCarrier/type",
                "/listCarrier/itemType",
                "/dictCarrier/type",
                "/dictCarrier/keyType",
                "/dictCarrier/valueType"
        )) {
            String indexedBlueId = snapshot.blueIdsByPointer().blueIdAt(pointer);
            assertNotNull(indexedBlueId, "Expected pointer in index: " + pointer);
            assertEquals(indexedBlueId, BlueIdCalculator.rehashPath(canonicalRoot, pointer));
        }
    }

    @Test
    void rehashPathSupportsTrailingEmptySegmentWhenPropertyExists() {
        Blue blue = new Blue();
        Node withEmptyPropertySegment = new Node()
                .name("Root")
                .properties("scope", new Node()
                        .properties("", new Node().value("empty-key")));

        ResolvedSnapshot snapshot = blue.resolveToSnapshot(withEmptyPropertySegment);
        Node canonicalRoot = snapshot.canonicalRoot().toNode();

        String nestedHash = BlueIdCalculator.calculateSemanticBlueId(
                canonicalRoot.getProperties().get("scope").getProperties().get(""));
        assertEquals(nestedHash, BlueIdCalculator.rehashPath(canonicalRoot, "/scope/"));
        assertEquals(nestedHash, snapshot.blueIdsByPointer().blueIdAt("/scope/"));
    }
}
