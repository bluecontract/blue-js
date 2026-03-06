package blue.language.sdk.dsl;

import blue.language.model.Node;
import blue.language.sdk.DocBuilder;
import blue.language.types.conversation.ChatMessage;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DocBuilderAiDslParityTest {

    @Test
    void aiBuilderGeneratesPermissionSubscriptionAndStatusContracts() {
        Node built = DocBuilder.doc()
                .name("AI integration parity")
                .channel("ownerChannel")
                .myOsAdmin("myOsAdminChannel")
                .field("/llmProviderSessionId", "session-llm-1")
                .ai("mealAI")
                    .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
                    .permissionFrom("ownerChannel")
                    .statusPath("/mealAI/status")
                    .contextPath("/mealAI/context")
                    .requesterId("MEAL_PLANNER")
                    .done()
                .buildDocument();

        assertEquals("pending", built.getAsText("/mealAI/status/value"));
        assertEquals(0, built.getAsNode("/mealAI/context").getProperties().size());

        assertEquals("MyOS/Single Document Permission Grant Requested",
                built.getAsText("/contracts/aiMEALAIRequestPermission/steps/0/event/type/value"));
        assertEquals("ownerChannel",
                built.getAsText("/contracts/aiMEALAIRequestPermission/steps/0/event/onBehalfOf/value"));
        assertEquals("REQ_MEALAI",
                built.getAsText("/contracts/aiMEALAIRequestPermission/steps/0/event/requestId/value"));
        assertEquals("${document('/llmProviderSessionId')}",
                built.getAsText("/contracts/aiMEALAIRequestPermission/steps/0/event/targetSessionId/value"));

        assertEquals("MyOS/Subscribe to Session Requested",
                built.getAsText("/contracts/aiMEALAISubscribe/steps/0/event/type/value"));
        assertEquals("ownerChannel",
                built.getAsText("/contracts/aiMEALAISubscribe/steps/0/event/onBehalfOf/value"));
        assertEquals("SUB_MEALAI",
                built.getAsText("/contracts/aiMEALAISubscribe/steps/0/event/subscription/id/value"));

        assertEquals("/mealAI/status",
                built.getAsText("/contracts/aiMEALAISubscriptionReady/steps/0/changeset/0/path/value"));
        assertEquals("ready",
                built.getAsText("/contracts/aiMEALAISubscriptionReady/steps/0/changeset/0/val/value"));
    }

    @Test
    void askAIGeneratesCallOperationRequestedWithContextAndPromptExpression() {
        Node built = DocBuilder.doc()
                .name("AI ask parity")
                .channel("ownerChannel")
                .myOsAdmin("myOsAdminChannel")
                .field("/llmProviderSessionId", "session-llm-2")
                .field("/prompt", "Return JSON only")
                .field("/maxCalories", 3000)
                .ai("mealAI")
                    .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
                    .permissionFrom("ownerChannel")
                    .statusPath("/mealAI/status")
                    .contextPath("/mealAI/context")
                    .requesterId("MEAL_PLANNER")
                    .done()
                .operation("requestMealPlan")
                    .channel("ownerChannel")
                    .description("Request meal plan")
                    .steps(steps -> steps.askAI("mealAI", "GeneratePlan", ask -> ask
                            .instruction(DocBuilder.expr("document('/prompt')"))
                            .instruction("Keep total calories <= ${document('/maxCalories')}")
                            .instruction("Meal request: ${event.message.request}")))
                    .done()
                .buildDocument();

        String eventPath = "/contracts/requestMealPlanImpl/steps/0/event";
        assertEquals("MyOS/Call Operation Requested", built.getAsText(eventPath + "/type/value"));
        assertEquals("ownerChannel", built.getAsText(eventPath + "/onBehalfOf/value"));
        assertEquals("${document('/llmProviderSessionId')}", built.getAsText(eventPath + "/targetSessionId/value"));
        assertEquals("provideInstructions", built.getAsText(eventPath + "/operation/value"));
        assertEquals("MEAL_PLANNER", built.getAsText(eventPath + "/request/requester/value"));
        assertEquals("${document('/mealAI/context')}", built.getAsText(eventPath + "/request/context/value"));

        String instructions = built.getAsText(eventPath + "/request/instructions/value");
        assertTrue(instructions.contains("document('/prompt')"), instructions);
        assertTrue(instructions.contains("document('/maxCalories')"), instructions);
        assertTrue(instructions.contains("event.message.request"), instructions);
    }

    @Test
    void onAIResponseBuildsSubscriptionMatcherAndAutoContextSave() {
        Node built = DocBuilder.doc()
                .name("AI response parity")
                .channel("ownerChannel")
                .myOsAdmin("myOsAdminChannel")
                .field("/llmProviderSessionId", "session-llm-3")
                .ai("mealAI")
                    .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
                    .permissionFrom("ownerChannel")
                    .statusPath("/mealAI/status")
                    .contextPath("/mealAI/context")
                    .requesterId("MEAL_PLANNER")
                    .done()
                .onAIResponse("mealAI", "onMealPlan", steps -> steps
                        .replaceValue("MarkDone", "/mealAI/lastResult", "processed"))
                .buildDocument();

        String workflow = "/contracts/onMealPlan";
        assertEquals("triggeredEventChannel", built.getAsText(workflow + "/channel/value"));
        assertEquals("MyOS/Subscription Update", built.getAsText(workflow + "/event/type/value"));
        assertEquals("SUB_MEALAI", built.getAsText(workflow + "/event/subscriptionId/value"));
        assertEquals("Conversation/Response", built.getAsText(workflow + "/event/update/type/value"));
        assertEquals("MEAL_PLANNER",
                built.getAsText(workflow + "/event/update/inResponseTo/incomingEvent/requester/value"));

        assertEquals("/mealAI/context",
                built.getAsText(workflow + "/steps/0/changeset/0/path/value"));
        assertEquals("${event.update.context}",
                built.getAsText(workflow + "/steps/0/changeset/0/val/value"));
        assertEquals("/mealAI/lastResult",
                built.getAsText(workflow + "/steps/1/changeset/0/path/value"));
    }

    @Test
    void multipleAiIntegrationsStayIndependent() {
        Node built = DocBuilder.doc()
                .name("Two AI parity")
                .channels("aliceChannel", "bobChannel")
                .myOsAdmin("myOsAdminChannel")
                .field("/aliceSessionId", "session-a")
                .field("/bobSessionId", "session-b")
                .ai("analyst")
                    .sessionId(DocBuilder.expr("document('/aliceSessionId')"))
                    .permissionFrom("aliceChannel")
                    .contextPath("/integrations/analyst/context")
                    .statusPath("/integrations/analyst/status")
                    .requesterId("ALICE_ANALYST")
                    .done()
                .ai("validator")
                    .sessionId(DocBuilder.expr("document('/bobSessionId')"))
                    .permissionFrom("bobChannel")
                    .contextPath("/integrations/validator/context")
                    .statusPath("/integrations/validator/status")
                    .requesterId("BOB_VALIDATOR")
                    .done()
                .onInit("kickoff", steps -> steps
                        .askAI("analyst", "AskAnalyst", ask -> ask.instruction("Analyze"))
                        .askAI("validator", "AskValidator", ask -> ask.instruction("Validate")))
                .buildDocument();

        String first = "/contracts/kickoff/steps/0/event";
        assertEquals("aliceChannel", built.getAsText(first + "/onBehalfOf/value"));
        assertEquals("${document('/aliceSessionId')}", built.getAsText(first + "/targetSessionId/value"));
        assertEquals("ALICE_ANALYST", built.getAsText(first + "/request/requester/value"));
        assertEquals("${document('/integrations/analyst/context')}", built.getAsText(first + "/request/context/value"));

        String second = "/contracts/kickoff/steps/1/event";
        assertEquals("bobChannel", built.getAsText(second + "/onBehalfOf/value"));
        assertEquals("${document('/bobSessionId')}", built.getAsText(second + "/targetSessionId/value"));
        assertEquals("BOB_VALIDATOR", built.getAsText(second + "/request/requester/value"));
        assertEquals("${document('/integrations/validator/context')}", built.getAsText(second + "/request/context/value"));
    }

    @Test
    void onAIResponseSupportsExplicitResponseType() {
        Node built = DocBuilder.doc()
                .name("AI explicit type parity")
                .channel("ownerChannel")
                .myOsAdmin("myOsAdminChannel")
                .field("/llmProviderSessionId", "session-llm-4")
                .ai("mealAI")
                    .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
                    .permissionFrom("ownerChannel")
                    .statusPath("/mealAI/status")
                    .contextPath("/mealAI/context")
                    .requesterId("MEAL_PLANNER")
                    .done()
                .onAIResponse("mealAI", "onChatMessage", ChatMessage.class, steps -> steps
                        .replaceValue("MarkSeen", "/mealAI/seen", true))
                .buildDocument();

        assertEquals("Conversation/Chat Message",
                built.getAsText("/contracts/onChatMessage/event/update/type/value"));
        assertEquals("MEAL_PLANNER",
                built.getAsText("/contracts/onChatMessage/event/update/inResponseTo/incomingEvent/requester/value"));
    }

    @Test
    void askAIRejectsUnknownIntegration() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                DocBuilder.doc()
                        .name("AI unknown integration")
                        .operation("ask")
                            .channel("ownerChannel")
                            .steps(steps -> steps.askAI("missing", ask -> ask.instruction("hello")))
                            .done()
                        .buildDocument());
        assertTrue(ex.getMessage().contains("Unknown AI integration"));
    }

    @Test
    void aiTaskTemplateCanBeReusedAndExtendedInline() {
        Node built = DocBuilder.doc()
                .name("AI task parity")
                .channel("ownerChannel")
                .myOsAdmin()
                .field("/llmProviderSessionId", "session-tasks")
                .ai("provider")
                    .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
                    .permissionFrom("ownerChannel")
                    .task("summarize")
                        .instruction("Summarize input in bullet points.")
                        .expects(ChatMessage.class)
                        .expectsNamed("meal-plan-ready", fields -> fields
                                .field("planId", "Plan identifier")
                                .field("totalCalories"))
                        .done()
                    .done()
                .operation("run")
                    .channel("ownerChannel")
                    .steps(steps -> steps.askAI("provider", "RunTask", ask -> ask
                            .task("summarize")
                            .expectsNamed("meal-plan-warning")
                            .instruction("Input: ${event.message.request}")))
                    .done()
                .buildDocument();

        String requestPath = "/contracts/runImpl/steps/0/event/request";
        assertEquals("summarize", built.getAsText(requestPath + "/taskName/value"));
        String instructions = built.getAsText(requestPath + "/instructions/value");
        assertTrue(instructions.contains("Summarize input in bullet points"), instructions);
        assertTrue(instructions.contains("event.message.request"), instructions);
        assertEquals("Conversation/Chat Message",
                built.getAsText(requestPath + "/expectedResponses/0/value"));
        assertEquals("Common/Named Event",
                built.getAsText(requestPath + "/expectedResponses/1/type/value"));
        assertEquals("meal-plan-ready",
                built.getAsText(requestPath + "/expectedResponses/1/name/value"));
        assertEquals("Plan identifier",
                built.getAsText(requestPath + "/expectedResponses/1/payload/planId/description/value"));
        assertEquals("meal-plan-warning",
                built.getAsText(requestPath + "/expectedResponses/2/name/value"));
    }

    @Test
    void expectsNamedVarargsSupportsFieldNamesInTaskAndInline() {
        Node built = DocBuilder.doc()
                .name("AI named varargs parity")
                .channel("ownerChannel")
                .myOsAdmin()
                .field("/llmProviderSessionId", "session-varargs")
                .ai("provider")
                    .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
                    .permissionFrom("ownerChannel")
                    .task("summarize")
                        .instruction("Summarize.")
                        .expectsNamed("summary-ready", "summaryId", "quality")
                        .done()
                    .done()
                .operation("run")
                    .channel("ownerChannel")
                    .steps(steps -> steps.askAI("provider", "RunTask", ask -> ask
                            .task("summarize")
                            .instruction("Input: ${event.message.request}")
                            .expectsNamed("summary-warning", "code", "message")))
                    .done()
                .buildDocument();

        String requestPath = "/contracts/runImpl/steps/0/event/request";
        assertEquals("summary-ready",
                built.getAsText(requestPath + "/expectedResponses/0/name/value"));
        assertNotNull(built.getAsNode(requestPath + "/expectedResponses/0/payload/summaryId"));
        assertNotNull(built.getAsNode(requestPath + "/expectedResponses/0/payload/quality"));

        assertEquals("summary-warning",
                built.getAsText(requestPath + "/expectedResponses/1/name/value"));
        assertNotNull(built.getAsNode(requestPath + "/expectedResponses/1/payload/code"));
        assertNotNull(built.getAsNode(requestPath + "/expectedResponses/1/payload/message"));
    }

    @Test
    void askAIRejectsUnknownTaskForIntegration() {
        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                DocBuilder.doc()
                        .name("AI unknown task")
                        .channel("ownerChannel")
                        .myOsAdmin()
                        .field("/llmProviderSessionId", "session-task-missing")
                        .ai("provider")
                            .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
                            .permissionFrom("ownerChannel")
                            .task("known")
                                .instruction("known instruction")
                                .done()
                            .done()
                        .operation("run")
                            .channel("ownerChannel")
                            .steps(steps -> steps.askAI("provider", ask -> ask.task("missing")))
                            .done()
                        .buildDocument());
        assertTrue(ex.getMessage().contains("Unknown task 'missing'"));
    }

    @Test
    void askAIRequiresAtLeastOneInstructionFromTaskOrInline() {
        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                DocBuilder.doc()
                        .name("AI empty ask")
                        .channel("ownerChannel")
                        .myOsAdmin()
                        .field("/llmProviderSessionId", "session-empty")
                        .ai("provider")
                            .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
                            .permissionFrom("ownerChannel")
                            .done()
                        .operation("run")
                            .channel("ownerChannel")
                            .steps(steps -> steps.askAI("provider", ask -> { }))
                            .done()
                        .buildDocument());
        assertTrue(ex.getMessage().contains("at least one instruction"));
    }

    @Test
    void aiPermissionOnEventBuildsPermissionWorkflowOnTriggeredChannel() {
        Node built = DocBuilder.doc()
                .name("AI permission on event")
                .channel("ownerChannel")
                .myOsAdmin()
                .field("/llmProviderSessionId", "session-evt")
                .ai("provider")
                    .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
                    .permissionFrom("ownerChannel")
                    .requestPermissionOnEvent(ChatMessage.class)
                    .done()
                .buildDocument();

        assertEquals("triggeredEventChannel",
                built.getAsText("/contracts/aiPROVIDERRequestPermission/channel/value"));
        assertEquals("Conversation/Chat Message",
                built.getAsText("/contracts/aiPROVIDERRequestPermission/event/type/value"));
    }

    @Test
    void aiPermissionOnDocChangeBuildsPermissionWorkflowWithDocUpdateChannel() {
        Node built = DocBuilder.doc()
                .name("AI permission on doc change")
                .channel("ownerChannel")
                .myOsAdmin()
                .field("/llmProviderSessionId", "session-doc")
                .ai("provider")
                    .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
                    .permissionFrom("ownerChannel")
                    .requestPermissionOnDocChange("/status")
                    .done()
                .buildDocument();

        assertEquals("Document Update Channel",
                built.getAsText("/contracts/aiPROVIDERRequestPermissionDocUpdateChannel/type/value"));
        assertEquals("/status",
                built.getAsText("/contracts/aiPROVIDERRequestPermissionDocUpdateChannel/path/value"));
        assertEquals("aiPROVIDERRequestPermissionDocUpdateChannel",
                built.getAsText("/contracts/aiPROVIDERRequestPermission/channel/value"));
    }

    @Test
    void aiPermissionManualSkipsAutoPermissionWorkflowAndSupportsManualStep() {
        Node built = DocBuilder.doc()
                .name("AI permission manual")
                .channel("ownerChannel")
                .myOsAdmin()
                .field("/llmProviderSessionId", "session-manual")
                .ai("provider")
                    .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
                    .permissionFrom("ownerChannel")
                    .requestPermissionManually()
                    .done()
                .operation("activate")
                    .channel("ownerChannel")
                    .steps(steps -> steps.ai("provider").requestPermission("RequestNow"))
                    .done()
                .buildDocument();

        assertNull(built.getAsNode("/contracts").getProperties().get("aiPROVIDERRequestPermission"));
        assertEquals("MyOS/Single Document Permission Grant Requested",
                built.getAsText("/contracts/activateImpl/steps/0/event/type/value"));
        assertEquals("RequestNow",
                built.getAsText("/contracts/activateImpl/steps/0/name"));
    }

    @Test
    void onAIResponseSupportsTaskFilteredMatcher() {
        Node built = DocBuilder.doc()
                .name("AI task response matcher")
                .channel("ownerChannel")
                .myOsAdmin()
                .field("/llmProviderSessionId", "session-filter")
                .ai("provider")
                    .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
                    .permissionFrom("ownerChannel")
                    .task("summarize")
                        .instruction("Summarize.")
                        .done()
                    .done()
                .onAIResponse("provider", "onSummary", ChatMessage.class, "summarize", steps -> steps
                        .replaceValue("MarkSeen", "/seen", true))
                .buildDocument();

        assertEquals("summarize",
                built.getAsText("/contracts/onSummary/event/update/inResponseTo/incomingEvent/taskName/value"));
        assertEquals("Conversation/Chat Message",
                built.getAsText("/contracts/onSummary/event/update/type/value"));
    }

    @Test
    void onAIResponseSupportsNamedEventMatcher() {
        Node built = DocBuilder.doc()
                .name("AI named event matcher")
                .channel("ownerChannel")
                .myOsAdmin()
                .field("/llmProviderSessionId", "session-named-response")
                .ai("provider")
                    .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
                    .permissionFrom("ownerChannel")
                    .done()
                .onAIResponse("provider", "onMealPlanReady", "meal-plan-ready", steps -> steps
                        .replaceValue("MarkSeen", "/seen", true))
                .buildDocument();

        assertEquals("SUB_PROVIDER",
                built.getAsText("/contracts/onMealPlanReady/event/subscriptionId/value"));
        assertEquals("Common/Named Event",
                built.getAsText("/contracts/onMealPlanReady/event/update/type/value"));
        assertEquals("meal-plan-ready",
                built.getAsText("/contracts/onMealPlanReady/event/update/name/value"));
        assertEquals("/ai/provider/context",
                built.getAsText("/contracts/onMealPlanReady/steps/0/changeset/0/path/value"));
    }

    @Test
    void onAIResponseSupportsNamedEventAndTaskFilteredMatcher() {
        Node built = DocBuilder.doc()
                .name("AI named event task matcher")
                .channel("ownerChannel")
                .myOsAdmin()
                .field("/llmProviderSessionId", "session-named-task-response")
                .ai("provider")
                    .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
                    .permissionFrom("ownerChannel")
                    .task("summarize")
                        .instruction("Summarize.")
                        .done()
                    .done()
                .onAIResponse("provider", "onMealPlanReady", "meal-plan-ready", "summarize", steps -> steps
                        .replaceValue("MarkSeen", "/seen", true))
                .buildDocument();

        assertEquals("Common/Named Event",
                built.getAsText("/contracts/onMealPlanReady/event/update/type/value"));
        assertEquals("meal-plan-ready",
                built.getAsText("/contracts/onMealPlanReady/event/update/name/value"));
        assertEquals("summarize",
                built.getAsText("/contracts/onMealPlanReady/event/update/inResponseTo/incomingEvent/taskName/value"));
    }

    @Test
    void onAIResponseRejectsUnknownTaskName() {
        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                DocBuilder.doc()
                        .name("AI bad response task")
                        .channel("ownerChannel")
                        .myOsAdmin()
                        .field("/llmProviderSessionId", "session-bad-response-task")
                        .ai("provider")
                            .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
                            .permissionFrom("ownerChannel")
                            .task("known")
                                .instruction("known")
                                .done()
                            .done()
                        .onAIResponse("provider", "onBad", ChatMessage.class, "missing", steps -> { })
                        .buildDocument());
        assertTrue(ex.getMessage().contains("Unknown task 'missing'"));
    }

    @Test
    void aiTaskWithoutInstructionIsRejected() {
        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                DocBuilder.doc()
                        .name("AI bad task")
                        .channel("ownerChannel")
                        .myOsAdmin()
                        .field("/llmProviderSessionId", "session-bad-task")
                        .ai("provider")
                            .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
                            .permissionFrom("ownerChannel")
                            .task("empty")
                                .done()
                            .done()
                        .buildDocument());
        assertTrue(ex.getMessage().contains("at least one instruction"));
    }

    @Test
    void aiDuplicateTaskNameIsRejected() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                DocBuilder.doc()
                        .name("AI duplicate task")
                        .channel("ownerChannel")
                        .myOsAdmin()
                        .field("/llmProviderSessionId", "session-dup-task")
                        .ai("provider")
                            .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
                            .permissionFrom("ownerChannel")
                            .task("same")
                                .instruction("one")
                                .done()
                            .task("same")
                                .instruction("two")
                                .done()
                            .done()
                        .buildDocument());
        assertTrue(ex.getMessage().contains("Duplicate AI task name"));
    }
}
