package blue.language.snapshot;

import blue.language.Blue;
import blue.language.model.Node;
import blue.language.processor.model.JsonPatch;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ReadResolvePatchCommitTest {

    @Test
    void readsResolvesPatchesAndCommits() {
        Blue blue = new Blue();
        Node authoring = blue.yamlToNode(
                "name: Counter\n" +
                        "counter: 0\n"
        );

        ResolvedSnapshot initial = blue.resolveToSnapshot(authoring);
        assertNotNull(initial);
        assertNotNull(initial.rootBlueId());
        assertNotNull(initial.canonicalRoot());
        assertNotNull(initial.resolvedRoot());
        assertNotNull(initial.blueIdsByPointer());
        assertFalse(initial.blueIdsByPointer().asMap().isEmpty());

        WorkingDocument workingDocument = WorkingDocument.forSnapshot(blue, initial);
        PatchReport report = workingDocument.applyPatch(JsonPatch.replace("/counter", new Node().value(1)));
        assertNotNull(report);
        assertTrue(report.changed());
        assertEquals("/counter", report.appliedPaths().get(0));

        ResolvedSnapshot next = workingDocument.commit();
        assertNotNull(next);
        assertNotEquals(initial.rootBlueId(), next.rootBlueId());
        assertEquals(1, next.resolvedRoot().toNode().getAsInteger("/counter/value"));
    }
}
