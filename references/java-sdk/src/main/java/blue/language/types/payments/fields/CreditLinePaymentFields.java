package blue.language.types.payments.fields;

public class CreditLinePaymentFields {
    public String creditLineId;
    public String merchantAccountId;
    public String cardholderAccountId;

    public CreditLinePaymentFields creditLineId(String creditLineId) {
        this.creditLineId = creditLineId;
        return this;
    }

    public CreditLinePaymentFields merchantAccountId(String merchantAccountId) {
        this.merchantAccountId = merchantAccountId;
        return this;
    }

    public CreditLinePaymentFields cardholderAccountId(String cardholderAccountId) {
        this.cardholderAccountId = cardholderAccountId;
        return this;
    }
}
