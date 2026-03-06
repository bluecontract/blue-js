package blue.language.processor;

import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DocumentProcessingRuntimeScopeTest {

    @Test
    void scopeTreatsNullAndEmptyAsRoot() {
        DocumentProcessingRuntime runtime = new DocumentProcessingRuntime(new Node());

        ScopeRuntimeContext root = runtime.scope("/");
        assertSame(root, runtime.scope(null));
        assertSame(root, runtime.scope(""));
    }

    @Test
    void scopesViewIsUnmodifiable() {
        DocumentProcessingRuntime runtime = new DocumentProcessingRuntime(new Node());
        runtime.scope("/");

        Map<String, ScopeRuntimeContext> scopes = runtime.scopes();
        assertThrows(UnsupportedOperationException.class,
                () -> scopes.put("/x", new ScopeRuntimeContext("/x")));
    }

    @Test
    void scopeApisNormalizeNonPointerScopeInputs() {
        DocumentProcessingRuntime runtime = new DocumentProcessingRuntime(new Node());

        ScopeRuntimeContext normalized = runtime.scope("scope");
        assertSame(normalized, runtime.scope("/scope"));
        assertNull(runtime.existingScope("missing"));

        runtime.chargeScopeEntry("scope");
        assertTrue(runtime.totalGas() > 0L);
    }
}
