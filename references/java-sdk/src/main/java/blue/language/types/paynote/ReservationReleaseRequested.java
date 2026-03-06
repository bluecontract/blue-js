package blue.language.types.paynote;

import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("PayNote/Reservation Release Requested")
@TypeBlueId("GU8nkSnUuMs6632rHQyBndRtjDcMB9ZSbgwkGYcfGt97")
public class ReservationReleaseRequested {
    public Integer amount;

    public ReservationReleaseRequested amount(Integer amount) {
        this.amount = amount;
        return this;
    }
}
