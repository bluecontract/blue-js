package blue.language.sdk.paynote;

public final class PayNotes {

    private PayNotes() {
    }

    public static PayNoteBuilder payNote(String name) {
        return PayNoteBuilder.payNote(name);
    }
}
