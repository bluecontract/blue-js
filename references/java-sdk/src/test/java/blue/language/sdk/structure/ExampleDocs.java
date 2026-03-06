package blue.language.sdk.structure;

import blue.language.model.Node;
import blue.language.samples.paynote.PayNoteCookbookExamples;
import blue.language.samples.paynote.voucher.ArmchairProtectionWithVoucherPayNote;
import blue.language.samples.paynote.voucher.BalancedBowlVoucherPayNote;
import blue.language.samples.sdk.DocBuilderExamples;
import blue.language.samples.sdk.MyOsCookbookExamples;
import blue.language.sdk.DocBuilder;
import blue.language.sdk.MyOsPermissions;
import blue.language.sdk.paynote.PayNotes;
import blue.language.types.myos.Agent;
import blue.language.types.myos.SingleDocumentPermissionGranted;
import blue.language.types.myos.SubscriptionToSessionInitiated;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

final class ExampleDocs {

    private ExampleDocs() {
    }

    static List<Scenario> allExampleDocs() {
        List<Scenario> scenarios = new ArrayList<Scenario>();
        scenarios.add(new Scenario("counter-add-op", counterDoc(), doc -> DocBuilder.from(doc)
                .operation("decrement")
                    .channel("ownerChannel")
                    .description("Decrement")
                    .steps(steps -> steps.replaceExpression("Set", "/counter", "document('/counter') - 1"))
                    .done()
                .buildDocument()));
        scenarios.add(new Scenario("counter-change-step", counterDoc(), doc -> DocBuilder.from(doc)
                .replace("/contracts/incrementImpl/steps/0/changeset/0/val", "${document('/counter') + (event.message.request * 2)}")
                .buildDocument()));
        scenarios.add(new Scenario("composite-add-participant", compositeDoc(), doc -> DocBuilder.from(doc)
                .channel("channelC")
                .replace("/contracts/participantUnion/channels/2", "channelC")
                .buildDocument()));
        scenarios.add(new Scenario("direct-change-add-reviewer", directChangeDoc(), doc -> DocBuilder.from(doc)
                .channel("reviewerChannel")
                .buildDocument()));
        scenarios.add(new Scenario("myos-add-permission", myOsDoc(), doc -> DocBuilder.from(doc)
                .onInit("requestPermission", steps -> steps.myOs().requestSingleDocPermission(
                        "ownerChannel",
                        "REQ_2",
                        DocBuilder.expr("document('/sessionId')"),
                        MyOsPermissions.create().read(true)))
                .buildDocument()));
        scenarios.add(new Scenario("myos-add-second-admin", myOsDoc(), doc -> DocBuilder.from(doc)
                .myOsAdmin("secondaryAdminChannel")
                .buildDocument()));
        scenarios.add(new Scenario("ai-change-session", aiDoc(), doc -> DocBuilder.from(doc)
                .replace("/llmProviderSessionId", "session-llm-002")
                .buildDocument()));
        scenarios.add(new Scenario("ai-add-second-provider", aiDoc(), doc -> DocBuilder.from(doc)
                .field("/secondaryProviderSessionId", "session-llm-003")
                .buildDocument()));
        scenarios.add(new Scenario("ai-change-prompt", aiDoc(), doc -> DocBuilder.from(doc)
                .field("/promptTemplate", "Generate a concise response")
                .buildDocument()));
        scenarios.add(new Scenario("paynote-add-reserve", simpleCapturePayNote(), doc -> DocBuilder.from(doc)
                .onInit("reserveRequestOnInit", steps -> steps.triggerEvent("RequestReserve", new Node().type("PayNote/Reserve Funds Requested")))
                .buildDocument()));
        scenarios.add(new Scenario("paynote-change-amount", simpleCapturePayNote(), doc -> DocBuilder.from(doc)
                .replace("/amount/total", 2000)
                .buildDocument()));
        scenarios.add(new Scenario("paynote-add-channel", simpleCapturePayNote(), doc -> DocBuilder.from(doc)
                .channel("shipperChannel")
                .buildDocument()));
        scenarios.add(new Scenario("paynote-milestone-change", PayNoteCookbookExamples.milestoneReservePartialCapture(), doc -> DocBuilder.from(doc)
                .replace("/contracts/approveMilestone3Impl/steps/0/event/amount", new Node().value("${600000}"))
                .buildDocument()));
        scenarios.add(new Scenario("paynote-remove-voucher", ArmchairProtectionWithVoucherPayNote.templateDoc(), doc -> DocBuilder.from(doc)
                .remove("/contracts/requestVoucherPayment")
                .buildDocument()));
        scenarios.add(new Scenario("paynote-add-release", reserveCapturePayNote(), doc -> DocBuilder.from(doc)
                .onInit("releaseOnInit", steps -> steps.triggerEvent("Release", new Node().type("PayNote/Reservation Release Requested")))
                .buildDocument()));
        scenarios.add(new Scenario("empty-to-counter", new Node(), doc -> DocBuilder.from(doc)
                .name("Counter")
                .field("/counter", 0)
                .channel("ownerChannel")
                .operation("increment")
                    .channel("ownerChannel")
                    .description("Increment")
                    .steps(steps -> steps.replaceExpression("Set", "/counter", "document('/counter') + 1"))
                    .done()
                .buildDocument()));
        scenarios.add(new Scenario("remove-all-operations", counterDoc(), doc -> DocBuilder.from(doc)
                .remove("/contracts/increment")
                .remove("/contracts/incrementImpl")
                .buildDocument()));
        scenarios.add(new Scenario("rename-only", counterDoc(), doc -> DocBuilder.from(doc)
                .name("Counter Renamed")
                .buildDocument()));
        scenarios.add(new Scenario("description-only", counterDoc(), doc -> DocBuilder.from(doc)
                .description("Counter description updated")
                .buildDocument()));
        scenarios.add(new Scenario("counter-add-status", counterDoc(), doc -> DocBuilder.from(doc)
                .field("/status", "active")
                .buildDocument()));
        scenarios.add(new Scenario("sample-simple-agent-add-channel", DocBuilderExamples.simpleAgentWithPermissions(), doc -> DocBuilder.from(doc)
                .channel("observerChannel")
                .buildDocument()));
        scenarios.add(new Scenario("sample-agent-participant-add-field", DocBuilderExamples.agentAddsParticipantAndWaits(), doc -> DocBuilder.from(doc)
                .field("/audit/version", "v2")
                .buildDocument()));
        scenarios.add(new Scenario("myos-cookbook-weather-status", MyOsCookbookExamples.simplePermissionAndSubscribe(), doc -> DocBuilder.from(doc)
                .replace("/status", "paused")
                .buildDocument()));
        scenarios.add(new Scenario("myos-cookbook-linked-docs-note", MyOsCookbookExamples.linkedDocsWithUpdates(), doc -> DocBuilder.from(doc)
                .field("/lastSyncStatus", "partial")
                .buildDocument()));
        scenarios.add(new Scenario("paynote-cookbook-shipment-add-channel", PayNoteCookbookExamples.shipmentEscrowSimple(), doc -> DocBuilder.from(doc)
                .channel("shipmentCompanyChannel")
                .buildDocument()));
        scenarios.add(new Scenario("paynote-cookbook-release-window-note", PayNoteCookbookExamples.releaseLockedUntilWindowOpens(), doc -> DocBuilder.from(doc)
                .field("/releaseNote", "window-open")
                .buildDocument()));
        scenarios.add(new Scenario("paynote-cookbook-doc-update-note", PayNoteCookbookExamples.captureTriggeredFromDocUpdate(), doc -> DocBuilder.from(doc)
                .field("/deliveryComment", "verified")
                .buildDocument()));
        scenarios.add(new Scenario("voucher-balanced-add-version", BalancedBowlVoucherPayNote.templateDoc(), doc -> DocBuilder.from(doc)
                .field("/voucherVersion", 2)
                .buildDocument()));
        return scenarios;
    }

