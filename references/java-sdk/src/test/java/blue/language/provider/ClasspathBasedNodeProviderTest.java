package blue.language.provider;

import blue.language.model.Node;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ClasspathBasedNodeProviderTest {

    private ClasspathBasedNodeProvider provider;

    @BeforeEach
    void setUp() throws IOException {
        provider = new ClasspathBasedNodeProvider("samples");
    }

    @Test
    void testFetchByBlueId() {
        Node knownNode = provider.findNodeByName("Toy")
                .orElseThrow(() -> new AssertionError("Expected sample node 'Toy' to be present"));
        String knownBlueId = knownNode.getBlueId();
        List<Node> nodes = provider.fetchByBlueId(knownBlueId);
        assertNotNull(nodes);
        assertFalse(nodes.isEmpty());
        assertEquals("Toy", nodes.get(0).getName());
        assertEquals(knownBlueId, nodes.get(0).get("/blueId"));
    }

    @Test
    void testInvalidDirectory() {
        assertThrows(IOException.class, () ->
                new ClasspathBasedNodeProvider("non-existent-directory"));
    }
}