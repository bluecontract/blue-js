package blue.language.types.paynote;

import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("PayNote/Funds Captured")
@TypeBlueId("BJvjorbC5ed5KTV7SxoV3CvrJXjrFPcFxY9QT4jHBbXi")
public class FundsCaptured {
    public Integer amountCaptured;

    public FundsCaptured amountCaptured(Integer amountCaptured) {
        this.amountCaptured = amountCaptured;
        return this;
    }
}
