package blue.language.types.myos;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Call Operation Failed")
@TypeBlueId("FoP5MR52cMWmDBNBNss2i7oVe9p3DrVCjQABk2Kj5Rgd")
public class CallOperationFailed {
    public String reason;
    public Node inResponseTo;

    public CallOperationFailed reason(String reason) {
        this.reason = reason;
        return this;
    }

    public CallOperationFailed inResponseTo(Node inResponseTo) {
        this.inResponseTo = inResponseTo;
        return this;
    }
}
