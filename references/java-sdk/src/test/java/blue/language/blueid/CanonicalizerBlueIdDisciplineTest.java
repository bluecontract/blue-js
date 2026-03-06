package blue.language.blueid;

import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CanonicalizerBlueIdDisciplineTest {

    @Test
    void pureReferenceKeepsBlueId() {
        Node reference = new Node().blueId("ReferenceOnly");
        Object canonical = Canonicalizer.toCanonicalObject(reference);

        assertTrue(canonical instanceof Map);
        Map<?, ?> map = (Map<?, ?>) canonical;
        assertEquals(1, map.size());
        assertEquals("ReferenceOnly", map.get("blueId"));
    }

    @Test
    void nonReferenceNodeDropsBlueIdField() {
        Node mixed = new Node()
                .blueId("NotAllowedOnPayloadNode")
                .properties("x", new Node().value(1));

        Object canonical = Canonicalizer.toCanonicalObject(mixed);
        assertTrue(canonical instanceof Map);
        Map<?, ?> map = (Map<?, ?>) canonical;
        assertFalse(map.containsKey("blueId"));
        assertTrue(map.containsKey("x"));
    }
}