    static List<Scenario> allBaseDocsOnly() {
        return List.of(
                new Scenario("counter", counterDoc(), Function.identity()),
                new Scenario("composite", compositeDoc(), Function.identity()),
                new Scenario("directChange", directChangeDoc(), Function.identity()),
                new Scenario("myos", myOsDoc(), Function.identity()),
                new Scenario("ai", aiDoc(), Function.identity()),
                new Scenario("paynoteSimple", simpleCapturePayNote(), Function.identity()),
                new Scenario("paynoteVoucher", ArmchairProtectionWithVoucherPayNote.templateDoc(), Function.identity()),
                new Scenario("myosCookbook", MyOsCookbookExamples.simplePermissionAndSubscribe(), Function.identity()),
                new Scenario("paynoteCookbook", PayNoteCookbookExamples.shipmentEscrowSimple(), Function.identity()),
                new Scenario("docBuilderSamples", DocBuilderExamples.simpleAgentWithPermissions(), Function.identity())
        );
    }

    static Node counterDoc() {
        return DocBuilder.doc()
                .name("Counter")
                .field("/counter", 0)
                .channel("ownerChannel")
                .operation("increment")
                    .channel("ownerChannel")
                    .description("Increment")
                    .requestType(Integer.class)
                    .steps(steps -> steps.replaceExpression("Apply", "/counter", "document('/counter') + event.message.request"))
                    .done()
                .buildDocument();
    }

