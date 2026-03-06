package blue.language.processor.model;

import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

/**
 * Base type for all contract representations extracted from a document tree.
 */
@TypeAlias("Contract")
@TypeBlueId({
        "AERp8BWnuUsjoPciAeNXuUWS9fmqPNMdWbxmKn3tcitx",
        "Contract",
        "Core/Contract"
})
public abstract class Contract {

    private String key;
    private Integer order;

    public String getKey() {
        return key;
    }

    public Contract setKey(String key) {
        this.key = key;
        return this;
    }

    public Contract key(String key) {
        return setKey(key);
    }

    public Integer getOrder() {
        return order;
    }

    public Contract setOrder(Integer order) {
        this.order = order;
        return this;
    }

    public Contract order(Integer order) {
        return setOrder(order);
    }
}
