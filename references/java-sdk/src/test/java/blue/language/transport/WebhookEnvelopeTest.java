package blue.language.transport;

import blue.language.Blue;
import blue.language.model.Node;
import blue.language.provider.BasicNodeProvider;
import blue.language.snapshot.ResolvedSnapshot;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WebhookEnvelopeTest {

    @Test
    void createsCanonicalWebhookEnvelopeFromSnapshot() {
        Blue blue = new Blue();
        Node doc = blue.yamlToNode(
                "name: EnvelopeDoc\n" +
                        "counter: 1\n"
        );

        ResolvedSnapshot snapshot = blue.resolveToSnapshot(doc);
        WebhookEnvelope envelope = WebhookEnvelope.fromSnapshot(snapshot);

        assertEquals(snapshot.rootBlueId(), envelope.rootBlueId());
        assertTrue(envelope.canonical() instanceof Map);
        assertTrue(envelope.blueIdsByPointer().containsKey("/"));
        assertTrue(envelope.bundle().isEmpty());
    }

    @Test
    void canAttachReferenceBundleFromProvider() {
        BasicNodeProvider provider = new BasicNodeProvider();
        provider.addSingleDocs(
                "name: BaseType\n" +
                        "x: 1\n"
        );
        String baseTypeBlueId = provider.getBlueIdByName("BaseType");

        Blue blue = new Blue(provider);
        Node doc = blue.yamlToNode(
                "name: Derived\n" +
                        "type:\n" +
                        "  blueId: " + baseTypeBlueId + "\n"
        );

        ResolvedSnapshot snapshot = blue.resolveToSnapshot(doc);
        WebhookEnvelope envelope = WebhookEnvelope.fromSnapshot(snapshot, blue);

        assertFalse(envelope.bundle().isEmpty());
        assertTrue(envelope.bundle().containsKey(baseTypeBlueId));
    }

    @Test
    void canAttachTransitiveReferenceBundleFromProvider() {
        BasicNodeProvider provider = new BasicNodeProvider();
        provider.addSingleDocs("name: RootType\nx: 1\n");

        String rootTypeBlueId = provider.getBlueIdByName("RootType");

        provider.addSingleDocs(
                "name: MidTypeTyped\n" +
                        "type:\n" +
                        "  blueId: " + rootTypeBlueId + "\n"
        );
        String midTypeBlueId = provider.getBlueIdByName("MidTypeTyped");

        provider.addSingleDocs(
                "name: LeafTypeTyped\n" +
                        "type:\n" +
                        "  blueId: " + midTypeBlueId + "\n"
        );
        String leafTypeBlueId = provider.getBlueIdByName("LeafTypeTyped");

        Blue blue = new Blue(provider);
        Node doc = blue.yamlToNode(
                "name: Derived\n" +
                        "type:\n" +
                        "  blueId: " + leafTypeBlueId + "\n"
        );

        ResolvedSnapshot snapshot = blue.resolveToSnapshot(doc);
        WebhookEnvelope envelope = WebhookEnvelope.fromSnapshot(snapshot, blue);

        assertTrue(envelope.bundle().containsKey(leafTypeBlueId));
        assertTrue(envelope.bundle().containsKey(midTypeBlueId));
        assertTrue(envelope.bundle().containsKey(rootTypeBlueId));
    }
}
