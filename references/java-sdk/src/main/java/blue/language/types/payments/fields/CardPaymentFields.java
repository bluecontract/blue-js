package blue.language.types.payments.fields;

public class CardPaymentFields {
    public String cardOnFileRef;
    public String merchantDescriptor;

    public CardPaymentFields cardOnFileRef(String cardOnFileRef) {
        this.cardOnFileRef = cardOnFileRef;
        return this;
    }

    public CardPaymentFields merchantDescriptor(String merchantDescriptor) {
        this.merchantDescriptor = merchantDescriptor;
        return this;
    }
}
