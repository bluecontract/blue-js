package blue.language.mapping.model;

import blue.language.model.TypeBlueId;

@TypeBlueId({"AliasMappedType/Primary", "AliasMappedType/Secondary"})
public class AliasMappedType {
    private String value;

    public String getValue() {
        return value;
    }

    public void setValue(String value) {
        this.value = value;
    }
}
