package blue.language.sdk.dsl;

import blue.language.Blue;
import blue.language.model.Node;
import com.fasterxml.jackson.databind.JsonNode;

import static blue.language.utils.UncheckedObjectMapper.JSON_MAPPER;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

final class DslParityAssertions {

    private static final Blue BLUE = new Blue();

    private DslParityAssertions() {
    }

    static void assertDslMatchesYaml(Node fromDsl, String yaml) {
        Node fromYaml = BLUE.preprocess(BLUE.yamlToNode(yaml).clone());
        Node normalizedDsl = BLUE.preprocess(fromDsl.clone());
        String expectedBlueId = BLUE.calculateBlueId(fromYaml);
        String actualBlueId = BLUE.calculateBlueId(normalizedDsl);
        assertNotNull(expectedBlueId);
        assertNotNull(actualBlueId);
        JsonNode expectedTree = JSON_MAPPER.readTree(BLUE.nodeToSimpleJson(fromYaml));
        JsonNode actualTree = JSON_MAPPER.readTree(BLUE.nodeToSimpleJson(normalizedDsl));
        assertEquals(
                expectedTree,
                actualTree,
                () -> "Expected YAML:\n" + BLUE.nodeToSimpleYaml(fromYaml)
                        + "\nActual DSL:\n" + BLUE.nodeToSimpleYaml(normalizedDsl));
    }
}
