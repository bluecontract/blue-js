package blue.language.types.paynote;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("PayNote/Issue Child PayNote Requested")
@TypeBlueId("53Dir2sGy1NHuCQXF6suGoDMxYacNhbcy23AKD89SghD")
public class IssueChildPayNoteRequested {
    public Node childPayNote;

    public IssueChildPayNoteRequested childPayNote(Node childPayNote) {
        this.childPayNote = childPayNote;
        return this;
    }
}
