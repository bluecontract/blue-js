package blue.language.types.payments.fields;

public class WirePaymentFields {
    public String bankSwift;
    public String bankName;
    public String accountNumber;
    public String beneficiaryName;
    public String beneficiaryAddress;

    public WirePaymentFields bankSwift(String bankSwift) {
        this.bankSwift = bankSwift;
        return this;
    }

    public WirePaymentFields bankName(String bankName) {
        this.bankName = bankName;
        return this;
    }

    public WirePaymentFields accountNumber(String accountNumber) {
        this.accountNumber = accountNumber;
        return this;
    }

    public WirePaymentFields beneficiaryName(String beneficiaryName) {
        this.beneficiaryName = beneficiaryName;
        return this;
    }

    public WirePaymentFields beneficiaryAddress(String beneficiaryAddress) {
        this.beneficiaryAddress = beneficiaryAddress;
        return this;
    }
}
