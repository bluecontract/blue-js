package blue.language.samples.paynote.types.domain;

import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

public final class ShippingEvents {

    private ShippingEvents() {
    }

    @TypeAlias("Shipping/Shipment Confirmed")
    @TypeBlueId("Shipping-Shipment-Confirmed-Demo-BlueId")
    public static class ShipmentConfirmed {
        public String source;

        public ShipmentConfirmed source(String source) {
            this.source = source;
            return this;
        }
    }
}
