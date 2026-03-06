package blue.language.samples.paynote;

import blue.language.model.Node;
import blue.language.samples.paynote.types.domain.CookbookEvents.DeliveryConfirmed;
import blue.language.samples.paynote.voucher.ArmchairProtectionWithVoucherPayNote;
import blue.language.samples.paynote.voucher.BalancedBowlVoucherPayNote;
import blue.language.samples.paynote.types.domain.CookbookEvents;
import blue.language.samples.paynote.types.domain.ShippingEvents;
import blue.language.sdk.paynote.PayNotes;
import blue.language.types.paynote.FundsReserved;

import java.util.LinkedHashMap;
import java.util.Map;

public final class PayNoteCookbookExamples {

    private PayNoteCookbookExamples() {
    }

    public static Map<String, Node> all() {
        Map<String, Node> docs = new LinkedHashMap<String, Node>();
        docs.put("shipmentEscrowSimple", shipmentEscrowSimple());
        docs.put("captureTriggeredFromChannelEvent", captureTriggeredFromChannelEvent());
        docs.put("captureTriggeredFromDocUpdate", captureTriggeredFromDocUpdate());
        docs.put("reserveOnApprovalThenCaptureOnConfirmation", reserveOnApprovalThenCaptureOnConfirmation());
        docs.put("reserveImmediatelyReleaseOnDispute", reserveImmediatelyReleaseOnDispute());
        docs.put("milestoneReservePartialCapture", milestoneReservePartialCapture());
        docs.put("reserveLockedUntilKycThenCaptureOnSettlement", reserveLockedUntilKycThenCaptureOnSettlement());
        docs.put("releaseLockedUntilWindowOpens", releaseLockedUntilWindowOpens());
        docs.put("armchairProtectionWithVoucher", ArmchairProtectionWithVoucherPayNote.templateDoc());
        docs.put("balancedBowlVoucher", BalancedBowlVoucherPayNote.templateDoc());
        return docs;
    }

    public static Node shipmentEscrowSimple() {
        return PayNotes.payNote("Shipment Escrow - Simple")
                .description("Capture is locked until guarantor confirms delivery.")
                .currency("USD")
                .amountMinor(120000)
                .channel("shipmentCompanyChannel")
                .capture()
                    .lockOnInit()
                    .unlockOnOperation(
                            "confirmDelivery",
                            "shipmentCompanyChannel",
                            "Shipment Company confirms delivery.",
                            steps -> steps.emitType("DeliveryConfirmed", DeliveryConfirmed.class))
                    .done()
                .buildDocument();
    }

    public static Node captureTriggeredFromChannelEvent() {
        return PayNotes.payNote("Capture Triggered From Channel Event")
                .description("Shipment channel emits shipment confirmation, then the document captures funds.")
                .currency("USD")
                .amountMinor(90000)
                .channel("shipmentCompanyChannel")
                .capture()
                    .lockOnInit()
                    .unlockOnEvent(DeliveryConfirmed.class)
                    .done()
                .onChannelEvent("onShipmentConfirmed",
                        "shipmentCompanyChannel",
                        ShippingEvents.ShipmentConfirmed.class,
                        steps -> steps.emitType("DeliveryConfirmed", DeliveryConfirmed.class, null))
                .onEvent("onDeliveryConfirmed",
                        DeliveryConfirmed.class,
                        steps -> steps.capture().requestNow())
                .buildDocument();
    }

    public static Node captureTriggeredFromDocUpdate() {
        return PayNotes.payNote("Capture Triggered From Document Update")
                .description("When delivery confirmation path appears, unlock and capture.")
                .currency("EUR")
                .amountMinor(49900)
                .capture()
                    .lockOnInit()
                    .unlockOnDocPathChange("/delivery/confirmedAt")
                    .done()
                .onDocChange("captureAfterDeliveryPathUpdate",
                        "/delivery/confirmedAt",
                        steps -> steps.capture().requestNow())
                .buildDocument();
    }

