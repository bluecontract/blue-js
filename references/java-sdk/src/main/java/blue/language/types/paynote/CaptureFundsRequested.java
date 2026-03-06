package blue.language.types.paynote;

import blue.language.model.BlueDescription;
import blue.language.model.BlueName;
import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("PayNote/Capture Funds Requested")
@TypeBlueId("DvxKVEFsDmgA1hcBDfh7t42NgTRLaxXjCrB48DufP3i3")
public class CaptureFundsRequested {
    @BlueName("amount")
    public String amountName;
    @BlueDescription("amount")
    public String amountDescription;
    public Integer amount;

    public CaptureFundsRequested amount(Integer amount) {
        this.amount = amount;
        return this;
    }
}
