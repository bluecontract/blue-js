package blue.language.types.paynote;

import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("PayNote/Reserve Funds and Capture Immediately Requested")
@TypeBlueId("3XstDYFkqsUP5PdM6Z6mwspPzgdQMFtUpNyMsKPK2o6N")
public class ReserveFundsAndCaptureImmediatelyRequested {
    public Integer amount;

    public ReserveFundsAndCaptureImmediatelyRequested amount(Integer amount) {
        this.amount = amount;
        return this;
    }
}
