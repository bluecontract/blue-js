package blue.language.processor.util;

import blue.language.processor.model.DocumentUpdateChannel;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProcessorContractConstantsTest {

    @Test
    void exposesReservedContractKeys() {
        List<String> keys = new ArrayList<>(ProcessorContractConstants.RESERVED_CONTRACT_KEYS);
        Collections.sort(keys);
        assertEquals(4, keys.size());
        assertTrue(keys.contains(ProcessorContractConstants.KEY_CHECKPOINT));
        assertTrue(keys.contains(ProcessorContractConstants.KEY_EMBEDDED));
        assertTrue(keys.contains(ProcessorContractConstants.KEY_INITIALIZED));
        assertTrue(keys.contains(ProcessorContractConstants.KEY_TERMINATED));
    }

    @Test
    void checksReservedContractKeys() {
        assertTrue(ProcessorContractConstants.isReservedKey(ProcessorContractConstants.KEY_EMBEDDED));
        assertFalse(ProcessorContractConstants.isReservedKey("custom"));
        assertFalse(ProcessorContractConstants.isReservedKey(null));
    }

    @Test
    void checksProcessorManagedChannelBlueIds() {
        assertTrue(ProcessorContractConstants.isProcessorManagedChannelBlueId(
                ProcessorContractConstants.CORE_BLUE_ID_LIFECYCLE_CHANNEL));
        assertTrue(ProcessorContractConstants.isProcessorManagedChannelBlueId(
                ProcessorContractConstants.BLUE_ID_LIFECYCLE_CHANNEL));
        assertFalse(ProcessorContractConstants.isProcessorManagedChannelBlueId("CustomChannel"));
        assertFalse(ProcessorContractConstants.isProcessorManagedChannelBlueId(null));
    }

    @Test
    void detectsProcessorManagedChannelsByInstanceType() {
        assertTrue(ProcessorContractConstants.isProcessorManagedChannel(new DocumentUpdateChannel()));
    }
}
