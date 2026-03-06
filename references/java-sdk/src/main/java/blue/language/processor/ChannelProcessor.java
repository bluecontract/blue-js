package blue.language.processor;

import blue.language.model.Node;
import blue.language.processor.model.ChannelContract;

/**
 * Processor specialization for channel contracts.
 */
public interface ChannelProcessor<T extends ChannelContract> extends ContractProcessor<T> {

    boolean matches(T contract, ChannelEvaluationContext context);

    default Node channelize(T contract, ChannelEvaluationContext context) {
        return context.event();
    }

    default ChannelProcessorEvaluation evaluate(T contract, ChannelEvaluationContext context) {
        boolean matched = matches(contract, context);
        if (!matched) {
            return ChannelProcessorEvaluation.noMatch();
        }
        return ChannelProcessorEvaluation.matched(eventId(contract, context), channelize(contract, context));
    }

    default boolean isNewerEvent(T contract, ChannelEvaluationContext context, Node lastEvent) {
        return true;
    }

    default String eventId(T contract, ChannelEvaluationContext context) {
        return null;
    }
}
