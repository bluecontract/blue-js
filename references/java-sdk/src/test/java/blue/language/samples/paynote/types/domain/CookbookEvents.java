package blue.language.samples.paynote.types.domain;

import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

public final class CookbookEvents {

    private CookbookEvents() {
    }

    @TypeAlias("Cookbook/Delivery Confirmed")
    @TypeBlueId("Cookbook-Delivery-Confirmed-BlueId")
    public static class DeliveryConfirmed {
        public String orderId;

        public DeliveryConfirmed orderId(String orderId) {
            this.orderId = orderId;
            return this;
        }
    }

    @TypeAlias("Cookbook/Kyc Approved")
    @TypeBlueId("Cookbook-Kyc-Approved-BlueId")
    public static class KycApproved {
        public String userId;

        public KycApproved userId(String userId) {
            this.userId = userId;
            return this;
        }
    }
}
