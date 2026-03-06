package blue.language.processor;

import blue.language.NodeProvider;
import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.processor.model.ChannelContract;
import blue.language.processor.model.Contract;
import blue.language.processor.model.HandlerContract;
import blue.language.processor.model.MarkerContract;
import blue.language.processor.model.MyOSTimelineChannel;
import blue.language.processor.registry.processors.TimelineChannelProcessor;
import blue.language.utils.TypeClassResolver;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ContractProcessorRegistryTest {

    @Test
    void lookupByClassFallsBackToAssignableRegisteredProcessor() {
        ContractProcessorRegistry registry = new ContractProcessorRegistry();
        BaseHandlerProcessor processor = new BaseHandlerProcessor();
        registry.registerHandler(processor);

        assertSame(processor, registry.lookupHandler(BaseHandler.class).orElse(null));
        assertSame(processor, registry.lookupHandler(DerivedHandler.class).orElse(null));
    }

    @Test
    void lookupByBlueIdAndContractInstanceUsesDeclaredTypeBlueId() {
        ContractProcessorRegistry registry = new ContractProcessorRegistry();
        BaseHandlerProcessor processor = new BaseHandlerProcessor();
        registry.registerHandler(processor);

        assertSame(processor, registry.lookupHandler("BaseHandler").orElse(null));
        assertSame(processor, registry.lookupHandler("Core/Base Handler").orElse(null));
        assertSame(processor, registry.lookupHandler(new DerivedHandler()).orElse(null));
    }

    @Test
    void channelAndMarkerLookupsSupportBlueIdsAndAssignableTypes() {
        ContractProcessorRegistry registry = new ContractProcessorRegistry();
        BaseChannelProcessor channelProcessor = new BaseChannelProcessor();
        BaseMarkerProcessor markerProcessor = new BaseMarkerProcessor();
        registry.registerChannel(channelProcessor);
        registry.registerMarker(markerProcessor);

        assertSame(channelProcessor, registry.lookupChannel(DerivedChannel.class).orElse(null));
        assertSame(channelProcessor, registry.lookupChannel("BaseChannel").orElse(null));
        assertSame(markerProcessor, registry.lookupMarker(DerivedMarker.class).orElse(null));
        assertSame(markerProcessor, registry.lookupMarker("BaseMarker").orElse(null));
        assertTrue(registry.processors().containsKey("BaseChannel"));
    }

    @Test
    void lookupByNodeTypeChainSupportsDerivedBlueIds() {
        ContractProcessorRegistry registry = new ContractProcessorRegistry();
        BaseHandlerProcessor handlerProcessor = new BaseHandlerProcessor();
        BaseChannelProcessor channelProcessor = new BaseChannelProcessor();
        BaseMarkerProcessor markerProcessor = new BaseMarkerProcessor();
        registry.registerHandler(handlerProcessor);
        registry.registerChannel(channelProcessor);
        registry.registerMarker(markerProcessor);

        Node derivedHandlerNode = new Node().type(
                new Node().blueId("Derived/Handler").type(new Node().blueId("BaseHandler")));
        Node derivedChannelNode = new Node().type(
                new Node().blueId("Derived/Channel").type(new Node().blueId("BaseChannel")));
        Node derivedMarkerNode = new Node().type(
                new Node().blueId("Derived/Marker").type(new Node().blueId("BaseMarker")));

        assertSame(handlerProcessor, registry.lookupHandler(derivedHandlerNode).orElse(null));
        assertSame(channelProcessor, registry.lookupChannel(derivedChannelNode).orElse(null));
        assertSame(markerProcessor, registry.lookupMarker(derivedMarkerNode).orElse(null));
    }

    @Test
    void lookupByNodeTypeChainSupportsProviderDerivedBlueIds() {
        NodeProvider provider = new NodeProvider() {
            @Override
            public java.util.List<Node> fetchByBlueId(String blueId) {
                if (!"Derived/Handler".equals(blueId)) {
                    return Collections.emptyList();
                }
                Node definition = new Node().type(new Node().blueId("BaseHandler"));
                return Collections.singletonList(definition);
            }
        };
        ContractProcessorRegistry registry = new ContractProcessorRegistry(provider);
        BaseHandlerProcessor handlerProcessor = new BaseHandlerProcessor();
        registry.registerHandler(handlerProcessor);

        Node derivedHandlerNode = new Node().type(new Node().blueId("Derived/Handler"));

        assertSame(handlerProcessor, registry.lookupHandler(derivedHandlerNode).orElse(null));
    }

    @Test
    void lookupByNodeBlueIdFieldSupportsDirectAndProviderDerivedLookups() {
        NodeProvider provider = new NodeProvider() {
            @Override
            public java.util.List<Node> fetchByBlueId(String blueId) {
                if (!"Derived/Handler".equals(blueId)) {
                    return Collections.emptyList();
                }
                Node definition = new Node().type(new Node().blueId("BaseHandler"));
                return Collections.singletonList(definition);
            }
        };
        ContractProcessorRegistry registry = new ContractProcessorRegistry(provider);
        BaseHandlerProcessor handlerProcessor = new BaseHandlerProcessor();
        registry.registerHandler(handlerProcessor);

        Node directBlueIdNode = new Node().properties("blueId", new Node().value("BaseHandler"));
        Node providerDerivedNode = new Node().properties("blueId", new Node().value("Derived/Handler"));
        Node directBlueIdScalarNode = new Node().value("BaseHandler");
        Node providerDerivedScalarNode = new Node().value("Derived/Handler");

        assertSame(handlerProcessor, registry.lookupHandler(directBlueIdNode).orElse(null));
        assertSame(handlerProcessor, registry.lookupHandler(providerDerivedNode).orElse(null));
        assertSame(handlerProcessor, registry.lookupHandler(directBlueIdScalarNode).orElse(null));
        assertSame(handlerProcessor, registry.lookupHandler(providerDerivedScalarNode).orElse(null));
    }

    @Test
    void lookupByBlueIdStringSupportsProviderDerivedLookups() {
        NodeProvider provider = new NodeProvider() {
            @Override
            public java.util.List<Node> fetchByBlueId(String blueId) {
                if ("Derived/Handler".equals(blueId)) {
                    Node definition = new Node().type(new Node().blueId("BaseHandler"));
                    return Collections.singletonList(definition);
                }
                if ("Derived/Channel".equals(blueId)) {
                    Node definition = new Node().type(new Node().blueId("BaseChannel"));
                    return Collections.singletonList(definition);
                }
                if ("Derived/Marker".equals(blueId)) {
                    Node definition = new Node().type(new Node().blueId("BaseMarker"));
                    return Collections.singletonList(definition);
                }
                return Collections.emptyList();
            }
        };
        ContractProcessorRegistry registry = new ContractProcessorRegistry(provider);
        BaseHandlerProcessor handlerProcessor = new BaseHandlerProcessor();
        BaseChannelProcessor channelProcessor = new BaseChannelProcessor();
        BaseMarkerProcessor markerProcessor = new BaseMarkerProcessor();
        registry.registerHandler(handlerProcessor);
        registry.registerChannel(channelProcessor);
        registry.registerMarker(markerProcessor);

        assertSame(handlerProcessor, registry.lookupHandler("Derived/Handler").orElse(null));
        assertSame(channelProcessor, registry.lookupChannel("Derived/Channel").orElse(null));
        assertSame(markerProcessor, registry.lookupMarker("Derived/Marker").orElse(null));
    }

    @Test
    void lookupByBlueIdStringSupportsProviderDefinitionsWithPropertyAndScalarBlueIds() {
        NodeProvider provider = new NodeProvider() {
            @Override
            public java.util.List<Node> fetchByBlueId(String blueId) {
                if ("Derived/Handler".equals(blueId)) {
                    Node definition = new Node().properties("blueId", new Node().value("BaseHandler"));
                    return Collections.singletonList(definition);
                }
                if ("Derived/Channel".equals(blueId)) {
                    Node definition = new Node().value("BaseChannel");
                    return Collections.singletonList(definition);
                }
                if ("Derived/Marker".equals(blueId)) {
                    Node definition = new Node().properties("blueId", new Node().value("BaseMarker"));
                    return Collections.singletonList(definition);
                }
                return Collections.emptyList();
            }
        };
        ContractProcessorRegistry registry = new ContractProcessorRegistry(provider);
        BaseHandlerProcessor handlerProcessor = new BaseHandlerProcessor();
        BaseChannelProcessor channelProcessor = new BaseChannelProcessor();
        BaseMarkerProcessor markerProcessor = new BaseMarkerProcessor();
        registry.registerHandler(handlerProcessor);
        registry.registerChannel(channelProcessor);
        registry.registerMarker(markerProcessor);

        assertSame(handlerProcessor, registry.lookupHandler("Derived/Handler").orElse(null));
        assertSame(channelProcessor, registry.lookupChannel("Derived/Channel").orElse(null));
        assertSame(markerProcessor, registry.lookupMarker("Derived/Marker").orElse(null));
    }

    @Test
    void lookupMarkerByNodeSupportsProviderDerivedMarkerTypes() {
        NodeProvider provider = new NodeProvider() {
            @Override
            public java.util.List<Node> fetchByBlueId(String blueId) {
                if (!"Derived/Marker".equals(blueId)) {
                    return Collections.emptyList();
                }
                Node definition = new Node().type(new Node().blueId("BaseMarker"));
                return Collections.singletonList(definition);
            }
        };
        ContractProcessorRegistry registry = new ContractProcessorRegistry(provider);
        BaseMarkerProcessor markerProcessor = new BaseMarkerProcessor();
        registry.registerMarker(markerProcessor);

        Node derivedMarkerNode = new Node().type(new Node().blueId("Derived/Marker"));

        assertSame(markerProcessor, registry.lookupMarker(derivedMarkerNode).orElse(null));
    }

    @Test
    void lookupByNodeTypeChainSupportsProviderDefinitionsWithPropertyAndScalarBlueIds() {
        NodeProvider provider = new NodeProvider() {
            @Override
            public java.util.List<Node> fetchByBlueId(String blueId) {
                if ("Derived/Handler".equals(blueId)) {
                    Node definition = new Node().properties("blueId", new Node().value("BaseHandler"));
                    return Collections.singletonList(definition);
                }
                if ("Derived/Channel".equals(blueId)) {
                    Node definition = new Node().value("BaseChannel");
                    return Collections.singletonList(definition);
                }
                if ("Derived/Marker".equals(blueId)) {
                    Node definition = new Node().properties("blueId", new Node().value("BaseMarker"));
                    return Collections.singletonList(definition);
                }
                return Collections.emptyList();
            }
        };
        ContractProcessorRegistry registry = new ContractProcessorRegistry(provider);
        BaseHandlerProcessor handlerProcessor = new BaseHandlerProcessor();
        BaseChannelProcessor channelProcessor = new BaseChannelProcessor();
        BaseMarkerProcessor markerProcessor = new BaseMarkerProcessor();
        registry.registerHandler(handlerProcessor);
        registry.registerChannel(channelProcessor);
        registry.registerMarker(markerProcessor);

        Node derivedHandlerNode = new Node().type(new Node().blueId("Derived/Handler"));
        Node derivedChannelNode = new Node().type(new Node().blueId("Derived/Channel"));
        Node derivedMarkerNode = new Node().type(new Node().blueId("Derived/Marker"));

        assertSame(handlerProcessor, registry.lookupHandler(derivedHandlerNode).orElse(null));
        assertSame(channelProcessor, registry.lookupChannel(derivedChannelNode).orElse(null));
        assertSame(markerProcessor, registry.lookupMarker(derivedMarkerNode).orElse(null));
    }

    @Test
    void lookupChannelByNodeSupportsProviderDerivedTimelineTypes() {
        NodeProvider provider = new NodeProvider() {
            @Override
            public java.util.List<Node> fetchByBlueId(String blueId) {
                if (!"MyOS/MyOS Timeline Channel".equals(blueId)) {
                    return Collections.emptyList();
                }
                Node definition = new Node().type(new Node().blueId("Conversation/Timeline Channel"));
                return Collections.singletonList(definition);
            }
        };
        ContractProcessorRegistry registry = new ContractProcessorRegistry(provider);
        TimelineChannelProcessor timelineProcessor = new TimelineChannelProcessor();
        registry.registerChannel(timelineProcessor);

        Node derivedTimelineNode = new Node().type(new Node().blueId("MyOS/MyOS Timeline Channel"));

        assertSame(timelineProcessor, registry.lookupChannel(derivedTimelineNode).orElse(null));
    }

    @Test
    void lookupByNodeFallsBackToResolvedClassHierarchyWhenTypeChainMissing() {
        ContractProcessorRegistry registry = new ContractProcessorRegistry()
                .typeClassResolver(new TypeClassResolver("blue.language.processor"));
        BaseHandlerProcessor handlerProcessor = new BaseHandlerProcessor();
        BaseChannelProcessor channelProcessor = new BaseChannelProcessor();
        BaseMarkerProcessor markerProcessor = new BaseMarkerProcessor();
        registry.registerHandler(handlerProcessor);
        registry.registerChannel(channelProcessor);
        registry.registerMarker(markerProcessor);

        Node derivedHandlerNode = new Node().type(new Node().blueId("DerivedHandler"));
        Node derivedChannelNode = new Node().type(new Node().blueId("DerivedChannel"));
        Node derivedMarkerNode = new Node().type(new Node().blueId("DerivedMarker"));

        assertSame(handlerProcessor, registry.lookupHandler(derivedHandlerNode).orElse(null));
        assertSame(channelProcessor, registry.lookupChannel(derivedChannelNode).orElse(null));
        assertSame(markerProcessor, registry.lookupMarker(derivedMarkerNode).orElse(null));
    }

    @Test
    void lookupChannelByNodeUsesResolvedModelClassForTimelineSubtype() {
        ContractProcessorRegistry registry = new ContractProcessorRegistry()
                .typeClassResolver(new TypeClassResolver("blue.language.processor.model"));
        TimelineChannelProcessor timelineProcessor = new TimelineChannelProcessor();
        registry.registerChannel(timelineProcessor);

        Node myosTimelineNode = new Node().type(new Node().blueId("MyOS/MyOS Timeline Channel"));

        assertSame(timelineProcessor, registry.lookupChannel(myosTimelineNode).orElse(null));
    }

    @Test
    void lookupChannelFallsBackToTimelineProcessorForMyOSTypeHierarchy() {
        ContractProcessorRegistry registry = new ContractProcessorRegistry();
        TimelineChannelProcessor timelineProcessor = new TimelineChannelProcessor();
        registry.registerChannel(timelineProcessor);

        MyOSTimelineChannel myosChannel = new MyOSTimelineChannel();
        assertSame(timelineProcessor, registry.lookupChannel(MyOSTimelineChannel.class).orElse(null));
        assertSame(timelineProcessor, registry.lookupChannel(myosChannel).orElse(null));
    }

    @Test
    void registerRejectsHandlersWhoseContractTypeLacksTypeBlueId() {
        ContractProcessorRegistry registry = new ContractProcessorRegistry();
        assertThrows(IllegalArgumentException.class, () -> registry.registerHandler(new UnannotatedHandlerProcessor()));
    }

    @Test
    void registerRejectsBlankBlueIdValues() {
        ContractProcessorRegistry registry = new ContractProcessorRegistry();
        assertThrows(IllegalArgumentException.class, () -> registry.registerHandler(new BlankBlueIdHandlerProcessor()));
    }

    @Test
    void registerRejectsUnsupportedProcessorKinds() {
        ContractProcessorRegistry registry = new ContractProcessorRegistry();
        assertThrows(IllegalArgumentException.class, () -> registry.register(new PlainContractProcessor()));
    }

    @Test
    void registerDispatchesHandlerChannelAndMarkerProcessors() {
        ContractProcessorRegistry registry = new ContractProcessorRegistry();
        BaseHandlerProcessor handlerProcessor = new BaseHandlerProcessor();
        BaseChannelProcessor channelProcessor = new BaseChannelProcessor();
        BaseMarkerProcessor markerProcessor = new BaseMarkerProcessor();

        registry.register(handlerProcessor);
        registry.register(channelProcessor);
        registry.register(markerProcessor);

        assertSame(handlerProcessor, registry.lookupHandler("BaseHandler").orElse(null));
        assertSame(channelProcessor, registry.lookupChannel("BaseChannel").orElse(null));
        assertSame(markerProcessor, registry.lookupMarker("BaseMarker").orElse(null));
    }

    @Test
    void processorsReturnsMutableSnapshotWithoutAffectingRegistry() {
        ContractProcessorRegistry registry = new ContractProcessorRegistry();
        BaseHandlerProcessor handlerProcessor = new BaseHandlerProcessor();
        BaseMarkerProcessor markerProcessor = new BaseMarkerProcessor();
        registry.register(handlerProcessor);

        Map<String, ContractProcessor<? extends Contract>> snapshot = registry.processors();
        snapshot.put("BaseHandler", markerProcessor);

        assertSame(handlerProcessor, registry.lookupHandler("BaseHandler").orElse(null));
    }

    @TypeBlueId({"BaseHandler", "Core/Base Handler"})
    static class BaseHandler extends HandlerContract {
    }

    @TypeBlueId("DerivedHandler")
    static class DerivedHandler extends BaseHandler {
    }

    static final class BaseHandlerProcessor implements HandlerProcessor<BaseHandler> {
        @Override
        public Class<BaseHandler> contractType() {
            return BaseHandler.class;
        }

        @Override
        public void execute(BaseHandler contract, ProcessorExecutionContext context) {
            // no-op
        }
    }

    @TypeBlueId("BaseChannel")
    static class BaseChannel extends ChannelContract {
    }

    @TypeBlueId("DerivedChannel")
    static class DerivedChannel extends BaseChannel {
    }

    static final class BaseChannelProcessor implements ChannelProcessor<BaseChannel> {
        @Override
        public Class<BaseChannel> contractType() {
            return BaseChannel.class;
        }

        @Override
        public boolean matches(BaseChannel contract, ChannelEvaluationContext context) {
            return true;
        }
    }

    @TypeBlueId("BaseMarker")
    static class BaseMarker extends MarkerContract {
    }

    @TypeBlueId("DerivedMarker")
    static class DerivedMarker extends BaseMarker {
    }

    static final class BaseMarkerProcessor implements ContractProcessor<BaseMarker> {
        @Override
        public Class<BaseMarker> contractType() {
            return BaseMarker.class;
        }
    }

    static class UnannotatedHandler extends HandlerContract {
    }

    @TypeBlueId("   ")
    static class BlankBlueIdHandler extends HandlerContract {
    }

    static final class UnannotatedHandlerProcessor implements HandlerProcessor<UnannotatedHandler> {
        @Override
        public Class<UnannotatedHandler> contractType() {
            return UnannotatedHandler.class;
        }

        @Override
        public void execute(UnannotatedHandler contract, ProcessorExecutionContext context) {
            // no-op
        }
    }

    static final class BlankBlueIdHandlerProcessor implements HandlerProcessor<BlankBlueIdHandler> {
        @Override
        public Class<BlankBlueIdHandler> contractType() {
            return BlankBlueIdHandler.class;
        }

        @Override
        public void execute(BlankBlueIdHandler contract, ProcessorExecutionContext context) {
            // no-op
        }
    }

    @TypeBlueId("PlainContract")
    static class PlainContract extends Contract {
    }

    static final class PlainContractProcessor implements ContractProcessor<PlainContract> {
        @Override
        public Class<PlainContract> contractType() {
            return PlainContract.class;
        }
    }
}
