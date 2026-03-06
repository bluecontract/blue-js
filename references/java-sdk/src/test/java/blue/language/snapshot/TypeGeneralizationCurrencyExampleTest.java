package blue.language.snapshot;

import blue.language.Blue;
import blue.language.model.Node;
import blue.language.processor.model.JsonPatch;
import blue.language.provider.BasicNodeProvider;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TypeGeneralizationCurrencyExampleTest {

    @Test
    void patchingCurrencyMustTriggerTypeGeneralization() {
        BasicNodeProvider provider = new BasicNodeProvider();
        provider.addSingleDocs(
                "name: Price\n" +
                        "amount:\n" +
                        "  type: Integer\n" +
                        "currency:\n" +
                        "  type: Text\n"
        );
        String priceBlueId = provider.getBlueIdByName("Price");
        provider.addSingleDocs(
                "name: PriceInEUR\n" +
                        "type:\n" +
                        "  blueId: " + priceBlueId + "\n" +
                        "currency: EUR\n"
        );
        String priceInEURBlueId = provider.getBlueIdByName("PriceInEUR");

        Blue blue = new Blue(provider);
        Node doc = blue.yamlToNode(
                "price:\n" +
                        "  type:\n" +
                        "    blueId: " + priceInEURBlueId + "\n" +
                        "  currency: EUR\n" +
                        "  amount: 10\n"
        );

        ResolvedSnapshot snapshot = blue.resolveToSnapshot(doc);
        WorkingDocument workingDocument = WorkingDocument.forSnapshot(blue, snapshot);
        PatchReport report = workingDocument.applyPatch(JsonPatch.replace("/price/currency", new Node().value("USD")));

        assertTrue(report.generalizationReport().hasGeneralizations());
        List<String> generalizations = report.generalizationReport().generalizations();
        assertFalse(generalizations.isEmpty());
        assertTrue(generalizations.get(0).startsWith("/price"));

        ResolvedSnapshot committed = workingDocument.commit();
        assertEquals(priceBlueId, committed.resolvedRoot().toNode().getAsText("/price/type/blueId"));
    }

    @Test
    void patchAndCommitDoNotRequireProviderLookupsForResolvedSnapshots() {
        BasicNodeProvider provider = new BasicNodeProvider();
        provider.addSingleDocs(
                "name: Price\n" +
                        "amount:\n" +
                        "  type: Integer\n" +
                        "currency:\n" +
                        "  type: Text\n"
        );
        String priceBlueId = provider.getBlueIdByName("Price");
        provider.addSingleDocs(
                "name: PriceInEUR\n" +
                        "type:\n" +
                        "  blueId: " + priceBlueId + "\n" +
                        "currency: EUR\n"
        );
        String priceInEURBlueId = provider.getBlueIdByName("PriceInEUR");

        Blue bootstrapBlue = new Blue(provider);
        Node doc = bootstrapBlue.yamlToNode(
                "price:\n" +
                        "  type:\n" +
                        "    blueId: " + priceInEURBlueId + "\n" +
                        "  currency: EUR\n" +
                        "  amount: 10\n"
        );
        ResolvedSnapshot snapshot = bootstrapBlue.resolveToSnapshot(doc);

        Blue noLookupBlue = new Blue(blueId -> {
            throw new AssertionError("Unexpected provider lookup for blueId: " + blueId);
        });
        WorkingDocument workingDocument = WorkingDocument.forSnapshot(noLookupBlue, snapshot);

        PatchReport report = workingDocument.applyPatch(JsonPatch.replace("/price/currency", new Node().value("USD")));
        assertTrue(report.generalizationReport().hasGeneralizations());

        ResolvedSnapshot committed = workingDocument.commit();
        assertEquals(priceBlueId, committed.resolvedRoot().toNode().getAsText("/price/type/blueId"));
    }

    @Test
    void typeBlueIdOnTypeNodeDoesNotRequireMatchingInstanceBlueId() {
        Blue blue = new Blue();
        Node doc = new Node()
                .properties("price", new Node()
                        .type(new Node()
                                .name("SpecificPrice")
                                .blueId("type-blue-id")
                                .type(new Node().name("GeneralPrice")))
                        .properties("currency", new Node().value("USD")));

        TypeGeneralizer generalizer = new TypeGeneralizer();
        GeneralizationReport report = generalizer.generalizeToSoundness(blue, doc, "/price/currency");

        assertTrue(report.generalizations().isEmpty(),
                "Type conformance must not compare type.blueId to instance blueId");
        assertEquals("SpecificPrice", doc.getAsNode("/price/type").getName());
    }
}
