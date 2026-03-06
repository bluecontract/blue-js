package blue.language.types.paynote;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("PayNote/PayNote Cancellation Requested")
@TypeBlueId("DqiwzsNLbHCh6PaDF6wy6ZqBSF5JV5nAQSKFKTPRTbGB")
public class PayNoteCancellationRequested {
    public Node childPayNote;

    public PayNoteCancellationRequested childPayNote(Node childPayNote) {
        this.childPayNote = childPayNote;
        return this;
    }
}
