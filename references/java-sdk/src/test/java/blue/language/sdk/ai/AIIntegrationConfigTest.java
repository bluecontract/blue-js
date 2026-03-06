package blue.language.sdk.ai;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AIIntegrationConfigTest {

    @Test
    void onEventTimingRequiresTriggerClass() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                new AIIntegrationConfig(
                        "planner",
                        "PLANNER",
                        "${document('/sessionId')}",
                        "ownerChannel",
                        "/ai/planner/status",
                        "/ai/planner/context",
                        "PLANNER",
                        AIIntegrationConfig.PermissionTiming.ON_EVENT,
                        null,
                        null,
                        Map.of()));
        assertTrue(ex.getMessage().contains("permissionTriggerEventClass"));
    }

    @Test
    void onDocChangeTimingRequiresPath() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                new AIIntegrationConfig(
                        "planner",
                        "PLANNER",
                        "${document('/sessionId')}",
                        "ownerChannel",
                        "/ai/planner/status",
                        "/ai/planner/context",
                        "PLANNER",
                        AIIntegrationConfig.PermissionTiming.ON_DOC_CHANGE,
                        null,
                        "   ",
                        Map.of()));
        assertTrue(ex.getMessage().contains("permissionTriggerDocPath"));
    }
}
