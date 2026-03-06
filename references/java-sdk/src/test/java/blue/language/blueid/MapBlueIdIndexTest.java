package blue.language.blueid;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MapBlueIdIndexTest {

    @Test
    void blueIdAtNormalizesRootPointerLookups() {
        Map<String, String> ids = new LinkedHashMap<String, String>();
        ids.put("/", "root-blue-id");

        MapBlueIdIndex index = MapBlueIdIndex.from(ids);
        assertEquals("root-blue-id", index.blueIdAt("/"));
        assertEquals("root-blue-id", index.blueIdAt(""));
        assertEquals("root-blue-id", index.blueIdAt(null));
    }

    @Test
    void blueIdAtRejectsNonPointerPaths() {
        Map<String, String> ids = new LinkedHashMap<String, String>();
        ids.put("/", "root-blue-id");

        MapBlueIdIndex index = MapBlueIdIndex.from(ids);
        assertThrows(IllegalArgumentException.class, () -> index.blueIdAt("root"));
        assertThrows(IllegalArgumentException.class, () -> index.blueIdAt("/x~"));
        assertThrows(IllegalArgumentException.class, () -> index.blueIdAt("/x~2"));
    }

    @Test
    void blueIdAtKeepsTrailingSegmentsExact() {
        Map<String, String> ids = new LinkedHashMap<String, String>();
        ids.put("/scope", "scope-id");
        ids.put("/scope/", "scope-empty-child-id");

        MapBlueIdIndex index = MapBlueIdIndex.from(ids);
        assertEquals("scope-id", index.blueIdAt("/scope"));
        assertEquals("scope-empty-child-id", index.blueIdAt("/scope/"));
    }

    @Test
    void fromNormalizesStoredEmptyRootKey() {
        Map<String, String> ids = new LinkedHashMap<String, String>();
        ids.put("", "root-blue-id");

        MapBlueIdIndex index = MapBlueIdIndex.from(ids);
        assertEquals("root-blue-id", index.blueIdAt("/"));
        assertTrue(index.asMap().containsKey("/"));
    }

    @Test
    void fromRejectsInvalidStoredPointerKeys() {
        Map<String, String> ids = new LinkedHashMap<String, String>();
        ids.put("root", "bad");

        assertThrows(IllegalArgumentException.class, () -> MapBlueIdIndex.from(ids));
        ids.clear();
        ids.put("/x~", "bad");
        assertThrows(IllegalArgumentException.class, () -> MapBlueIdIndex.from(ids));
    }

    @Test
    void fromRejectsDuplicateNormalizedPointerKeys() {
        Map<String, String> ids = new LinkedHashMap<String, String>();
        ids.put("", "root-a");
        ids.put("/", "root-b");

        assertThrows(IllegalArgumentException.class, () -> MapBlueIdIndex.from(ids));
    }

    @Test
    void fromRejectsMissingBlueIdValues() {
        Map<String, String> ids = new LinkedHashMap<String, String>();
        ids.put("/", null);
        assertThrows(IllegalArgumentException.class, () -> MapBlueIdIndex.from(ids));

        ids.clear();
        ids.put("/", "   ");
        assertThrows(IllegalArgumentException.class, () -> MapBlueIdIndex.from(ids));
    }
}