    static Node compositeDoc() {
        return DocBuilder.doc()
                .name("Composite")
                .channels("channelA", "channelB")
                .compositeChannel("participantUnion", "channelA", "channelB")
                .buildDocument();
    }

    static Node directChangeDoc() {
        return DocBuilder.doc()
                .name("Direct change")
                .field("/counter", 1)
                .channel("ownerChannel")
                .directChange("applyPatch", "ownerChannel", "Apply patch")
                .buildDocument();
    }

    static Node myOsDoc() {
        return DocBuilder.doc()
                .name("MyOS Doc")
                .type(Agent.class)
                .field("/sessionId", "session-1")
                .channel("ownerChannel")
                .myOsAdmin("myOsAdminChannel")
                .buildDocument();
    }

    static Node aiDoc() {
        return DocBuilder.doc()
                .name("AI Doc")
                .type(Agent.class)
                .field("/llmProviderSessionId", "session-llm-001")
                .field("/status", "idle")
                .channel("ownerChannel")
                .onInit("requestLlmAccess", steps -> steps.myOs().requestSingleDocPermission(
                        "ownerChannel",
                        "REQ_LLM",
                        DocBuilder.expr("document('/llmProviderSessionId')"),
                        MyOsPermissions.create().read(true)))
                .onMyOsResponse("onLlmAccessGranted",
                        SingleDocumentPermissionGranted.class,
                        "REQ_LLM",
                        steps -> steps.myOs().subscribeToSession(
                                "ownerChannel",
                                DocBuilder.expr("document('/llmProviderSessionId')"),
                                "SUB_LLM"))
                .onSubscriptionUpdate("onLlmUpdate",
                        "SUB_LLM",
                        SubscriptionToSessionInitiated.class,
                        steps -> steps.replaceValue("SetReady", "/status", "ready"))
                .buildDocument();
    }

    static Node simpleCapturePayNote() {
        return PayNotes.payNote("Simple capture")
                .currency("USD")
                .amountMinor(1000)
                .capture()
                    .lockOnInit()
                    .unlockOnOperation("unlockCapture", "payerChannel", "unlock")
                    .requestOnOperation("requestCapture", "guarantorChannel", "request")
                    .done()
                .buildDocument();
    }

    static Node reserveCapturePayNote() {
        return PayNotes.payNote("Reserve and capture")
                .currency("USD")
                .amountMinor(1000)
                .reserve().requestOnInit().done()
                .capture().requestOnInit().done()
                .buildDocument();
    }

    static final class Scenario {
        final String name;
        final Node base;
        final Function<Node, Node> mutation;

        Scenario(String name, Node base, Function<Node, Node> mutation) {
            this.name = name;
            this.base = base;
            this.mutation = mutation;
        }
    }
}
