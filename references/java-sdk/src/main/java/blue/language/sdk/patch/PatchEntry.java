package blue.language.sdk.patch;

import blue.language.model.Node;

public class PatchEntry {
    public String op;
    public String path;
    public Node val;

    public static PatchEntry add(String path, Node value) {
        PatchEntry entry = new PatchEntry();
        entry.op = "add";
        entry.path = path;
        entry.val = value;
        return entry;
    }

    public static PatchEntry replace(String path, Node value) {
        PatchEntry entry = new PatchEntry();
        entry.op = "replace";
        entry.path = path;
        entry.val = value;
        return entry;
    }

    public static PatchEntry remove(String path) {
        PatchEntry entry = new PatchEntry();
        entry.op = "remove";
        entry.path = path;
        entry.val = null;
        return entry;
    }
}
