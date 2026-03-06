package blue.language.processor.registry.processors;

import blue.language.processor.ContractProcessor;
import blue.language.processor.model.OperationMarker;

public class OperationMarkerProcessor implements ContractProcessor<OperationMarker> {

    @Override
    public Class<OperationMarker> contractType() {
        return OperationMarker.class;
    }
}
