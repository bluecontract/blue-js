package blue.language.sdk;

import blue.language.model.Node;
import blue.language.processor.DocumentProcessingResult;
import blue.language.processor.DocumentProcessor;
import blue.language.samples.paynote.types.domain.VoucherEvents;
import blue.language.samples.paynote.voucher.ArmchairProtectionWithVoucherPayNote;
import blue.language.samples.paynote.voucher.BalancedBowlVoucherPayNote;
import blue.language.types.conversation.TimelineChannel;
import blue.language.types.paynote.FundsCaptured;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DocBuilderVoucherPayNoteIntegrationTest {

    @Test
    void processesArmchairAndBalancedVoucherFlowsInSeparateProcessors() {
        Node armchair = armchairIntegrationDocument();
        Node balanced = balancedIntegrationDocument();

        DocumentProcessor armchairProcessor = new DocumentProcessor();
        DocumentProcessor balancedProcessor = new DocumentProcessor();

        DocumentProcessingResult initializedArmchair = armchairProcessor.initializeDocument(armchair);
        DocumentProcessingResult initializedBalanced = balancedProcessor.initializeDocument(balanced);

        assertTrue(
                containsEventType(initializedArmchair.triggeredEvents(), "PayNote/Card Transaction Capture Lock Requested"),
                () -> "Armchair init events: " + eventTypes(initializedArmchair.triggeredEvents()));
        assertTrue(
                containsEventType(initializedBalanced.triggeredEvents(), "PayNote/Card Transaction Capture Lock Requested"),
                () -> "Balanced init events: " + eventTypes(initializedBalanced.triggeredEvents()));

        DocumentProcessingResult armchairAfterSatisfaction = armchairProcessor.processDocument(
                initializedArmchair.document(),
                operationRequest(
                        "evt-armchair-1",
                        "timeline-armchair-payer",
                        "simulateSatisfaction",
                        new Node().value(1)));
        assertTrue(
                !armchairAfterSatisfaction.capabilityFailure(),
                () -> "Armchair capability failure: " + armchairAfterSatisfaction.failureReason());
        assertTrue(
                containsEventType(armchairAfterSatisfaction.triggeredEvents(), "Demo/Satisfaction Confirmed"),
                () -> "Armchair satisfaction events: " + eventTypes(armchairAfterSatisfaction.triggeredEvents()));
        assertTrue(
                containsEventType(armchairAfterSatisfaction.triggeredEvents(), "PayNote/Card Transaction Capture Unlock Requested"),
                () -> "Armchair satisfaction events: " + eventTypes(armchairAfterSatisfaction.triggeredEvents()));

        DocumentProcessingResult armchairAfterFundsCaptured = armchairProcessor.processDocument(
                armchairAfterSatisfaction.document(),
                operationRequest(
                        "evt-armchair-2",
                        "timeline-armchair-guarantor",
                        "simulateFundsCaptured",
                        new Node().value(10000)));

        Node voucherPaymentRequest = findTriggeredEvent(
                armchairAfterFundsCaptured.triggeredEvents(),
                "PayNote/Backward Payment Requested");
        assertNotNull(voucherPaymentRequest);
        assertEquals("guarantorChannel", readValue(voucherPaymentRequest, "/processor/value"));
        assertEquals("payeeChannel", readValue(voucherPaymentRequest, "/from/value"));
        assertEquals("payerChannel", readValue(voucherPaymentRequest, "/to/value"));
        assertEquals("USD", readValue(voucherPaymentRequest, "/currency/value"));
        assertEquals("10000", String.valueOf(voucherPaymentRequest.get("/amountMinor/value")));
        assertEquals("voucher-activation", readValue(voucherPaymentRequest, "/reason/value"));
        assertEquals("Balanced Bowl Voucher - 100 USD", readValue(voucherPaymentRequest, "/attachedPayNote/name/value"));

        DocumentProcessingResult balancedAfterMonitoringApproval = balancedProcessor.processDocument(
                initializedBalanced.document(),
                operationRequest(
                        "evt-balanced-1",
                        "timeline-balanced-merchant",
                        "simulateMonitoringApproved",
                        new Node().value(1)));
        assertTrue(
                containsEventType(
                        balancedAfterMonitoringApproval.triggeredEvents(),
                        "Voucher/Monitoring Approved"),
                () -> "Balanced approval events: " + eventTypes(balancedAfterMonitoringApproval.triggeredEvents()));
        assertTrue(
                containsEventType(
                        balancedAfterMonitoringApproval.triggeredEvents(),
                        "Voucher/Start Monitoring Requested"),
                () -> "Balanced approval events: " + eventTypes(balancedAfterMonitoringApproval.triggeredEvents()));
        assertTrue(
                containsEventType(
                        balancedAfterMonitoringApproval.triggeredEvents(),
                        "PayNote/Card Transaction Capture Unlock Requested"),
                () -> "Balanced approval events: " + eventTypes(balancedAfterMonitoringApproval.triggeredEvents()));

        DocumentProcessingResult balancedAfterSpendCapture = balancedProcessor.processDocument(
                balancedAfterMonitoringApproval.document(),
                operationRequest(
                        "evt-balanced-2",
                        "timeline-balanced-merchant",
                        "simulateCaptureReportedSpend",
                        new Node().value(4200)));

        Node captureRequested = findTriggeredEvent(
                balancedAfterSpendCapture.triggeredEvents(),
                "PayNote/Capture Funds Requested");
        assertNotNull(captureRequested);
        assertEquals("4200", String.valueOf(captureRequested.get("/amount/value")));
    }

    private static Node armchairIntegrationDocument() {
        Node template = ArmchairProtectionWithVoucherPayNote.templateDoc();
        return DocBuilder.from(template)
                .channel("payerChannel", new TimelineChannel().timelineId("timeline-armchair-payer"))
                .channel("payeeChannel", new TimelineChannel().timelineId("timeline-armchair-payee"))
                .channel("guarantorChannel", new TimelineChannel().timelineId("timeline-armchair-guarantor"))
                .operation("simulateSatisfaction")
                    .channel("payerChannel")
                    .description("Emit satisfaction + capture unlock for integration tests")
                    .requestType(Integer.class)
                    .steps(steps -> steps
                            .emitType(
                                    "SatisfactionConfirmed",
                                    VoucherEvents.SatisfactionConfirmed.class,
                                    payload -> payload.put("by", "integration-test"))
                            .capture().unlock())
                    .done()
                .operation("simulateFundsCaptured")
                    .channel("guarantorChannel")
                    .description("Emit FundsCaptured for integration tests")
                    .requestType(Integer.class)
                    .steps(steps -> steps.emitType(
                            "EmitFundsCaptured",
                            FundsCaptured.class,
                            payload -> payload.putExpression("amountCaptured", "event.message.request")))
                    .done()
                .buildDocument();
    }

    private static Node balancedIntegrationDocument() {
        Node template = BalancedBowlVoucherPayNote.templateDoc();
        return DocBuilder.from(template)
                .channel("payerChannel", new TimelineChannel().timelineId("timeline-balanced-payer"))
                .channel("payeeChannel", new TimelineChannel().timelineId("timeline-balanced-payee"))
                .channel("guarantorChannel", new TimelineChannel().timelineId("timeline-balanced-guarantor"))
                .channel("merchantChannel", new TimelineChannel().timelineId("timeline-balanced-merchant"))
                .operation("simulateMonitoringApproved")
                    .channel("merchantChannel")
                    .description("Emit monitoring approval for integration tests")
                    .requestType(Integer.class)
                    .steps(steps -> steps.emitType(
                            "EmitMonitoringApproved",
                            VoucherEvents.MonitoringApproved.class,
                            payload -> payload.put("merchantId", "balanced_bowl_001")))
                    .done()
                .operation("simulateCaptureReportedSpend")
                    .channel("merchantChannel")
                    .description("Emit capture request for integration tests")
                    .requestType(Integer.class)
                    .steps(steps -> steps.capture().requestPartial("event.message.request"))
                    .done()
                .buildDocument();
    }

    private static Node operationRequest(String eventId,
                                         String timelineId,
                                         String operation,
                                         Node request) {
        Node message = new Node()
                .type(new Node().blueId("Conversation/Operation Request"))
                .properties("operation", new Node().value(operation));
        if (request != null) {
            message.properties("request", request);
        }
        return new Node()
                .type(new Node().blueId("Conversation/Timeline Entry"))
                .properties("eventId", new Node().value(eventId))
                .properties("timeline", new Node().properties("timelineId", new Node().value(timelineId)))
                .properties("message", message);
    }

    private static boolean containsEventType(List<Node> events, String typeAlias) {
        return findTriggeredEvent(events, typeAlias) != null;
    }

    private static Node findTriggeredEvent(List<Node> events, String typeAlias) {
        for (Node event : events) {
            if (typeAlias.equals(resolveEventType(event))) {
                return event;
            }
        }
        return null;
    }

    private static String resolveEventType(Node event) {
        if (event == null || event.getType() == null) {
            return null;
        }
        Node typeNode = event.getType();
        if (typeNode.getValue() != null) {
            return String.valueOf(typeNode.getValue());
        }
        if (typeNode.getBlueId() != null) {
            return typeNode.getBlueId();
        }
        if (typeNode.getProperties() != null && typeNode.getProperties().get("blueId") != null) {
            return String.valueOf(typeNode.getProperties().get("blueId").getValue());
        }
        return null;
    }

    private static String readValue(Node node, String pointer) {
        return String.valueOf(node.get(pointer));
    }

    private static List<String> eventTypes(List<Node> events) {
        return events.stream().map(DocBuilderVoucherPayNoteIntegrationTest::resolveEventType).toList();
    }
}
