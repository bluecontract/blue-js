package blue.language.processor;

import blue.language.processor.model.ChannelEventCheckpoint;
import blue.language.processor.model.DocumentUpdateChannel;
import blue.language.processor.model.LifecycleChannel;
import blue.language.processor.model.ProcessEmbedded;
import blue.language.processor.model.SetProperty;
import blue.language.processor.util.ProcessorContractConstants;
import org.junit.jupiter.api.Test;

import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ContractBundleParityTest {

    @Test
    void sortsChannelsByOrderThenKey() {
        DocumentUpdateChannel channelB = new DocumentUpdateChannel();
        channelB.setOrder(2);
        channelB.setPath("/b");
        DocumentUpdateChannel channelA = new DocumentUpdateChannel();
        channelA.setOrder(1);
        channelA.setPath("/a");
        DocumentUpdateChannel channelC = new DocumentUpdateChannel();
        channelC.setOrder(1);
        channelC.setPath("/c");

        ContractBundle bundle = ContractBundle.builder()
                .addChannel("b", channelB)
                .addChannel("a", channelA)
                .addChannel("c", channelC)
                .build();

        assertEquals(Arrays.asList("a", "c", "b"),
                Arrays.asList(
                        bundle.channelsOfType(DocumentUpdateChannel.class).get(0).key(),
                        bundle.channelsOfType(DocumentUpdateChannel.class).get(1).key(),
                        bundle.channelsOfType(DocumentUpdateChannel.class).get(2).key()));
    }

    @Test
    void filtersChannelsByBlueIdWhenRequested() {
        DocumentUpdateChannel alpha = new DocumentUpdateChannel();
        LifecycleChannel beta = new LifecycleChannel();

        ContractBundle bundle = ContractBundle.builder()
                .addChannel("alpha", alpha)
                .addChannel("beta", beta)
                .build();

        assertEquals(1, bundle.channelsOfType("Lifecycle Event Channel").size());
        assertEquals("beta", bundle.channelsOfType("Lifecycle Event Channel").get(0).key());
    }

    @Test
    void groupsHandlersByChannelAndSortsConsistently() {
        SetProperty handler2 = new SetProperty();
        handler2.setChannelKey("channel-1");
        handler2.setOrder(2);
        SetProperty handler1 = new SetProperty();
        handler1.setChannelKey("channel-1");
        handler1.setOrder(1);
        SetProperty handler3 = new SetProperty();
        handler3.setChannelKey("channel-2");
        handler3.setOrder(1);

        ContractBundle bundle = ContractBundle.builder()
                .addChannel("channel-1", new LifecycleChannel())
                .addChannel("channel-2", new LifecycleChannel())
                .addHandler("h2", handler2)
                .addHandler("h1", handler1)
                .addHandler("h3", handler3)
                .build();

        assertEquals(Arrays.asList("h1", "h2"),
                Arrays.asList(bundle.handlersFor("channel-1").get(0).key(), bundle.handlersFor("channel-1").get(1).key()));
        assertEquals("h3", bundle.handlersFor("channel-2").get(0).key());
    }

    @Test
    void tracksEmbeddedPathsAndPreventsDuplicates() {
        ContractBundle.Builder builder = ContractBundle.builder();
        ProcessEmbedded embedded = new ProcessEmbedded();
        embedded.setPaths(Arrays.asList("/child"));
        builder.setEmbedded(embedded);

        ContractBundle bundle = builder.build();
        assertEquals(Arrays.asList("/child"), bundle.embeddedPaths());

        ProcessEmbedded duplicate = new ProcessEmbedded();
        duplicate.setPaths(Arrays.asList("/other"));
        IllegalStateException error = assertThrows(IllegalStateException.class, () -> builder.setEmbedded(duplicate));
        assertTrue(error.getMessage().contains("Multiple Process Embedded markers"));
    }

    @Test
    void validatesCheckpointMarkersForReservedKey() {
        ContractBundle.Builder builder = ContractBundle.builder();

        IllegalStateException wrongKey = assertThrows(IllegalStateException.class,
                () -> builder.addMarker("custom", new ChannelEventCheckpoint()));
        assertTrue(String.valueOf(wrongKey.getMessage()).contains("reserved key 'checkpoint'"));

        builder.addMarker(ProcessorContractConstants.KEY_CHECKPOINT, new ChannelEventCheckpoint());
        IllegalStateException duplicate = assertThrows(IllegalStateException.class,
                () -> builder.addMarker(ProcessorContractConstants.KEY_CHECKPOINT, new ChannelEventCheckpoint()));
        assertTrue(String.valueOf(duplicate.getMessage()).contains("Duplicate Channel Event Checkpoint"));

        ContractBundle bundle = builder.build();
        assertTrue(bundle.hasCheckpoint());
    }

    @Test
    void registersCheckpointMarkerPostBuild() {
        ContractBundle bundle = ContractBundle.builder().build();

        bundle.registerCheckpointMarker(new ChannelEventCheckpoint());

        assertTrue(bundle.hasCheckpoint());
        assertNotNull(bundle.marker(ProcessorContractConstants.KEY_CHECKPOINT));
        IllegalStateException duplicate = assertThrows(
                IllegalStateException.class,
                () -> bundle.registerCheckpointMarker(new ChannelEventCheckpoint()));
        assertTrue(String.valueOf(duplicate.getMessage()).contains("Duplicate Channel Event Checkpoint"));
    }
}
