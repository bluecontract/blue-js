package blue.language.samples.paynote.voucher;

import blue.language.model.Node;
import blue.language.samples.paynote.types.domain.VoucherEvents;
import blue.language.sdk.paynote.PayNotes;
import blue.language.types.paynote.FundsCaptured;

public final class ArmchairProtectionWithVoucherPayNote {

    private ArmchairProtectionWithVoucherPayNote() {
    }

    public static Node templateDoc() {
        return PayNotes.payNote("Armchair Protection + Voucher")
                .description("Capture unlocks after buyer satisfaction, then a voucher payment is requested.")
                .currency("USD")
                .amountMinor(10000)
                .capture()
                    .lockOnInit()
                    .unlockOnOperation(
                            "confirmSatisfaction",
                            "payerChannel",
                            "Buyer confirms satisfaction.",
                            steps -> steps.emitType("SatisfactionConfirmed", VoucherEvents.SatisfactionConfirmed.class, null))
                    .done()
                .onEvent("requestVoucherPayment", FundsCaptured.class, steps -> steps.requestBackwardPayment(
                        "VoucherCredit",
                        payload -> payload
                                .processor("guarantorChannel")
                                .from("payeeChannel")
                                .to("payerChannel")
                                .currency("USD")
                                .amountMinor(10000)
                                .reason("voucher-activation")
                                .attachPayNote(BalancedBowlVoucherPayNote.templateDoc())))
                .buildDocument();
    }
}
