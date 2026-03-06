package blue.language.processor;

import blue.language.Blue;
import blue.language.NodeProvider;
import blue.language.model.Node;
import blue.language.processor.contracts.CustomHandlerContractProcessor;
import blue.language.processor.contracts.SetPropertyContractProcessor;
import blue.language.processor.contracts.TestEventChannelProcessor;
import blue.language.processor.model.CustomHandlerContract;
import blue.language.processor.model.DocumentUpdateChannel;
import blue.language.processor.model.InitializationMarker;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ContractLoaderParityTest {

    @Test
    void loadsBuiltInContractsWithoutRegistryProcessors() {
        Blue blue = new Blue();
        ContractLoader loader = blue.getDocumentProcessor().contractLoader();
        Node scope = blue.yamlToNode("contracts:\n" +
                "  update:\n" +
                "    type:\n" +
                "      blueId: Document Update Channel\n" +
                "    path: /document\n" +
                "  embedded:\n" +
                "    type:\n" +
                "      blueId: Process Embedded\n" +
                "    paths:\n" +
                "      - /children\n" +
                "  init:\n" +
                "    type:\n" +
                "      blueId: Processing Initialized Marker\n" +
                "    documentId: doc-123\n" +
                "  checkpoint:\n" +
                "    type:\n" +
                "      blueId: Channel Event Checkpoint\n" +
                "    lastEvents: {}\n" +
                "    lastSignatures: {}\n");

        ContractBundle bundle = loader.load(scope, "/");

        assertEquals(1, bundle.channelsOfType("Document Update Channel").size());
        assertEquals("update", bundle.channelsOfType("Document Update Channel").get(0).key());
        ContractBundle.ChannelBinding channelBinding = bundle.channel("update");
        assertNotNull(channelBinding);
        assertTrue(channelBinding.contract() instanceof DocumentUpdateChannel);
        assertEquals("/document", ((DocumentUpdateChannel) channelBinding.contract()).getPath());
        assertEquals(1, bundle.embeddedPaths().size());
        assertEquals("/children", bundle.embeddedPaths().get(0));

        assertTrue(bundle.marker("init") instanceof InitializationMarker);
        assertEquals("doc-123", ((InitializationMarker) bundle.marker("init")).getDocumentId());
        assertTrue(bundle.hasCheckpoint());
    }

    @Test
    void throwsMustUnderstandForUnsupportedContracts() {
        Blue blue = new Blue();
        ContractLoader loader = blue.getDocumentProcessor().contractLoader();
        Node scope = blue.yamlToNode("contracts:\n" +
                "  unsupported:\n" +
                "    type:\n" +
                "      blueId: Custom.Channel\n");

        MustUnderstandFailureException error = assertThrows(
                MustUnderstandFailureException.class,
                () -> loader.load(scope, "/"));
        assertTrue(String.valueOf(error.getMessage()).contains("Custom.Channel"));
    }

    @Test
    void rejectsCheckpointMarkerWithIncorrectKey() {
        Blue blue = new Blue();
        ContractLoader loader = blue.getDocumentProcessor().contractLoader();
        Node scope = blue.yamlToNode("contracts:\n" +
                "  wrongCheckpoint:\n" +
                "    type:\n" +
                "      blueId: Channel Event Checkpoint\n" +
                "    lastEvents: {}\n" +
                "    lastSignatures: {}\n");

        assertThrows(IllegalStateException.class, () -> loader.load(scope, "/"));
    }

    @Test
    void loadsRegisteredCustomHandlerContracts() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());
        blue.registerContractProcessor(new SetPropertyContractProcessor());
        ContractLoader loader = blue.getDocumentProcessor().contractLoader();
        Node scope = blue.yamlToNode("contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  handler:\n" +
                "    type:\n" +
                "      blueId: SetProperty\n" +
                "    channel: testChannel\n" +
                "    propertyKey: /x\n" +
                "    propertyValue: 1\n");

        ContractBundle bundle = loader.load(scope, "/");

        assertEquals(1, bundle.handlersFor("testChannel").size());
        assertEquals("handler", bundle.handlersFor("testChannel").get(0).key());
    }

    @Test
    void loadsProviderDerivedHandlerContractsUsingTypeChainLookup() {
        NodeProvider provider = new NodeProvider() {
            @Override
            public java.util.List<Node> fetchByBlueId(String blueId) {
                if (!"Derived/SetProperty".equals(blueId)) {
                    return java.util.Collections.emptyList();
                }
                Node definition = new Node().type(new Node().blueId("SetProperty"));
                return java.util.Collections.singletonList(definition);
            }
        };
        Blue blue = new Blue(provider);
        blue.registerContractProcessor(new TestEventChannelProcessor());
        blue.registerContractProcessor(new SetPropertyContractProcessor());
        ContractLoader loader = blue.getDocumentProcessor().contractLoader();
        Node scope = blue.yamlToNode("contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  handler:\n" +
                "    type:\n" +
                "      blueId: Derived/SetProperty\n" +
                "    channel: testChannel\n" +
                "    propertyKey: /x\n" +
                "    propertyValue: 1\n");

        ContractBundle bundle = loader.load(scope, "/");

        assertEquals(1, bundle.handlersFor("testChannel").size());
        assertEquals("handler", bundle.handlersFor("testChannel").get(0).key());
    }

    @Test
    void failsWhenSequentialWorkflowOmitsChannelAndCannotDerive() {
        Blue blue = new Blue();
        ContractLoader loader = blue.getDocumentProcessor().contractLoader();
        Node scope = blue.yamlToNode("contracts:\n" +
                "  handler:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps: []\n");

        assertThrows(IllegalStateException.class, () -> loader.load(scope, "/"));
    }

    @Test
    void failsWhenRegisteredCustomHandlerOmitsChannel() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new SetPropertyContractProcessor());
        ContractLoader loader = blue.getDocumentProcessor().contractLoader();
        Node scope = blue.yamlToNode("contracts:\n" +
                "  handler:\n" +
                "    type:\n" +
                "      blueId: SetProperty\n" +
                "    propertyKey: /x\n" +
                "    propertyValue: 1\n");

        assertThrows(IllegalStateException.class, () -> loader.load(scope, "/"));
    }

    @Test
    void loadsCustomHandlerContractsUsingRegisteredProcessorType() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new CustomHandlerContractProcessor());
        ContractLoader loader = blue.getDocumentProcessor().contractLoader();
        Node scope = blue.yamlToNode("contracts:\n" +
                "  main:\n" +
                "    type:\n" +
                "      blueId: Document Update Channel\n" +
                "    path: /document\n" +
                "  handler:\n" +
                "    type:\n" +
                "      blueId: Custom.Handler\n" +
                "    channel: main\n" +
                "    config: alpha\n");

        ContractBundle bundle = loader.load(scope, "/");

        assertEquals(1, bundle.handlersFor("main").size());
        assertEquals("handler", bundle.handlersFor("main").get(0).key());
        assertTrue(bundle.handlersFor("main").get(0).contract() instanceof CustomHandlerContract);
        CustomHandlerContract contract = (CustomHandlerContract) bundle.handlersFor("main").get(0).contract();
        assertEquals("alpha", contract.getConfig());
    }

    @Test
    void failsWhenCustomHandlerOmitsChannel() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new CustomHandlerContractProcessor());
        ContractLoader loader = blue.getDocumentProcessor().contractLoader();
        Node scope = blue.yamlToNode("contracts:\n" +
                "  handler:\n" +
                "    type:\n" +
                "      blueId: Custom.Handler\n" +
                "    config: alpha\n");

        assertThrows(IllegalStateException.class, () -> loader.load(scope, "/"));
    }
}
