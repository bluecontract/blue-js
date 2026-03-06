package blue.language.types.paynote;

import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("PayNote/Funds Reserved")
@TypeBlueId("AopfdGqnwcxsw4mJzXbmjDMnASRtkce9BZB1n6QSRNXX")
public class FundsReserved {
    public Integer amountReserved;

    public FundsReserved amountReserved(Integer amountReserved) {
        this.amountReserved = amountReserved;
        return this;
    }
}
