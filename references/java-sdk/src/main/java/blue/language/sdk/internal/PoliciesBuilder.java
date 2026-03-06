package blue.language.sdk.internal;

import blue.language.model.Node;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public final class PoliciesBuilder {

    private final Map<String, Node> policies;

    public PoliciesBuilder(Map<String, Node> policies) {
        this.policies = policies;
    }

    public PoliciesBuilder contractsChangePolicy(String mode, String reason) {
        Node policy = new Node();
        policy.properties("mode", new Node().value(mode));
        if (reason != null) {
            policy.properties("reason", new Node().value(reason));
        }
        policies.put("contractsChangePolicy", policy);
        return this;
    }

    public PoliciesBuilder changesetAllowList(String operationName, String... allowedPaths) {
        Node allowListRoot = policies.get("changesetAllowList");
        if (allowListRoot == null) {
            allowListRoot = new Node();
            policies.put("changesetAllowList", allowListRoot);
        }

        List<Node> items = new ArrayList<Node>();
        if (allowedPaths != null) {
            for (String path : allowedPaths) {
                items.add(new Node().value(path));
            }
        }
        allowListRoot.properties(operationName, new Node().items(items));
        return this;
    }
}
