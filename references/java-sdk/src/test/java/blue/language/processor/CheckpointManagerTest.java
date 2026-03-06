package blue.language.processor;

import blue.language.model.Node;
import blue.language.processor.model.ChannelEventCheckpoint;
import blue.language.processor.util.ProcessorContractConstants;
import blue.language.processor.util.ProcessorPointerConstants;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;

/**
 * Validates checkpoint marker lifecycle operations without exercising the full engine.
 */
final class CheckpointManagerTest {

    @Test
    void ensureCheckpointCreatesMarkerWhenAbsent() {
        DocumentProcessingRuntime runtime = new DocumentProcessingRuntime(new Node());
        CheckpointManager manager = new CheckpointManager(runtime, node -> null);
        ContractBundle bundle = ContractBundle.builder().build();

        manager.ensureCheckpointMarker("/", bundle);

        Node stored = ProcessorEngine.nodeAt(runtime.document(), ProcessorPointerConstants.RELATIVE_CHECKPOINT);
        assertNotNull(stored, "checkpoint marker should be written to document");
        assertTrue(bundle.marker(ProcessorContractConstants.KEY_CHECKPOINT) instanceof ChannelEventCheckpoint);
    }

    @Test
    void persistUpdatesCheckpointAndChargesGas() {
        DocumentProcessingRuntime runtime = new DocumentProcessingRuntime(new Node());
        CheckpointManager manager = new CheckpointManager(runtime, node -> node != null ? "sig" : null);
        ContractBundle bundle = ContractBundle.builder().build();
        manager.ensureCheckpointMarker("/", bundle);

        CheckpointManager.CheckpointRecord record = manager.findCheckpoint(bundle, "testChannel");
        Node eventNode = new Node().value("payload");

        manager.persist("/", bundle, record, "nextSig", eventNode);

        Node stored = ProcessorEngine.nodeAt(runtime.document(),
                ProcessorPointerConstants.relativeCheckpointLastEvent(record.markerKey, record.channelKey));
        assertNotNull(stored);
        assertEquals("payload", stored.getValue());
        assertEquals(20L, runtime.totalGas(), "Checkpoint update should charge gas");
        assertEquals("nextSig", record.lastEventSignature);

        ChannelEventCheckpoint checkpoint = (ChannelEventCheckpoint) bundle.marker(ProcessorContractConstants.KEY_CHECKPOINT);
        assertNotNull(checkpoint);
        assertEquals("nextSig", checkpoint.lastSignature("testChannel"));
        Node markerStored = checkpoint.lastEvent("testChannel");
        assertNotNull(markerStored);
        assertEquals("payload", markerStored.getValue());

        eventNode.value("mutated-after-persist");
        Node markerStoredAfterMutation = checkpoint.lastEvent("testChannel");
        assertNotNull(markerStoredAfterMutation);
        assertEquals("payload", markerStoredAfterMutation.getValue(),
                "Checkpoint marker should store cloned event snapshots");
    }

    @Test
    void persistEscapesChannelKeyInStoredPointer() {
        DocumentProcessingRuntime runtime = new DocumentProcessingRuntime(new Node());
        CheckpointManager manager = new CheckpointManager(runtime, node -> node != null ? "sig" : null);
        ContractBundle bundle = ContractBundle.builder().build();
        manager.ensureCheckpointMarker("/", bundle);

        CheckpointManager.CheckpointRecord record = manager.findCheckpoint(bundle, "channel/a");
        Node eventNode = new Node().value("payload");
        manager.persist("/", bundle, record, "sig-1", eventNode);

        Node escaped = ProcessorEngine.nodeAt(runtime.document(),
                "/contracts/checkpoint/lastEvents/channel~1a");
        assertNotNull(escaped);
        assertEquals("payload", escaped.getValue());

        Node nested = ProcessorEngine.nodeAt(runtime.document(),
                "/contracts/checkpoint/lastEvents/channel/a");
        assertNull(nested);
    }

    @Test
    void findsCheckpointRecordsAndDerivesExistingSignatureWhenMissingExplicitSignature() {
        DocumentProcessingRuntime runtime = new DocumentProcessingRuntime(new Node());
        CheckpointManager manager = new CheckpointManager(runtime, node -> node != null ? String.valueOf(node.getValue()) : null);
        ContractBundle bundle = ContractBundle.builder().build();
        manager.ensureCheckpointMarker("/", bundle);

        ChannelEventCheckpoint checkpoint = (ChannelEventCheckpoint) bundle.marker(ProcessorContractConstants.KEY_CHECKPOINT);
        checkpoint.putEvent("channelA", new Node().value("prior"));

        CheckpointManager.CheckpointRecord record = manager.findCheckpoint(bundle, "channelA");
        assertNotNull(record);
        assertEquals("prior", record.lastEventSignature);
    }

    @Test
    void detectsDuplicateEventsViaSignatures() {
        DocumentProcessingRuntime runtime = new DocumentProcessingRuntime(new Node());
        CheckpointManager manager = new CheckpointManager(runtime, node -> node != null ? String.valueOf(node.getValue()) : null);
        ContractBundle bundle = ContractBundle.builder().build();
        manager.ensureCheckpointMarker("/", bundle);

        CheckpointManager.CheckpointRecord missing = manager.findCheckpoint(bundle, "missing");
        assertFalse(manager.isDuplicate(missing, "sig"), "Missing record must not report duplicates");

        CheckpointManager.CheckpointRecord record = manager.findCheckpoint(bundle, "channelX");
        Node eventNode = new Node().value("value-x");
        manager.persist("/", bundle, record, "sig-x", eventNode);

        assertTrue(manager.isDuplicate(record, "sig-x"));
    }

    @Test
    void ignoresPersistenceWhenRecordIsNull() {
        DocumentProcessingRuntime runtime = new DocumentProcessingRuntime(new Node());
        CheckpointManager manager = new CheckpointManager(runtime, node -> node != null ? String.valueOf(node.getValue()) : null);
        ContractBundle bundle = ContractBundle.builder().build();

        assertDoesNotThrow(() -> manager.persist("/", bundle, null, "sig", new Node().value("v")));
    }
}
