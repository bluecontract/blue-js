package blue.language.types.payments.fields;

public class SepaPaymentFields {
    public String ibanFrom;
    public String ibanTo;
    public String bicTo;
    public String remittanceInformation;

    public SepaPaymentFields ibanFrom(String ibanFrom) {
        this.ibanFrom = ibanFrom;
        return this;
    }

    public SepaPaymentFields ibanTo(String ibanTo) {
        this.ibanTo = ibanTo;
        return this;
    }

    public SepaPaymentFields bicTo(String bicTo) {
        this.bicTo = bicTo;
        return this;
    }

    public SepaPaymentFields remittanceInformation(String remittanceInformation) {
        this.remittanceInformation = remittanceInformation;
        return this;
    }
}