    public static Node reserveOnApprovalThenCaptureOnConfirmation() {
        return PayNotes.payNote("Reserve On Approval Then Capture On Confirmation")
                .description("Reserve unlocks when /approved changes; capture unlocks on delivery confirmation.")
                .currency("USD")
                .amountMinor(250000)
                .reserve()
                    .lockOnInit()
                    .unlockOnDocPathChange("/approved")
                    .requestOnDocPathChange("/approved")
                    .done()
                .onEvent("lockCaptureWhenReserved",
                        FundsReserved.class,
                        steps -> steps.capture().lock())
                .capture()
                    .unlockOnOperation(
                            "confirmDelivery",
                            "payerChannel",
                            "Payer confirms delivery.")
                    .requestOnOperation(
                            "requestCapture",
                            "guarantorChannel",
                            "Request full capture after confirmation.")
                    .done()
                .buildDocument();
    }

    public static Node reserveImmediatelyReleaseOnDispute() {
        return PayNotes.payNote("Reserve Immediately Release On Dispute")
                .description("Reserve on init; payer can open dispute for full reservation release.")
                .currency("EUR")
                .amountMinor(75000)
                .reserve()
                    .requestOnInit()
                    .done()
                .capture()
                    .requestOnOperation(
                            "capturePayment",
                            "guarantorChannel",
                            "Capture after service rendered.")
                    .done()
                .release()
                    .requestOnOperation(
                            "openDispute",
                            "payerChannel",
                            "Payer opens dispute for full release.")
                    .done()
                .buildDocument();
    }

    public static Node milestoneReservePartialCapture() {
        return PayNotes.payNote("Milestone Reserve Partial Capture")
                .description("Reserve full amount; guarantor approves milestone captures.")
                .currency("USD")
                .amountMinor(2000000)
                .reserve()
                    .requestOnInit()
                    .done()
                .capture()
                    .requestPartialOnOperation(
                            "approveMilestone1", "guarantorChannel",
                            "Approve milestone 1 (25%)", "500000")
                    .requestPartialOnOperation(
                            "approveMilestone2", "guarantorChannel",
                            "Approve milestone 2 (25%)", "500000")
                    .requestPartialOnOperation(
                            "approveMilestone3", "guarantorChannel",
                            "Approve milestone 3 (25%)", "500000")
                    .requestPartialOnOperation(
                            "approveMilestone4", "guarantorChannel",
                            "Approve milestone 4 (25%)", "500000")
                    .done()
                .release()
                    .requestPartialOnOperation(
                            "releaseUnfinishedWork",
                            "payerChannel",
                            "Release unfinished work.",
                            "event.message.request.amount")
                    .done()
                .buildDocument();
    }

    public static Node reserveLockedUntilKycThenCaptureOnSettlement() {
        return PayNotes.payNote("Reserve After KYC Capture On Settlement")
                .description("Reserve unlocks after KYC; capture unlocks on settlement confirmation.")
                .currency("CHF")
                .amountMinor(5000000)
                .reserve()
                    .lockOnInit()
                    .unlockOnEvent(CookbookEvents.KycApproved.class)
                    .requestOnEvent(CookbookEvents.KycApproved.class)
                    .done()
                .capture()
                    .lockOnInit()
                    .unlockOnDocPathChange("/settlement/confirmed")
                    .requestOnDocPathChange("/settlement/confirmed")
                    .done()
                .release()
                    .requestOnOperation(
                            "rejectKyc",
                            "guarantorChannel",
                            "Reject and release if KYC fails.")
                    .done()
                .buildDocument();
    }

    public static Node releaseLockedUntilWindowOpens() {
        return PayNotes.payNote("Release Locked Until Window Opens")
                .description("Capture runs on init; release unlocks only after guarantor opens a window.")
                .currency("USD")
                .amountMinor(19900)
                .reserve()
                    .requestOnInit()
                    .done()
                .capture()
                    .requestOnInit()
                    .done()
                .release()
                    .lockOnInit()
                    .unlockOnOperation(
                            "openReleaseWindow",
                            "guarantorChannel",
                            "Guarantor opens release window.")
                    .requestOnOperation(
                            "requestRelease",
                            "payerChannel",
                            "Payer requests full release.")
                    .done()
                .buildDocument();
    }
}
