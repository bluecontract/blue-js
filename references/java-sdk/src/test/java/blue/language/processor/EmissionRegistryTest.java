package blue.language.processor;

import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EmissionRegistryTest {

    @Test
    void createsAndReusesScopeRuntimeContexts() {
        EmissionRegistry registry = new EmissionRegistry();

        ScopeRuntimeContext contextA = registry.scope("/root");
        ScopeRuntimeContext contextB = registry.scope("/root");

        assertSame(contextA, contextB);
        assertNull(registry.existingScope("/missing"));
    }

    @Test
    void scopeTreatsNullAndEmptyAsRoot() {
        EmissionRegistry registry = new EmissionRegistry();
        ScopeRuntimeContext root = registry.scope("/");
        assertNotNull(root);
        assertSame(root, registry.scope(null));
        assertSame(root, registry.scope(""));
    }

    @Test
    void scopeNormalizesNonPointerInputs() {
        EmissionRegistry registry = new EmissionRegistry();
        ScopeRuntimeContext normalized = registry.scope("root");
        assertSame(normalized, registry.scope("/root"));
        assertNull(registry.existingScope("/missing"));
        assertSame(normalized, registry.existingScope("root"));
        registry.clearScope("root");
        assertNull(registry.existingScope("/root"));
    }

    @Test
    void terminationLookupAndClearUseNormalizedScope() {
        EmissionRegistry registry = new EmissionRegistry();
        ScopeRuntimeContext root = registry.scope("/");
        root.finalizeTermination(ScopeRuntimeContext.TerminationKind.GRACEFUL, "done");

        assertTrue(registry.isScopeTerminated(null));
        assertTrue(registry.isScopeTerminated(""));

        registry.clearScope("");
        assertNull(registry.existingScope("/"));
        assertFalse(registry.isScopeTerminated("/"));
    }

    @Test
    void recordsRootEmissionsInOrder() {
        EmissionRegistry registry = new EmissionRegistry();
        Node first = new Node().properties("id", new Node().value("1"));
        Node second = new Node().properties("id", new Node().value("2"));

        registry.recordRootEmission(first);
        registry.recordRootEmission(second);

        assertEquals(Arrays.asList(first, second), registry.rootEmissions());
    }

    @Test
    void tracksTerminatedScopesAndAllowsClearing() {
        EmissionRegistry registry = new EmissionRegistry();
        ScopeRuntimeContext child = registry.scope("/child");
        child.finalizeTermination(ScopeRuntimeContext.TerminationKind.GRACEFUL, null);

        assertTrue(registry.isScopeTerminated("/child"));
        registry.clearScope("/child");
        assertFalse(registry.isScopeTerminated("/child"));
    }
}
