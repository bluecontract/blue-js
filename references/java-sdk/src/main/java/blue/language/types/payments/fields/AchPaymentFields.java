package blue.language.types.payments.fields;

public class AchPaymentFields {
    public String routingNumber;
    public String accountNumber;
    public String accountType;
    public String network;
    public String companyEntryDescription;

    public AchPaymentFields routingNumber(String routingNumber) {
        this.routingNumber = routingNumber;
        return this;
    }

    public AchPaymentFields accountNumber(String accountNumber) {
        this.accountNumber = accountNumber;
        return this;
    }

    public AchPaymentFields accountType(String accountType) {
        this.accountType = accountType;
        return this;
    }

    public AchPaymentFields network(String network) {
        this.network = network;
        return this;
    }

    public AchPaymentFields companyEntryDescription(String companyEntryDescription) {
        this.companyEntryDescription = companyEntryDescription;
        return this;
    }
}
