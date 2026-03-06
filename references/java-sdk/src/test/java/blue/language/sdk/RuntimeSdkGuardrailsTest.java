package blue.language.sdk;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RuntimeSdkGuardrailsTest {

    @Test
    void mainSourcesDoNotImportSamplesPackages() throws IOException {
        Path mainRoot = Paths.get("src/main/java");
        try (Stream<Path> files = Files.walk(mainRoot)) {
            List<Path> violating = files
                    .filter(path -> path.toString().endsWith(".java"))
                    .filter(this::containsSamplesImport)
                    .collect(Collectors.toList());

            assertTrue(violating.isEmpty(),
                    () -> "Main sources cannot import blue.language.samples.*; violations: " + violating);
        }
    }

    @Test
    void runtimeSdkClassesLiveInCanonicalPackages() {
        assertDoesNotThrow(() -> Class.forName("blue.language.sdk.DocBuilder"));
        assertDoesNotThrow(() -> Class.forName("blue.language.sdk.SimpleDocBuilder"));
        assertDoesNotThrow(() -> Class.forName("blue.language.sdk.MyOsSteps"));
        assertDoesNotThrow(() -> Class.forName("blue.language.sdk.MyOsPermissions"));
        assertDoesNotThrow(() -> Class.forName("blue.language.sdk.paynote.PayNoteBuilder"));
        assertDoesNotThrow(() -> Class.forName("blue.language.sdk.paynote.PayNotes"));

        assertDoesNotThrow(() -> Class.forName("blue.language.types.common.NamedEvent"));
        assertDoesNotThrow(() -> Class.forName("blue.language.types.conversation.Operation"));
        assertDoesNotThrow(() -> Class.forName("blue.language.processor.model.DocumentUpdate"));
        assertDoesNotThrow(() -> Class.forName("blue.language.types.myos.CallOperationRequested"));
        assertDoesNotThrow(() -> Class.forName("blue.language.types.paynote.CaptureFundsRequested"));
    }

    private boolean containsSamplesImport(Path path) {
        try {
            String content = Files.readString(path, StandardCharsets.UTF_8);
            return content.contains("import blue.language.samples.");
        } catch (IOException e) {
            throw new RuntimeException("Failed reading source file: " + path, e);
        }
    }
}
