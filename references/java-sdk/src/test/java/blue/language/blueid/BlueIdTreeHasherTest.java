package blue.language.blueid;

import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BlueIdTreeHasherTest {

    @Test
    void hashAndIndexMatchesSemanticHashAndPointerRehashes() {
        List<Node> listItems = new ArrayList<Node>();
        listItems.add(new Node().value(1));
        listItems.add(new Node().blueId("reference-item"));

        Node canonicalRoot = new Node()
                .name("Root")
                .type(new Node().blueId("type-blue-id"))
                .properties("plain", new Node().value("value"))
                .properties("a/b", new Node()
                        .properties("~tilde", new Node().value(7)))
                .properties("list", new Node()
                        .items(listItems));

        BlueIdTreeHasher.BlueIdTreeHashResult result = BlueIdTreeHasher.hashAndIndex(canonicalRoot);

        assertEquals(BlueIdCalculator.calculateSemanticBlueId(canonicalRoot), result.rootBlueId());
        assertPointerHashMatchesRehash(canonicalRoot, result, "/");
        assertPointerHashMatchesRehash(canonicalRoot, result, "/type");
        assertPointerHashMatchesRehash(canonicalRoot, result, "/plain");
        assertPointerHashMatchesRehash(canonicalRoot, result, "/a~1b");
        assertPointerHashMatchesRehash(canonicalRoot, result, "/a~1b/~0tilde");
        assertPointerHashMatchesRehash(canonicalRoot, result, "/list");
        assertPointerHashMatchesRehash(canonicalRoot, result, "/list/0");
        assertPointerHashMatchesRehash(canonicalRoot, result, "/list/1");
    }

    @Test
    void hashAndIndexCallsHashProviderLinearToNodeCountForBareLists() {
        List<Node> items = new ArrayList<Node>();
        for (int i = 0; i < 100; i++) {
            items.add(new Node().value(i));
        }
        Node canonicalRoot = new Node().items(items);

        AtomicInteger calls = new AtomicInteger();
        Function<Object, String> countingHashProvider = value -> "h" + calls.incrementAndGet();

        BlueIdTreeHasher.hashAndIndex(canonicalRoot, countingHashProvider);

        assertTrue(calls.get() <= 305, "Expected linear hash calls but got " + calls.get());
    }

    private void assertPointerHashMatchesRehash(Node canonicalRoot,
                                                BlueIdTreeHasher.BlueIdTreeHashResult result,
                                                String pointer) {
        assertEquals(
                BlueIdCalculator.rehashPath(canonicalRoot, pointer),
                result.index().blueIdAt(pointer)
        );
    }
}
