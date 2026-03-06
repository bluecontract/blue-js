package blue.language.processor.contracts;

import blue.language.processor.HandlerProcessor;
import blue.language.processor.ProcessorExecutionContext;
import blue.language.processor.model.CustomHandlerContract;

public class CustomHandlerContractProcessor implements HandlerProcessor<CustomHandlerContract> {

    @Override
    public Class<CustomHandlerContract> contractType() {
        return CustomHandlerContract.class;
    }

    @Override
    public void execute(CustomHandlerContract contract, ProcessorExecutionContext context) {
        // no-op for contract loader parity tests
    }
}
