package blue.language.provider;

import blue.language.model.Node;
import blue.language.snapshot.ResolvedSnapshot;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BasicNodeProviderSemanticTest {

    @Test
    void addSingleDocsSemanticStoresCanonicalSnapshot() {
        BasicNodeProvider provider = new BasicNodeProvider();

        String semanticBlueId = provider.addSingleDocsSemantic(
                "name: Counter\n" +
                        "counter: 0\n"
        );

        assertNotNull(semanticBlueId);
        Optional<ResolvedSnapshot> snapshot = provider.findSnapshotBySemanticBlueId(semanticBlueId);
        assertTrue(snapshot.isPresent());
        assertEquals(semanticBlueId, snapshot.get().rootBlueId());

        List<Node> fetched = provider.fetchByBlueId(semanticBlueId);
        assertNotNull(fetched);
        assertEquals(1, fetched.size());
        assertEquals("Counter", fetched.get(0).getName());
    }

    @Test
    void addMultipleDocsSemanticStoresListBySemanticBlueId() {
        BasicNodeProvider provider = new BasicNodeProvider();

        String listBlueId = provider.addMultipleDocsSemantic(
                "- name: A\n" +
                        "  v: 1\n" +
                        "- name: B\n" +
                        "  v: 2\n"
        );

        assertNotNull(listBlueId);
        List<Node> list = provider.fetchByBlueId(listBlueId);
        assertNotNull(list);
        assertEquals(2, list.size());
        assertEquals("A", list.get(0).getName());
        assertEquals("B", list.get(1).getName());

        List<Node> second = provider.fetchByBlueId(listBlueId + "#1");
        assertNotNull(second);
        assertEquals(1, second.size());
        assertEquals("B", second.get(0).getName());
    }
}
