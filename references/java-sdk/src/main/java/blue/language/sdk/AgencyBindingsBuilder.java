package blue.language.sdk;

import blue.language.model.Node;

import java.util.LinkedHashMap;
import java.util.Map;

public final class AgencyBindingsBuilder {

    private final Map<String, Node> bindings = new LinkedHashMap<String, Node>();

    public AgencyBindingsBuilder bind(String channelKey, String value) {
        String normalizedKey = normalize(channelKey);
        if (normalizedKey != null && value != null) {
            bindings.put(normalizedKey, new Node().value(value));
        }
        return this;
    }

    public AgencyBindingsBuilder bindAccount(String channelKey, String accountId) {
        String normalizedKey = normalize(channelKey);
        String normalizedAccountId = normalize(accountId);
        if (normalizedKey != null && normalizedAccountId != null) {
            bindings.put(normalizedKey,
                    new Node().properties("accountId", new Node().value(normalizedAccountId)));
        }
        return this;
    }

    public AgencyBindingsBuilder bindNode(String channelKey, Node node) {
        String normalizedKey = normalize(channelKey);
        if (normalizedKey != null && node != null) {
            bindings.put(normalizedKey, node.clone());
        }
        return this;
    }

    public AgencyBindingsBuilder bindExpr(String channelKey, String expression) {
        String normalizedKey = normalize(channelKey);
        String normalizedExpression = normalize(expression);
        if (normalizedKey != null && normalizedExpression != null) {
            bindings.put(normalizedKey, new Node().value(DocBuilder.expr(normalizedExpression)));
        }
        return this;
    }

    public AgencyBindingsBuilder bindFromCurrentDoc(String channelKey) {
        String normalizedKey = normalize(channelKey);
        if (normalizedKey != null) {
            bindings.put(normalizedKey, new Node().value(normalizedKey));
        }
        return this;
    }

    public AgencyBindingsBuilder bindFromCurrentDoc(String targetKey, String sourceKey) {
        String normalizedTarget = normalize(targetKey);
        String normalizedSource = normalize(sourceKey);
        if (normalizedTarget != null && normalizedSource != null) {
            bindings.put(normalizedTarget, new Node().value(normalizedSource));
        }
        return this;
    }

    Node buildNode() {
        Node node = new Node().properties(new LinkedHashMap<String, Node>());
        for (Map.Entry<String, Node> entry : bindings.entrySet()) {
            node.properties(entry.getKey(), entry.getValue());
        }
        return node;
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
