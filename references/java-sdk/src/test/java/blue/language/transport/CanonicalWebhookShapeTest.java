package blue.language.transport;

import blue.language.Blue;
import blue.language.model.Node;
import blue.language.snapshot.ResolvedSnapshot;
import blue.language.snapshot.SnapshotTrust;
import blue.language.utils.UncheckedObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Scanner;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CanonicalWebhookShapeTest {

    @Test
    void canonicalShapeIsSmallerThanResolvedExplosion() {
        Blue blue = new Blue();
        String fixtureJson = loadFixture("fixtures/counter-webhook.json");
        Node resolvedWebhook = UncheckedObjectMapper.JSON_MAPPER.readValue(fixtureJson, Node.class);

        ResolvedSnapshot snapshot = blue.resolveToSnapshot(resolvedWebhook, SnapshotTrust.BLIND_TRUST_RESOLVED);
        String resolvedJson = blue.nodeToJson(resolvedWebhook);
        String canonicalJson = blue.nodeToJson(snapshot.canonicalRoot().toNode());

        assertNotNull(snapshot.rootBlueId());
        assertTrue(snapshot.blueIdsByPointer().asMap().containsKey("/"));
        assertTrue(canonicalJson.length() < resolvedJson.length(),
                "Canonical document should be smaller than the expanded resolved payload");
        assertFalse(canonicalJson.contains("computedBlueId"));
    }

    private String loadFixture(String path) {
        InputStream inputStream = getClass().getClassLoader().getResourceAsStream(path);
        assertNotNull(inputStream, "Missing fixture: " + path);
        try (Scanner scanner = new Scanner(inputStream, StandardCharsets.UTF_8.name())) {
            return scanner.useDelimiter("\\A").hasNext() ? scanner.next() : "";
        }
    }
}
