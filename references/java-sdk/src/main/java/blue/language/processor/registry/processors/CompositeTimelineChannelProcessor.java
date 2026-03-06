package blue.language.processor.registry.processors;

import blue.language.model.Node;
import blue.language.processor.ChannelEvaluationContext;
import blue.language.processor.ChannelProcessor;
import blue.language.processor.ChannelProcessorEvaluation;
import blue.language.processor.ContractBundle;
import blue.language.processor.model.ChannelContract;
import blue.language.processor.model.ChannelEventCheckpoint;
import blue.language.processor.model.CompositeTimelineChannel;
import blue.language.processor.model.MarkerContract;
import blue.language.processor.util.ProcessorContractConstants;

import java.util.ArrayList;
import java.util.List;

public class CompositeTimelineChannelProcessor implements ChannelProcessor<CompositeTimelineChannel> {

    public static String compositeCheckpointKey(String compositeKey, String childKey) {
        return compositeKey + "::" + childKey;
    }

    @Override
    public Class<CompositeTimelineChannel> contractType() {
        return CompositeTimelineChannel.class;
    }

    @Override
    public ChannelProcessorEvaluation evaluate(CompositeTimelineChannel contract, ChannelEvaluationContext context) {
        Node event = context.event();
        if (event == null || contract.getChannels().isEmpty()) {
            return ChannelProcessorEvaluation.noMatch();
        }

        List<ChannelProcessorEvaluation.ChannelDelivery> deliveries = new ArrayList<>();
        String rootEventId = TimelineEventSupport.eventId(event);

        for (String childKey : contract.getChannels()) {
            ContractBundle.ChannelBinding childBinding = context.resolveChannel(childKey);
            if (childBinding == null) {
                throw new IllegalStateException("Composite timeline channel '" + context.bindingKey()
                        + "' references missing channel '" + childKey + "'");
            }
            ChannelContract childContract = childBinding.contract();
            @SuppressWarnings("unchecked")
            ChannelProcessor<ChannelContract> childProcessor =
                    (ChannelProcessor<ChannelContract>) context.channelProcessorFor(childContract);
            if (childProcessor == null) {
                throw new IllegalStateException("No processor registered for composite child channel '" + childKey + "'");
            }

            Node childEvent = event.clone();
            ChannelEvaluationContext childContext = new ChannelEvaluationContext(
                    context.scopePath(),
                    childBinding.key(),
                    childEvent,
                    context.eventObject(),
                    context.markers(),
                    context.bundle(),
                    context.registry());

            ChannelProcessorEvaluation childEvaluation = childProcessor.evaluate(childContract, childContext);
            if (childEvaluation == null || !childEvaluation.matches()) {
                continue;
            }

            Node eventForHandlers = childEvaluation.eventNode() != null ? childEvaluation.eventNode() : childContext.event();
            if (eventForHandlers == null) {
                continue;
            }
            enrichWithCompositeSource(eventForHandlers, childBinding.key());
            String checkpointKey = compositeCheckpointKey(context.bindingKey(), childBinding.key());
            Boolean shouldProcess = shouldProcessChild(childProcessor, childContract, childContext, checkpointKey, context);
            deliveries.add(new ChannelProcessorEvaluation.ChannelDelivery(
                    eventForHandlers,
                    childEvaluation.eventId() != null ? childEvaluation.eventId() : rootEventId,
                    checkpointKey,
                    shouldProcess));
        }

        if (deliveries.isEmpty()) {
            return ChannelProcessorEvaluation.noMatch();
        }
        return ChannelProcessorEvaluation.matchedDeliveries(deliveries);
    }

    @Override
    public boolean matches(CompositeTimelineChannel contract, ChannelEvaluationContext context) {
        return evaluate(contract, context).matches();
    }

    @Override
    public boolean isNewerEvent(CompositeTimelineChannel contract, ChannelEvaluationContext context, Node lastEvent) {
        ChannelProcessorEvaluation evaluation = evaluate(contract, context);
        if (evaluation == null || !evaluation.matches()) {
            return false;
        }
        for (ChannelProcessorEvaluation.ChannelDelivery delivery : evaluation.deliveries()) {
            if (!Boolean.FALSE.equals(delivery.shouldProcess())) {
                return true;
            }
        }
        return false;
    }

    private void enrichWithCompositeSource(Node event, String childKey) {
        if (event == null || childKey == null) {
            return;
        }
        Node meta = event.getProperties() != null ? event.getProperties().get("meta") : null;
        if (meta == null) {
            meta = new Node();
            event.properties("meta", meta);
        }
        meta.properties("compositeSourceChannelKey", new Node().value(childKey));
    }

    private Boolean shouldProcessChild(ChannelProcessor<ChannelContract> childProcessor,
                                       ChannelContract childContract,
                                       ChannelEvaluationContext childContext,
                                       String checkpointKey,
                                       ChannelEvaluationContext compositeContext) {
        MarkerContract marker = compositeContext.markers().get(ProcessorContractConstants.KEY_CHECKPOINT);
        if (!(marker instanceof ChannelEventCheckpoint)) {
            return null;
        }
        Node lastEvent = ((ChannelEventCheckpoint) marker).lastEvent(checkpointKey);
        if (lastEvent == null) {
            return null;
        }
        return childProcessor.isNewerEvent(childContract, childContext, lastEvent);
    }
}
