package blue.language.processor;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.processor.model.HandlerContract;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProcessorEngineHandlerMatchesTest {

    @Test
    void executeHandlerSkipsExecutionWhenHandlerMatchesReturnsFalse() {
        MatchAwareHandlerProcessor processor = new MatchAwareHandlerProcessor(false);
        DocumentProcessor owner = new DocumentProcessor(newRegistry(processor));
        ProcessorExecutionContext context = newContext(owner);

        ProcessorEngine.executeHandler(owner, new MatchAwareHandler(), context);

        assertFalse(processor.executed);
    }

    @Test
    void executeHandlerRunsExecutionWhenHandlerMatchesReturnsTrue() {
        MatchAwareHandlerProcessor processor = new MatchAwareHandlerProcessor(true);
        DocumentProcessor owner = new DocumentProcessor(newRegistry(processor));
        ProcessorExecutionContext context = newContext(owner);

        ProcessorEngine.executeHandler(owner, new MatchAwareHandler(), context);

        assertTrue(processor.executed);
    }

    private static ContractProcessorRegistry newRegistry(MatchAwareHandlerProcessor processor) {
        ContractProcessorRegistry registry = new ContractProcessorRegistry();
        registry.registerHandler(processor);
        return registry;
    }

    private static ProcessorExecutionContext newContext(DocumentProcessor owner) {
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, new Node());
        execution.loadBundles("/");
        return execution.createContext("/", execution.bundleForScope("/"), new Node(), false, false);
    }

    @TypeBlueId("MatchAwareHandler")
    static class MatchAwareHandler extends HandlerContract {
    }

    static final class MatchAwareHandlerProcessor implements HandlerProcessor<MatchAwareHandler> {
        private final boolean allow;
        private boolean executed;

        MatchAwareHandlerProcessor(boolean allow) {
            this.allow = allow;
        }

        @Override
        public Class<MatchAwareHandler> contractType() {
            return MatchAwareHandler.class;
        }

        @Override
        public boolean matches(MatchAwareHandler contract, ProcessorExecutionContext context) {
            return allow;
        }

        @Override
        public void execute(MatchAwareHandler contract, ProcessorExecutionContext context) {
            executed = true;
        }
    }
}
