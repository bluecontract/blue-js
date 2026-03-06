package blue.language.samples.sdk;

import blue.language.model.Node;
import blue.language.samples.paynote.voucher.BalancedBowlVoucherPayNote;
import blue.language.sdk.SimpleDocBuilder;
import blue.language.sdk.paynote.PayNotes;
import blue.language.types.conversation.DocumentBootstrapCompleted;
import blue.language.types.conversation.DocumentBootstrapFailed;
import blue.language.types.paynote.FundsCaptured;

import java.util.LinkedHashMap;
import java.util.Map;

public final class BootstrapExamples {

    private BootstrapExamples() {
    }

    public static Map<String, Node> all() {
        Map<String, Node> docs = new LinkedHashMap<String, Node>();
        docs.put("bootstrapVoucherOnCapture", bootstrapVoucherOnCapture());
        docs.put("bootstrapViaOrchestrator", bootstrapViaOrchestrator());
        docs.put("bootstrapWithMessages", bootstrapWithMessages());
        return docs;
    }

    public static Node bootstrapVoucherOnCapture() {
        return PayNotes.payNote("Armchair With Voucher Bootstrap")
                .currency("USD")
                .amountMinor(80000)
                .capture()
                    .lockOnInit()
                    .unlockOnOperation(
                            "confirmSatisfaction",
                            "payerChannel",
                            "Confirm armchair is satisfactory.")
                    .done()
                .onEvent("bootstrapVoucher", FundsCaptured.class, steps -> steps
                        .myOs().bootstrapDocument(
                                "BootstrapVoucherDoc",
                                BalancedBowlVoucherPayNote.templateDoc(),
                                Map.of(
                                        "payerChannel", "payerChannel",
                                        "payeeChannel", "payeeChannel",
                                        "merchantChannel", "payeeChannel")))
                .onMyOsResponse("onVoucherReady",
                        DocumentBootstrapCompleted.class,
                        steps -> steps
                                .replaceExpression("SaveSession", "/voucher/sessionId", "event.message.sessionId")
                                .replaceValue("MarkActive", "/voucher/status", "active"))
                .onMyOsResponse("onVoucherFailed",
                        DocumentBootstrapFailed.class,
                        steps -> steps.replaceValue("MarkFailed", "/voucher/status", "failed"))
                .buildDocument();
    }

    public static Node bootstrapViaOrchestrator() {
        return SimpleDocBuilder.doc()
                .name("Orchestrated Document")
                .channel("orchestratorChannel")
                .channel("aliceChannel")
                .channel("bobChannel")
                .onInit("bootstrapChild", steps -> steps
                        .bootstrapDocument(
                                "BootstrapChildDoc",
                                childDoc(),
                                Map.of(
                                        "participantA", "aliceChannel",
                                        "participantB", "bobChannel"),
                                options -> options
                                        .assignee("orchestratorChannel")
                                        .defaultMessage("You have been added to a collaboration.")))
                .onEvent("onChildReady",
                        DocumentBootstrapCompleted.class,
                        steps -> steps.replaceExpression("SaveChild", "/child/sessionId", "event.message.sessionId"))
                .buildDocument();
    }

    public static Node bootstrapWithMessages() {
        return SimpleDocBuilder.doc()
                .name("With Messages")
                .channel("sellerChannel")
                .channel("buyerChannel")
                .myOsAdmin("myOsAdminChannel")
                .onInit("bootstrapDeal", steps -> steps
                        .myOs().bootstrapDocument(
                                "BootstrapDeal",
                                dealDoc(),
                                Map.of(
                                        "sellerChannel", "sellerChannel",
                                        "buyerChannel", "buyerChannel"),
                                options -> options
                                        .defaultMessage("A new deal has been created.")
                                        .channelMessage("buyerChannel", "You have a new purchase to review.")))
                .buildDocument();
    }

    private static Node childDoc() {
        return SimpleDocBuilder.doc()
                .name("Child Collaboration")
                .type("Demo/Child")
                .channel("participantA")
                .channel("participantB")
                .buildDocument();
    }

    private static Node dealDoc() {
        return SimpleDocBuilder.doc()
                .name("Deal")
                .type("Demo/Deal")
                .channel("sellerChannel")
                .channel("buyerChannel")
                .field("/status", "draft")
                .buildDocument();
    }
}
