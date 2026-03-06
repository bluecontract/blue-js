package blue.language.processor;

import blue.language.processor.model.HandlerContract;

/**
 * Processor specialization for handler contracts.
 */
public interface HandlerProcessor<T extends HandlerContract> extends ContractProcessor<T> {

    default String deriveChannel(T contract) {
        return null;
    }

    default String deriveChannel(T contract, ContractBundle scopeContracts) {
        return deriveChannel(contract);
    }

    default boolean matches(T contract, ProcessorExecutionContext context) {
        return true;
    }

    void execute(T contract, ProcessorExecutionContext context);
}
