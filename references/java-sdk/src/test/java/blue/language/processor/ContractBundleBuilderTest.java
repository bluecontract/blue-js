package blue.language.processor;

import blue.language.processor.model.DocumentUpdateChannel;
import blue.language.processor.model.LifecycleChannel;
import blue.language.processor.model.ProcessEmbedded;
import blue.language.processor.model.SetProperty;
import org.junit.jupiter.api.Test;

import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ContractBundleBuilderTest {

    @Test
    void setEmbeddedNormalizesAndDeduplicatesPaths() {
        ProcessEmbedded embedded = new ProcessEmbedded()
                .addPath("/child")
                .addPath("/a~1b");

        ContractBundle bundle = ContractBundle.builder()
                .setEmbedded(embedded)
                .build();

        assertEquals(Arrays.asList("/child", "/a~1b"), bundle.embeddedPaths());
    }

    @Test
    void setEmbeddedRejectsMalformedPointerEscapes() {
        assertThrows(IllegalArgumentException.class,
                () -> {
                    ProcessEmbedded embedded = new ProcessEmbedded()
                            .addPath("/bad~")
                            .addPath("/ok");
                    ContractBundle.builder().setEmbedded(embedded).build();
                });

        assertThrows(IllegalArgumentException.class,
                () -> {
                    ProcessEmbedded invalidToken = new ProcessEmbedded().addPath("/bad~2");
                    ContractBundle.builder().setEmbedded(invalidToken).build();
                });
    }

    @Test
    void setEmbeddedRejectsNonPointerPaths() {
        assertThrows(IllegalArgumentException.class,
                () -> {
                    ProcessEmbedded embedded = new ProcessEmbedded()
                            .addPath("child");
                    ContractBundle.builder().setEmbedded(embedded).build();
                });
    }

    @Test
    void setEmbeddedTrimsWhitespaceAndSkipsBlankEntries() {
        ProcessEmbedded embedded = new ProcessEmbedded()
                .addPath("  /child  ")
                .addPath("   ")
                .addPath("\t/next\t");

        ContractBundle bundle = ContractBundle.builder()
                .setEmbedded(embedded)
                .build();

        assertEquals(Arrays.asList("/child", "/next"), bundle.embeddedPaths());
    }

    @Test
    void builderRejectsBlankContractKeys() {
        assertThrows(IllegalStateException.class,
                () -> ContractBundle.builder().addChannel("   ", new DocumentUpdateChannel()));
        assertThrows(IllegalStateException.class,
                () -> ContractBundle.builder().addHandler("   ", new SetProperty()));
        assertThrows(IllegalStateException.class,
                () -> ContractBundle.builder().addMarker("   ", new ProcessEmbedded()));
    }

    @Test
    void builderTrimsHandlerChannelReferences() {
        SetProperty handler = new SetProperty();
        handler.setChannelKey(" life ");

        ContractBundle bundle = ContractBundle.builder()
                .addChannel(" life ", new LifecycleChannel())
                .addHandler("setX", handler)
                .build();

        assertEquals(1, bundle.handlersFor("life").size());
    }

    @Test
    void builderRejectsHandlersForMissingChannels() {
        SetProperty handler = new SetProperty();
        handler.setChannelKey("missing");

        assertThrows(IllegalStateException.class,
                () -> ContractBundle.builder().addHandler("setX", handler).build());
    }

    @Test
    void builderRejectsDuplicateNormalizedContractKeys() {
        assertThrows(IllegalStateException.class,
                () -> ContractBundle.builder()
                        .addChannel("life", new LifecycleChannel())
                        .addChannel(" life ", new LifecycleChannel()));

        assertThrows(IllegalStateException.class,
                () -> ContractBundle.builder()
                        .addMarker("checkpointA", new ProcessEmbedded())
                        .addMarker(" checkpointA ", new ProcessEmbedded()));

        SetProperty handlerA = new SetProperty();
        handlerA.setChannelKey("life");
        SetProperty handlerB = new SetProperty();
        handlerB.setChannelKey("life");
        assertThrows(IllegalStateException.class,
                () -> ContractBundle.builder()
                        .addChannel("life", new LifecycleChannel())
                        .addHandler("setX", handlerA)
                        .addHandler(" setX ", handlerB)
                        .build());

        SetProperty handler = new SetProperty();
        handler.setChannelKey("life");
        assertThrows(IllegalStateException.class,
                () -> ContractBundle.builder()
                        .addChannel("life", new LifecycleChannel())
                        .addHandler(" life ", handler)
                        .build());

        assertThrows(IllegalStateException.class,
                () -> ContractBundle.builder()
                        .addChannel("life", new LifecycleChannel())
                        .addMarker(" life ", new ProcessEmbedded()));
    }

    @Test
    void builderNormalizesWhitespaceInContractAndChannelKeys() {
        SetProperty handler = new SetProperty();
        handler.setChannelKey(" life ");

        ContractBundle bundle = ContractBundle.builder()
                .addChannel(" life ", new LifecycleChannel())
                .addHandler(" setX ", handler)
                .build();

        assertEquals("life", bundle.channelsOfType(LifecycleChannel.class).get(0).key());
        assertEquals("setX", bundle.handlersFor("life").get(0).key());
    }
}
