package blue.language.processor.script;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CodeBlockEvaluationErrorTest {

    @Test
    void messageIncludesOriginalCodeWhenShort() {
        RuntimeException cause = new RuntimeException("boom");
        CodeBlockEvaluationError error = new CodeBlockEvaluationError("return 1 + 1;", cause);

        assertEquals("return 1 + 1;", error.code());
        assertTrue(error.getMessage().contains("Failed to evaluate code block: return 1 + 1;"));
        assertEquals(cause, error.getCause());
    }

    @Test
    void messageTruncatesLongCodeSnippet() {
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < 200; i++) {
            builder.append('a');
        }
        String longCode = builder.toString();
        CodeBlockEvaluationError error = new CodeBlockEvaluationError(longCode, null);

        assertEquals(longCode, error.code());
        assertTrue(error.getMessage().startsWith("Failed to evaluate code block: "));
        assertTrue(error.getMessage().endsWith("..."));
        assertTrue(error.getMessage().length() < ("Failed to evaluate code block: " + longCode).length());
    }

    @Test
    void exposesRuntimeMetadataWhenCauseIsScriptRuntimeException() {
        ScriptRuntimeException cause = new ScriptRuntimeException(
                "runtime failed",
                "TypeError",
                "bad input",
                true,
                "TypeError: bad input\n    at <eval>");
        CodeBlockEvaluationError error = new CodeBlockEvaluationError("throw new TypeError('bad input')", cause);

        assertEquals("TypeError", error.runtimeErrorName());
        assertEquals("bad input", error.runtimeErrorMessage());
        assertTrue(error.runtimeStackAvailable());
        assertTrue(String.valueOf(error.runtimeStack()).contains("TypeError: bad input"));
    }

    @Test
    void runtimeMetadataDefaultsWhenCauseIsNotScriptRuntimeException() {
        CodeBlockEvaluationError error = new CodeBlockEvaluationError("throw new Error('x')", new RuntimeException("x"));

        assertNull(error.runtimeErrorName());
        assertNull(error.runtimeErrorMessage());
        assertFalse(error.runtimeStackAvailable());
        assertNull(error.runtimeStack());
    }
}
