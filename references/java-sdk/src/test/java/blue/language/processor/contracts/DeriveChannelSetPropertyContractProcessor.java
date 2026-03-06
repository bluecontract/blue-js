package blue.language.processor.contracts;

import blue.language.model.Node;
import blue.language.processor.HandlerProcessor;
import blue.language.processor.ProcessorExecutionContext;
import blue.language.processor.model.DeriveChannelSetProperty;
import blue.language.processor.model.JsonPatch;

public class DeriveChannelSetPropertyContractProcessor implements HandlerProcessor<DeriveChannelSetProperty> {

    @Override
    public Class<DeriveChannelSetProperty> contractType() {
        return DeriveChannelSetProperty.class;
    }

    @Override
    public String deriveChannel(DeriveChannelSetProperty contract) {
        String fallback = contract.getFallbackChannel();
        if (fallback == null || fallback.trim().isEmpty()) {
            return "testChannel";
        }
        return fallback.trim();
    }

    @Override
    public void execute(DeriveChannelSetProperty contract, ProcessorExecutionContext context) {
        String key = contract.getPropertyKey() != null ? contract.getPropertyKey() : "/x";
        context.applyPatch(JsonPatch.add(context.resolvePointer(key), new Node().value(contract.getPropertyValue())));
    }
}
