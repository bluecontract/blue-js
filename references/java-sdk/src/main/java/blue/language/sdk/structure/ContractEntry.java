package blue.language.sdk.structure;

import java.util.List;

public class ContractEntry {
    public String key;
    public TypeRef type;
    public ContractKind kind;

    public String channel;
    public TypeRef eventMatcherType;
    public String boundOperation;
    public TypeRef requestType;
    public String requestDescription;
    public List<String> compositeChildren;
    public String fingerprint;
}
