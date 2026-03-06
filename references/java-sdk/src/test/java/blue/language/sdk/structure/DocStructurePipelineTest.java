package blue.language.sdk.structure;

import blue.language.Blue;
import blue.language.model.Node;
import blue.language.sdk.patch.ChangeRequestApplier;
import blue.language.sdk.patch.ChangeRequestCompiler;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

import java.util.List;

import static blue.language.utils.UncheckedObjectMapper.JSON_MAPPER;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class DocStructurePipelineTest {

    private static final Blue BLUE = new Blue();

    @Test
    void fullPipelineAcrossAllExampleDocs() {
        List<ExampleDocs.Scenario> scenarios = ExampleDocs.allExampleDocs();
        assertFalse(scenarios.isEmpty());
        assertFalse(scenarios.size() < 20, "Expected at least 20 scenarios");

        for (ExampleDocs.Scenario scenario : scenarios) {
            Node base = scenario.base.clone();
            DocStructure structBefore = DocStructure.from(base);
            assertNotNull(structBefore.toPromptText(), "Prompt text missing for " + scenario.name);

            Node modified = scenario.mutation.apply(base.clone());
            Node changeRequest = ChangeRequestCompiler.compile(base, modified);
            Node applied = ChangeRequestApplier.apply(base.clone(), changeRequest);

            assertCanonicalEquals(applied, modified, scenario.name);

            DocStructure structApplied = DocStructure.from(applied);
            DocStructure structModified = DocStructure.from(modified);
            assertEquals(structApplied.contracts.keySet(), structModified.contracts.keySet(), "contracts mismatch for " + scenario.name);
            assertEquals(structApplied.rootFields.keySet(), structModified.rootFields.keySet(), "root fields mismatch for " + scenario.name);
            assertEquals(structApplied.sections.keySet(), structModified.sections.keySet(), "sections mismatch for " + scenario.name);
        }
    }

    @Test
    void structureIsStableAcrossRebuild() {
        for (ExampleDocs.Scenario scenario : ExampleDocs.allBaseDocsOnly()) {
            Node doc = scenario.base.clone();
            DocStructure s1 = DocStructure.from(doc);
            DocStructure s2 = DocStructure.from(doc.clone());

            assertEquals(s1.contracts.keySet(), s2.contracts.keySet(), "contract keys mismatch for " + scenario.name);
            for (String key : s1.contracts.keySet()) {
                assertEquals(
                        s1.contracts.get(key).fingerprint,
                        s2.contracts.get(key).fingerprint,
                        "Fingerprint mismatch for " + key + " in " + scenario.name);
            }
            assertEquals(s1.sections.keySet(), s2.sections.keySet(), "section keys mismatch for " + scenario.name);
        }
    }

    private static void assertCanonicalEquals(Node actual, Node expected, String scenarioName) {
        Node expectedCanonical = BLUE.preprocess(expected.clone());
        Node actualCanonical = BLUE.preprocess(actual.clone());
        JsonNode expectedTree = JSON_MAPPER.readTree(BLUE.nodeToSimpleJson(expectedCanonical));
        JsonNode actualTree = JSON_MAPPER.readTree(BLUE.nodeToSimpleJson(actualCanonical));
        assertEquals(expectedTree, actualTree, "Canonical mismatch for scenario: " + scenarioName);
    }
}
