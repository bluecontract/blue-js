package blue.language.types.paynote;

import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("PayNote/Reserve Funds Requested")
@TypeBlueId("3Y3TYmSfZMmPYKmF5i3eR8YcVPNP5Sic2bZN8xRnvMWm")
public class ReserveFundsRequested {
    public Integer amount;

    public ReserveFundsRequested amount(Integer amount) {
        this.amount = amount;
        return this;
    }
}
