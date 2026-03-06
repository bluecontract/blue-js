package blue.language.processor.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProcessorPointerConstantsTest {

    @Test
    void reservedPointersMatchExpectedPaths() {
        assertEquals("/contracts", ProcessorPointerConstants.RELATIVE_CONTRACTS);
        assertEquals("/contracts/initialized", ProcessorPointerConstants.RELATIVE_INITIALIZED);
        assertEquals("/contracts/terminated", ProcessorPointerConstants.RELATIVE_TERMINATED);
        assertEquals("/contracts/embedded", ProcessorPointerConstants.RELATIVE_EMBEDDED);
        assertEquals("/contracts/checkpoint", ProcessorPointerConstants.RELATIVE_CHECKPOINT);
    }

    @Test
    void contractsEntryAppendsKeyWithoutDuplicatingSeparators() {
        assertEquals("/contracts/custom", ProcessorPointerConstants.relativeContractsEntry("custom"));
    }

    @Test
    void contractsEntryEscapesPointerSpecialCharacters() {
        assertEquals("/contracts/a~1b~0c", ProcessorPointerConstants.relativeContractsEntry("a/b~c"));
    }

    @Test
    void checkpointLastEventPointerIncludesChannelKey() {
        String pointer = ProcessorPointerConstants.relativeCheckpointLastEvent("checkpoint", "channelA");
        assertEquals("/contracts/checkpoint/lastEvents/channelA", pointer);
    }

    @Test
    void checkpointPointersEscapeMarkerAndChannelKeys() {
        String eventPointer = ProcessorPointerConstants.relativeCheckpointLastEvent("marker/x", "chan~1");
        String signaturePointer = ProcessorPointerConstants.relativeCheckpointLastSignature("marker/x", "chan~1");
        assertEquals("/contracts/marker~1x/lastEvents/chan~01", eventPointer);
        assertEquals("/contracts/marker~1x/lastSignatures/chan~01", signaturePointer);
    }

    @Test
    void pointerHelpersRejectNullSegments() {
        IllegalArgumentException contractNull = assertThrows(IllegalArgumentException.class,
                () -> ProcessorPointerConstants.relativeContractsEntry(null));
        assertTrue(contractNull.getMessage().contains("Contract key"));

        IllegalArgumentException channelNull = assertThrows(IllegalArgumentException.class,
                () -> ProcessorPointerConstants.relativeCheckpointLastEvent("checkpoint", null));
        assertTrue(channelNull.getMessage().contains("Channel key"));

        IllegalArgumentException channelEmpty = assertThrows(IllegalArgumentException.class,
                () -> ProcessorPointerConstants.relativeCheckpointLastSignature("checkpoint", ""));
        assertTrue(channelEmpty.getMessage().contains("Channel key"));

        assertThrows(IllegalArgumentException.class, () -> ProcessorPointerConstants.relativeContractsEntry(""));
        assertThrows(IllegalArgumentException.class, () -> ProcessorPointerConstants.relativeCheckpointLastEvent("", "channelA"));
    }
}

