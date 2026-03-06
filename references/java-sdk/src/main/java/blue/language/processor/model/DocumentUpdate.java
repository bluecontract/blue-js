package blue.language.processor.model;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("Document Update")
@TypeBlueId({
        "7htwgHAXA9FjUGRytXFfwYMUZz4R3BDMfmeHeGvpscLP",
        "Document Update",
        "Core/Document Update",
        "DocumentUpdate"
})
public class DocumentUpdate {

    private String op;
    private String path;
    private Node before;
    private Node after;

    public String getOp() {
        return op;
    }

    public DocumentUpdate setOp(String op) {
        this.op = op;
        return this;
    }

    public DocumentUpdate op(String op) {
        return setOp(op);
    }

    public String getPath() {
        return path;
    }

    public DocumentUpdate setPath(String path) {
        this.path = path;
        return this;
    }

    public DocumentUpdate path(String path) {
        return setPath(path);
    }

    public Node getBefore() {
        return before;
    }

    public DocumentUpdate setBefore(Node before) {
        this.before = before;
        return this;
    }

    public DocumentUpdate before(Node before) {
        return setBefore(before);
    }

    public Node getAfter() {
        return after;
    }

    public DocumentUpdate setAfter(Node after) {
        this.after = after;
        return this;
    }

    public DocumentUpdate after(Node after) {
        return setAfter(after);
    }
}
