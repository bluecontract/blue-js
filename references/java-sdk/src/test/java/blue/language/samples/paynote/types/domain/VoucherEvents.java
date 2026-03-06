package blue.language.samples.paynote.types.domain;

import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

public final class VoucherEvents {

    private VoucherEvents() {
    }

    @TypeAlias("Demo/Satisfaction Confirmed")
    @TypeBlueId("Voucher-Demo-Satisfaction-Confirmed-BlueId")
    public static class SatisfactionConfirmed {
        public String by;

        public SatisfactionConfirmed by(String by) {
            this.by = by;
            return this;
        }
    }

    @TypeAlias("Voucher/Monitoring Approved")
    @TypeBlueId("Voucher-Monitoring-Approved-BlueId")
    public static class MonitoringApproved {
        public String merchantId;

        public MonitoringApproved merchantId(String merchantId) {
            this.merchantId = merchantId;
            return this;
        }
    }

    @TypeAlias("Voucher/Start Monitoring Requested")
    @TypeBlueId("Voucher-Start-Monitoring-Requested-BlueId")
    public static class StartMonitoringRequested {
        public String merchantId;
        public String scope;
        public String subject;

        public StartMonitoringRequested merchantId(String merchantId) {
            this.merchantId = merchantId;
            return this;
        }

        public StartMonitoringRequested scope(String scope) {
            this.scope = scope;
            return this;
        }

        public StartMonitoringRequested subject(String subject) {
            this.subject = subject;
            return this;
        }
    }
}
