package blue.language.snapshot;

import blue.language.Blue;
import blue.language.model.Node;
import blue.language.processor.model.JsonPatch;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertTrue;

class MinimizeByConstructionNoOpOverrideTest {

    @Test
    void replacingWithInheritedValueMustRemoveLocalOverride() {
        Blue blue = new Blue();
        Node authoring = blue.yamlToNode(
                "type:\n" +
                        "  name: Base\n" +
                        "  x: 1\n" +
                        "x: 1\n"
        );

        ResolvedSnapshot snapshot = blue.resolveToSnapshot(authoring);
        WorkingDocument workingDocument = WorkingDocument.forSnapshot(blue, snapshot);
        workingDocument.applyPatch(JsonPatch.replace("/x", new Node().value(1)));

        Node canonical = workingDocument.commit().canonicalRoot().toNode();
        Map<String, Node> properties = canonical.getProperties();
        assertTrue(properties == null || !properties.containsKey("x"));
    }
}
