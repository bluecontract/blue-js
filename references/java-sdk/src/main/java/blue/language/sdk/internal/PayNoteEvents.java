package blue.language.sdk.internal;

import blue.language.model.Node;
import blue.language.types.paynote.CaptureFundsRequested;
import blue.language.types.paynote.CaptureLocked;
import blue.language.types.paynote.CaptureLockRequested;
import blue.language.types.paynote.CaptureUnlocked;
import blue.language.types.paynote.CaptureUnlockRequested;
import blue.language.types.paynote.IssueChildPayNoteRequested;
import blue.language.types.paynote.PayNoteCancellationRequested;
import blue.language.types.paynote.ReservationReleaseRequested;
import blue.language.types.paynote.ReserveFundsAndCaptureImmediatelyRequested;
import blue.language.types.paynote.ReserveFundsRequested;

public final class PayNoteEvents {

    private PayNoteEvents() {
    }

    public static Node reserveFundsRequested(Object amount) {
        return new Node()
                .type(TypeRef.of(ReserveFundsRequested.class).asTypeNode())
                .properties("amount", valueNode(amount));
    }

    public static Node captureFundsRequested(Object amount) {
        return new Node()
                .type(TypeRef.of(CaptureFundsRequested.class).asTypeNode())
                .properties("amount", valueNode(amount));
    }

    public static Node reservationReleaseRequested(Object amount) {
        return new Node()
                .type(TypeRef.of(ReservationReleaseRequested.class).asTypeNode())
                .properties("amount", valueNode(amount));
    }

    public static Node reserveFundsAndCaptureImmediatelyRequested(Object amount) {
        return new Node()
                .type(TypeRef.of(ReserveFundsAndCaptureImmediatelyRequested.class).asTypeNode())
                .properties("amount", valueNode(amount));
    }

    public static Node issueChildPayNoteRequested(Object childPayNoteRef) {
        return new Node()
                .type(TypeRef.of(IssueChildPayNoteRequested.class).asTypeNode())
                .properties("childPayNote", valueNode(childPayNoteRef));
    }

    public static Node payNoteCancellationRequested(Object childPayNoteRef) {
        return new Node()
                .type(TypeRef.of(PayNoteCancellationRequested.class).asTypeNode())
                .properties("childPayNote", valueNode(childPayNoteRef));
    }

    public static Node captureLockRequested() {
        return new Node().type(TypeRef.of(CaptureLockRequested.class).asTypeNode());
    }

    public static Node captureUnlockRequested() {
        return new Node().type(TypeRef.of(CaptureUnlockRequested.class).asTypeNode());
    }

    public static Node captureLocked() {
        return new Node().type(TypeRef.of(CaptureLocked.class).asTypeNode());
    }

    public static Node captureUnlocked() {
        return new Node().type(TypeRef.of(CaptureUnlocked.class).asTypeNode());
    }

    private static Node valueNode(Object value) {
        if (value instanceof Node) {
            return (Node) value;
        }
        return new Node().value(value);
    }
}
