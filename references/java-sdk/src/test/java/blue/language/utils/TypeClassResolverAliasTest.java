package blue.language.utils;

import blue.language.NodeProvider;
import blue.language.model.Node;
import blue.language.mapping.model.AliasMappedType;
import blue.language.processor.model.ChannelEventCheckpoint;
import blue.language.processor.model.DocumentUpdateChannel;
import blue.language.processor.model.DocumentAnchorsMarker;
import blue.language.processor.model.DocumentLinksMarker;
import blue.language.processor.model.EmbeddedNodeChannel;
import blue.language.processor.model.InitializationMarker;
import blue.language.processor.model.LifecycleChannel;
import blue.language.processor.model.MyOSParticipantsOrchestrationMarker;
import blue.language.processor.model.MyOSSessionInteractionMarker;
import blue.language.processor.model.MyOSWorkerAgencyMarker;
import blue.language.processor.model.ProcessEmbedded;
import blue.language.processor.model.ProcessingTerminatedMarker;
import blue.language.processor.model.TriggeredEventChannel;
import org.junit.jupiter.api.Test;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

class TypeClassResolverAliasTest {

    @Test
    void resolvesClassesForAllDeclaredTypeBlueIdAliases() {
        TypeClassResolver resolver = new TypeClassResolver("blue.language.mapping.model");

        Node primary = new Node().type(new Node().blueId("AliasMappedType/Primary"));
        Node secondary = new Node().type(new Node().blueId("AliasMappedType/Secondary"));

        assertSame(AliasMappedType.class, resolver.resolveClass(primary));
        assertSame(AliasMappedType.class, resolver.resolveClass(secondary));
        assertEquals(AliasMappedType.class, resolver.getBlueIdMap().get("AliasMappedType/Primary"));
        assertEquals(AliasMappedType.class, resolver.getBlueIdMap().get("AliasMappedType/Secondary"));
    }

    @Test
    void resolvesClassFromInlineTypeChainWhenBlueIdIsDerived() {
        TypeClassResolver resolver = new TypeClassResolver("blue.language.mapping.model");

        Node derived = new Node().type(
                new Node()
                        .blueId("AliasMappedType/Derived")
                        .type(new Node().blueId("AliasMappedType/Primary")));

        assertSame(AliasMappedType.class, resolver.resolveClass(derived));
    }

    @Test
    void resolvesClassFromProviderTypeChainWhenBlueIdIsDerivedWithoutInlineChain() {
        NodeProvider provider = new NodeProvider() {
            @Override
            public java.util.List<Node> fetchByBlueId(String blueId) {
                if (!"AliasMappedType/ProviderDerived".equals(blueId)) {
                    return Collections.emptyList();
                }
                Node typeDefinition = new Node();
                typeDefinition.type(new Node().blueId("AliasMappedType/Primary"));
                return Collections.singletonList(typeDefinition);
            }
        };
        TypeClassResolver resolver = new TypeClassResolver(provider, "blue.language.mapping.model");

        Node derived = new Node().type(new Node().blueId("AliasMappedType/ProviderDerived"));

        assertSame(AliasMappedType.class, resolver.resolveClass(derived));
    }

    @Test
    void resolvesClassFromProviderPropertyBlueIdChainWhenDerivedTypeLacksInlineParent() {
        NodeProvider provider = new NodeProvider() {
            @Override
            public java.util.List<Node> fetchByBlueId(String blueId) {
                if (!"AliasMappedType/ProviderPropertyDerived".equals(blueId)) {
                    return Collections.emptyList();
                }
                Node typeDefinition = new Node().properties("blueId", new Node().value("AliasMappedType/Primary"));
                return Collections.singletonList(typeDefinition);
            }
        };
        TypeClassResolver resolver = new TypeClassResolver(provider, "blue.language.mapping.model");

        Node derived = new Node().type(new Node().blueId("AliasMappedType/ProviderPropertyDerived"));

        assertSame(AliasMappedType.class, resolver.resolveClass(derived));
    }

    @Test
    void resolvesClassFromProviderScalarValueChainWhenDerivedTypeLacksInlineParent() {
        NodeProvider provider = new NodeProvider() {
            @Override
            public java.util.List<Node> fetchByBlueId(String blueId) {
                if (!"AliasMappedType/ProviderValueDerived".equals(blueId)) {
                    return Collections.emptyList();
                }
                Node typeDefinition = new Node().value("AliasMappedType/Primary");
                return Collections.singletonList(typeDefinition);
            }
        };
        TypeClassResolver resolver = new TypeClassResolver(provider, "blue.language.mapping.model");

        Node derived = new Node().type(new Node().blueId("AliasMappedType/ProviderValueDerived"));

        assertSame(AliasMappedType.class, resolver.resolveClass(derived));
    }

    @Test
    void resolvesCoreBlueIdAliasesForBuiltInProcessorContracts() {
        TypeClassResolver resolver = new TypeClassResolver("blue.language.processor.model");

        assertSame(DocumentUpdateChannel.class,
                resolver.resolveClass(new Node().type(new Node().blueId("Document Update Channel"))));
        assertSame(EmbeddedNodeChannel.class,
                resolver.resolveClass(new Node().type(new Node().blueId("Embedded Node Channel"))));
        assertSame(LifecycleChannel.class,
                resolver.resolveClass(new Node().type(new Node().blueId("Lifecycle Event Channel"))));
        assertSame(TriggeredEventChannel.class,
                resolver.resolveClass(new Node().type(new Node().blueId("Triggered Event Channel"))));
        assertSame(ProcessEmbedded.class,
                resolver.resolveClass(new Node().type(new Node().blueId("Process Embedded"))));
        assertSame(InitializationMarker.class,
                resolver.resolveClass(new Node().type(new Node().blueId("Processing Initialized Marker"))));
        assertSame(ProcessingTerminatedMarker.class,
                resolver.resolveClass(new Node().type(new Node().blueId("Processing Terminated Marker"))));
        assertSame(ChannelEventCheckpoint.class,
                resolver.resolveClass(new Node().type(new Node().blueId("Channel Event Checkpoint"))));
        assertSame(DocumentAnchorsMarker.class,
                resolver.resolveClass(new Node().type(new Node().blueId("MyOS/Document Anchors"))));
        assertSame(DocumentLinksMarker.class,
                resolver.resolveClass(new Node().type(new Node().blueId("MyOS/Document Links"))));
        assertSame(MyOSParticipantsOrchestrationMarker.class,
                resolver.resolveClass(new Node().type(new Node().blueId("MyOS/MyOS Participants Orchestration"))));
        assertSame(MyOSSessionInteractionMarker.class,
                resolver.resolveClass(new Node().type(new Node().blueId("MyOS/MyOS Session Interaction"))));
        assertSame(MyOSWorkerAgencyMarker.class,
                resolver.resolveClass(new Node().type(new Node().blueId("MyOS/MyOS Worker Agency"))));
    }
}
