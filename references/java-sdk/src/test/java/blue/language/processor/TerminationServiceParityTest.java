package blue.language.processor;

import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TerminationServiceParityTest {

    @Test
    void writesTerminationMarkerAndChargesGas() {
        DocumentProcessor processor = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(processor, new Node());
        DocumentProcessingRuntime runtime = execution.runtime();
        TerminationService service = new TerminationService(runtime);

        service.terminateScope(
                execution,
                "/scope",
                null,
                ScopeRuntimeContext.TerminationKind.GRACEFUL,
                "done");

        Node marker = ProcessorEngine.nodeAt(runtime.document(), "/scope/contracts/terminated");
        assertNotNull(marker);
        assertEquals("graceful", String.valueOf(ProcessorEngine.nodeAt(runtime.document(), "/scope/contracts/terminated/cause").getValue()));
        assertEquals("done", String.valueOf(ProcessorEngine.nodeAt(runtime.document(), "/scope/contracts/terminated/reason").getValue()));
        assertTrue(runtime.isScopeTerminated("/scope"));
        assertFalse(runtime.isRunTerminated());
        assertTrue(runtime.totalGas() > 0);
    }

    @Test
    void throwsRunTerminationOnRootFatalAndEmitsTerminationLifecycle() {
        DocumentProcessor processor = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(processor, new Node());
        DocumentProcessingRuntime runtime = execution.runtime();
        TerminationService service = new TerminationService(runtime);

        RunTerminationException thrown = assertThrows(
                RunTerminationException.class,
                () -> service.terminateScope(
                        execution,
                        "/",
                        null,
                        ScopeRuntimeContext.TerminationKind.FATAL,
                        "bad"));
        assertTrue(thrown.fatal());

        Node marker = ProcessorEngine.nodeAt(runtime.document(), "/contracts/terminated");
        assertNotNull(marker);
        assertEquals("fatal", String.valueOf(ProcessorEngine.nodeAt(runtime.document(), "/contracts/terminated/cause").getValue()));
        assertEquals("bad", String.valueOf(ProcessorEngine.nodeAt(runtime.document(), "/contracts/terminated/reason").getValue()));

        assertTrue(runtime.isRunTerminated());
        assertEquals(1, runtime.rootEmissions().size());
        Node lifecycle = runtime.rootEmissions().get(0);
        assertEquals("Document Processing Terminated", lifecycle.getType().getBlueId());
        assertEquals("fatal", String.valueOf(ProcessorEngine.nodeAt(lifecycle, "/cause").getValue()));
        assertEquals("bad", String.valueOf(ProcessorEngine.nodeAt(lifecycle, "/reason").getValue()));
    }

    @Test
    void throwsNonFatalRunTerminationOnRootGracefulAndEmitsLifecycle() {
        DocumentProcessor processor = new DocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(processor, new Node());
        DocumentProcessingRuntime runtime = execution.runtime();
        TerminationService service = new TerminationService(runtime);

        RunTerminationException thrown = assertThrows(
                RunTerminationException.class,
                () -> service.terminateScope(
                        execution,
                        "/",
                        null,
                        ScopeRuntimeContext.TerminationKind.GRACEFUL,
                        "done"));
        assertFalse(thrown.fatal());

        Node marker = ProcessorEngine.nodeAt(runtime.document(), "/contracts/terminated");
        assertNotNull(marker);
        assertEquals("graceful", String.valueOf(ProcessorEngine.nodeAt(runtime.document(), "/contracts/terminated/cause").getValue()));
        assertEquals("done", String.valueOf(ProcessorEngine.nodeAt(runtime.document(), "/contracts/terminated/reason").getValue()));
        assertTrue(runtime.isRunTerminated());

        assertEquals(1, runtime.rootEmissions().size());
        Node lifecycle = runtime.rootEmissions().get(0);
        assertEquals("Document Processing Terminated", lifecycle.getType().getBlueId());
        assertEquals("graceful", String.valueOf(ProcessorEngine.nodeAt(lifecycle, "/cause").getValue()));
        assertEquals("done", String.valueOf(ProcessorEngine.nodeAt(lifecycle, "/reason").getValue()));
    }
}
