package blue.language.sdk.internal;

import blue.language.model.Node;
import blue.language.processor.util.ProcessorPointerConstants;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public final class ChangesetBuilder {

    private static final List<String> RESERVED_CONTRACT_PATH_PREFIXES = Arrays.asList(
            ProcessorPointerConstants.RELATIVE_CHECKPOINT,
            ProcessorPointerConstants.RELATIVE_EMBEDDED,
            ProcessorPointerConstants.RELATIVE_INITIALIZED,
            ProcessorPointerConstants.RELATIVE_TERMINATED
    );

    private final List<Node> entries = new ArrayList<Node>();

    public ChangesetBuilder replaceValue(String path, Object value) {
        validateAllowedPath(path);
        entries.add(patchEntry("replace", path, new Node().value(value)));
        return this;
    }

    public ChangesetBuilder replaceExpression(String path, String expression) {
        validateAllowedPath(path);
        entries.add(patchEntry("replace", path, new Node().value(expr(expression))));
        return this;
    }

    public ChangesetBuilder addValue(String path, Object value) {
        validateAllowedPath(path);
        entries.add(patchEntry("add", path, new Node().value(value)));
        return this;
    }

    public ChangesetBuilder remove(String path) {
        validateAllowedPath(path);
        Node entry = new Node()
                .properties("op", new Node().value("remove"))
                .properties("path", new Node().value(path));
        entries.add(entry);
        return this;
    }

    public List<Node> build() {
        return entries;
    }

    private Node patchEntry(String op, String path, Node value) {
        return new Node()
                .properties("op", new Node().value(op))
                .properties("path", new Node().value(path))
                .properties("val", value);
    }

    private void validateAllowedPath(String path) {
        if (path == null || path.trim().isEmpty()) {
            throw new IllegalArgumentException("Patch path cannot be empty");
        }
        String normalized = path.trim();
        for (String reservedPrefix : RESERVED_CONTRACT_PATH_PREFIXES) {
            if (normalized.equals(reservedPrefix) || normalized.startsWith(reservedPrefix + "/")) {
                throw new IllegalArgumentException("Mutating reserved processor contract path is forbidden: " + path);
            }
        }
    }

    private static String expr(String expression) {
        if (expression == null) {
            return null;
        }
        String trimmed = expression.trim();
        if (trimmed.startsWith("${") && trimmed.endsWith("}")) {
            return trimmed;
        }
        return "${" + trimmed + "}";
    }
}
