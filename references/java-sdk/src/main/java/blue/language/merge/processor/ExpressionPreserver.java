package blue.language.merge.processor;

import blue.language.NodeProvider;
import blue.language.merge.MergingProcessor;
import blue.language.merge.NodeResolver;
import blue.language.model.Node;

import java.util.Map;

/**
 * Preserves expression scalar values so type assignment does not coerce them.
 */
public class ExpressionPreserver implements MergingProcessor {

    @Override
    public void process(Node target, Node source, NodeProvider nodeProvider, NodeResolver nodeResolver) {
        if (!hasExpressionValue(source)) {
            return;
        }
        target.value(source.getValue());
        target.properties((Map<String, Node>) null);
        target.items((java.util.List<Node>) null);
        target.type((Node) null);
    }

    @Override
    public void postProcess(Node target, Node source, NodeProvider nodeProvider, NodeResolver nodeResolver) {
        if (!hasExpressionValue(source)) {
            return;
        }
        if (source.getValue() != null && !source.getValue().equals(target.getValue())) {
            target.value(source.getValue());
        }
    }

    private boolean hasExpressionValue(Node source) {
        if (source == null || !(source.getValue() instanceof String)) {
            return false;
        }
        String text = ((String) source.getValue()).trim();
        return text.startsWith("${") && text.endsWith("}");
    }
}
