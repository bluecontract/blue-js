package blue.language.processor.util;

import blue.language.processor.model.ChannelContract;
import blue.language.processor.model.DocumentUpdateChannel;
import blue.language.processor.model.EmbeddedNodeChannel;
import blue.language.processor.model.LifecycleChannel;
import blue.language.processor.model.TriggeredEventChannel;
import blue.language.model.TypeBlueId;

import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Shared constants describing reserved processor keys and built-in channel types.
 */
public final class ProcessorContractConstants {

    public static final String KEY_EMBEDDED = "embedded";
    public static final String KEY_INITIALIZED = "initialized";
    public static final String KEY_TERMINATED = "terminated";
    public static final String KEY_CHECKPOINT = "checkpoint";

    public static final String BLUE_ID_DOCUMENT_UPDATE_CHANNEL = "6H1iGrDAcqtFE1qv3iyMTj79jCZsMUMxsNUzqYSJNbyR";
    public static final String BLUE_ID_TRIGGERED_EVENT_CHANNEL = "C77W4kVGcxL7Mkx9WL9QESPEFFL2GzWAe647s1Efprt";
    public static final String BLUE_ID_LIFECYCLE_CHANNEL = "H2aCCTUcLMTJozWkn7HPUjyFBFxamraw1q8DyWk87zxr";
    public static final String BLUE_ID_EMBEDDED_NODE_CHANNEL = "Fjbu3QpnUaTruDTcTidETCX2N5STyv7KYxT42PCzGHxm";

    public static final String ALIAS_DOCUMENT_UPDATE_CHANNEL = "Document Update Channel";
    public static final String ALIAS_TRIGGERED_EVENT_CHANNEL = "Triggered Event Channel";
    public static final String ALIAS_LIFECYCLE_CHANNEL = "Lifecycle Event Channel";
    public static final String ALIAS_EMBEDDED_NODE_CHANNEL = "Embedded Node Channel";

    public static final String LEGACY_BLUE_ID_DOCUMENT_UPDATE_CHANNEL = "Core/Document Update Channel";
    public static final String LEGACY_BLUE_ID_TRIGGERED_EVENT_CHANNEL = "Core/Triggered Event Channel";
    public static final String LEGACY_BLUE_ID_LIFECYCLE_CHANNEL = "Core/Lifecycle Event Channel";
    public static final String LEGACY_BLUE_ID_EMBEDDED_NODE_CHANNEL = "Core/Embedded Node Channel";

    @Deprecated
    public static final String CORE_BLUE_ID_DOCUMENT_UPDATE_CHANNEL = LEGACY_BLUE_ID_DOCUMENT_UPDATE_CHANNEL;
    @Deprecated
    public static final String CORE_BLUE_ID_TRIGGERED_EVENT_CHANNEL = LEGACY_BLUE_ID_TRIGGERED_EVENT_CHANNEL;
    @Deprecated
    public static final String CORE_BLUE_ID_LIFECYCLE_CHANNEL = LEGACY_BLUE_ID_LIFECYCLE_CHANNEL;
    @Deprecated
    public static final String CORE_BLUE_ID_EMBEDDED_NODE_CHANNEL = LEGACY_BLUE_ID_EMBEDDED_NODE_CHANNEL;

    public static final Set<String> RESERVED_CONTRACT_KEYS =
            Collections.unmodifiableSet(new LinkedHashSet<String>(Arrays.asList(
                    KEY_EMBEDDED,
                    KEY_INITIALIZED,
                    KEY_TERMINATED,
                    KEY_CHECKPOINT
            )));

    public static final Set<Class<? extends ChannelContract>> PROCESSOR_MANAGED_CHANNEL_TYPES =
            Collections.unmodifiableSet(new LinkedHashSet<Class<? extends ChannelContract>>(Arrays.<Class<? extends ChannelContract>>asList(
                    DocumentUpdateChannel.class,
                    TriggeredEventChannel.class,
                    LifecycleChannel.class,
                    EmbeddedNodeChannel.class
            )));

    public static final Set<String> PROCESSOR_MANAGED_CHANNEL_BLUE_IDS =
            Collections.unmodifiableSet(new LinkedHashSet<String>(Arrays.asList(
                    BLUE_ID_DOCUMENT_UPDATE_CHANNEL,
                    BLUE_ID_TRIGGERED_EVENT_CHANNEL,
                    BLUE_ID_LIFECYCLE_CHANNEL,
                    BLUE_ID_EMBEDDED_NODE_CHANNEL,
                    ALIAS_DOCUMENT_UPDATE_CHANNEL,
                    ALIAS_TRIGGERED_EVENT_CHANNEL,
                    ALIAS_LIFECYCLE_CHANNEL,
                    ALIAS_EMBEDDED_NODE_CHANNEL,
                    LEGACY_BLUE_ID_DOCUMENT_UPDATE_CHANNEL,
                    LEGACY_BLUE_ID_TRIGGERED_EVENT_CHANNEL,
                    LEGACY_BLUE_ID_LIFECYCLE_CHANNEL,
                    LEGACY_BLUE_ID_EMBEDDED_NODE_CHANNEL
            )));

    private ProcessorContractConstants() {
    }

    public static boolean isReservedKey(String key) {
        return key != null && RESERVED_CONTRACT_KEYS.contains(key);
    }

    public static boolean isProcessorManagedChannelBlueId(String blueId) {
        return blueId != null && PROCESSOR_MANAGED_CHANNEL_BLUE_IDS.contains(blueId);
    }

    public static boolean isProcessorManagedChannel(ChannelContract contract) {
        if (contract == null) {
            return false;
        }
        String blueId = resolveContractBlueId(contract);
        if (isProcessorManagedChannelBlueId(blueId)) {
            return true;
        }
        for (Class<? extends ChannelContract> type : PROCESSOR_MANAGED_CHANNEL_TYPES) {
            if (type.isInstance(contract)) {
                return true;
            }
        }
        return false;
    }

    private static String resolveContractBlueId(ChannelContract contract) {
        TypeBlueId typeBlueId = contract.getClass().getAnnotation(TypeBlueId.class);
        if (typeBlueId == null) {
            return null;
        }
        String[] values = typeBlueId.value();
        if (values != null && values.length > 0) {
            return values[0];
        }
        String defaultValue = typeBlueId.defaultValue();
        return defaultValue != null && !defaultValue.isEmpty() ? defaultValue : null;
    }
}
